/**
 * Skrip pembangkit prisma/seed.ts — mengekspor data riil Kab. Seruyan
 * dari database berjalan menjadi berkas seed (dijalankan sekali oleh dev).
 */
import { PrismaClient } from '@prisma/client'
import { writeFileSync } from 'fs'

const db = new PrismaClient()

function fmt(n: number): string {
  return JSON.stringify(n)
}

function jstr(s: string): string {
  return JSON.stringify(s)
}

async function main() {
  const opds = await db.opd.findMany({ orderBy: { code: 'asc' } })
  const apbd = await db.apbdSummary.findMany({ orderBy: { year: 'asc' } })
  const budget = await db.budgetItem.findMany({
    orderBy: [{ section: 'asc' }, { tab: 'asc' }, { code: 'asc' }, { year: 'asc' }],
  })
  const realisasi = await db.realisasiAkun.findMany({
    orderBy: [{ scope: 'asc' }, { year: 'asc' }, { code: 'asc' }],
  })
  const skpd = await db.realisasiSkpd.findMany({ orderBy: { name: 'asc' } })
  const skpdPeriode = await db.realisasiSkpdPeriode.findMany({
    orderBy: [{ name: 'asc' }, { periode: 'asc' }],
  })
  const docs = await db.transparansiDoc.findMany({ orderBy: [{ type: 'asc' }, { title: 'asc' }] })

  const opdIdToCode = new Map(opds.map((o) => [o.id, o.code]))

  const lines: string[] = []
  lines.push(`import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()

// ---------------------------------------------------------------------------
// Data anggaran & realisasi riil Kabupaten Seruyan (APBD 2024-2026 + LRA).
// Diekspor dari database produksi sebagai data awal instalasi baru.
// TIDAK ADA akun bawaan — Setup Wizard first-run membuat akun admin pertama.
// ---------------------------------------------------------------------------

// Master OPD/SKPD (di-upsert berdasarkan kode sehingga aman bila di-seed ulang)
type OpdRow = { code: string; name: string; active: boolean }
const opdRows: OpdRow[] = [`)
  for (const o of opds) {
    lines.push(`  { code: ${jstr(o.code)}, name: ${jstr(o.name)}, active: ${o.active} },`)
  }
  lines.push(`]

// Ringkasan APBD per tahun (dalam Rupiah)
const apbdSummary = [`)
  for (const s of apbd) {
    lines.push(
      `  { year: ${s.year}, pendApbd: ${fmt(s.pendapatanApbd)}, pendApbdp: ${fmt(s.pendapatanApbdp)}, belApbd: ${fmt(s.belanjaApbd)}, belApbdp: ${fmt(s.belanjaApbdp)}, terApbd: ${fmt(s.terimaApbd)}, terApbdp: ${fmt(s.terimaApbdp)}, kelApbd: ${fmt(s.keluarApbd)}, kelApbdp: ${fmt(s.keluarApbdp)} },`
    )
  }
  lines.push(`]

// Item anggaran: [section, tab, kode, uraian, tahun, jumlah]
type BudgetRow = [string, string, string, string, number, number]
const budgetRows: BudgetRow[] = [`)
  for (const b of budget) {
    lines.push(
      `  [${jstr(b.section)}, ${jstr(b.tab)}, ${jstr(b.code)}, ${jstr(b.name)}, ${b.year}, ${fmt(b.amount)}],`
    )
  }
  lines.push(`]

// Realisasi per akun: [kode, uraian, kelompok, level, scope, kodeOPD|null, periode, tahun, anggaran, realisasi]
type RealRow = [string, string, string, number, string, string | null, number, number, number, number]
const realisasiRows: RealRow[] = [`)
  for (const r of realisasi) {
    const opdCode = r.opdId ? (opdIdToCode.get(r.opdId) ?? null) : null
    lines.push(
      `  [${jstr(r.code)}, ${jstr(r.name)}, ${jstr(r.group)}, ${r.level}, ${jstr(r.scope)}, ${opdCode ? jstr(opdCode) : 'null'}, ${r.periode}, ${r.year}, ${fmt(r.anggaran)}, ${fmt(r.realisasi)}],`
    )
  }
  lines.push(`]

// Ringkasan realisasi per SKPD (tahun anggaran)
const skpdRows = [`)
  for (const s of skpd) {
    lines.push(
      `  { name: ${jstr(s.name)}, year: ${s.year}, pendAng: ${fmt(s.pendapatanAnggaran)}, pendReal: ${fmt(s.pendapatanRealisasi)}, belAng: ${fmt(s.belanjaAnggaran)}, belReal: ${fmt(s.belanjaRealisasi)}, pemAng: ${fmt(s.pembiayaanAnggaran)}, pemReal: ${fmt(s.pembiayaanRealisasi)} },`
    )
  }
  lines.push(`]

// Ringkasan realisasi per SKPD per periode (kumulatif s.d. bulan ke-N)
const skpdPeriodeRows = [`)
  for (const s of skpdPeriode) {
    lines.push(
      `  { name: ${jstr(s.name)}, periode: ${s.periode}, year: ${s.year}, pendAng: ${fmt(s.pendapatanAnggaran)}, pendReal: ${fmt(s.pendapatanRealisasi)}, belAng: ${fmt(s.belanjaAnggaran)}, belReal: ${fmt(s.belanjaRealisasi)}, pemAng: ${fmt(s.pembiayaanAnggaran)}, pemReal: ${fmt(s.pembiayaanRealisasi)} },`
    )
  }
  lines.push(`]

// Dokumen transparansi: [jenis, judul]
type DocRow = [string, string]
const docRows: DocRow[] = [`)
  for (const d of docs) {
    lines.push(`  [${jstr(d.type)}, ${jstr(d.title)}],`)
  }
  lines.push(`]

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main() {
  console.log('Seeding database — data awal Kabupaten Seruyan...')

  // Master OPD di-upsert per kode (aman untuk seed ulang: akun OPD pengguna
  // tidak ikut terhapus karena tidak ada deleteMany pada tabel opd)
  const opdByCode = new Map<string, number>()
  for (const o of opdRows) {
    const row = await db.opd.upsert({
      where: { code: o.code },
      update: { name: o.name, active: o.active },
      create: { code: o.code, name: o.name, active: o.active },
    })
    opdByCode.set(o.code, row.id)
  }

  await db.apbdSummary.deleteMany()
  for (const s of apbdSummary) {
    await db.apbdSummary.create({
      data: {
        year: s.year,
        pendapatanApbd: s.pendApbd,
        pendapatanApbdp: s.pendApbdp,
        belanjaApbd: s.belApbd,
        belanjaApbdp: s.belApbdp,
        terimaApbd: s.terApbd,
        terimaApbdp: s.terApbdp,
        keluarApbd: s.kelApbd,
        keluarApbdp: s.kelApbdp,
      },
    })
  }

  await db.budgetItem.deleteMany()
  for (const [section, tab, code, name, year, amount] of budgetRows) {
    await db.budgetItem.create({ data: { section, tab, code, name, year, amount } })
  }

  await db.realisasiAkun.deleteMany()
  for (const [code, name, group, level, scope, opdCode, periode, year, anggaran, realisasi] of realisasiRows) {
    await db.realisasiAkun.create({
      data: {
        code,
        name,
        group,
        level,
        scope,
        opdId: opdCode ? (opdByCode.get(opdCode) ?? null) : null,
        periode,
        year,
        anggaran,
        realisasi,
      },
    })
  }

  await db.realisasiSkpd.deleteMany()
  for (const s of skpdRows) {
    await db.realisasiSkpd.create({
      data: {
        name: s.name,
        year: s.year,
        pendapatanAnggaran: s.pendAng,
        pendapatanRealisasi: s.pendReal,
        belanjaAnggaran: s.belAng,
        belanjaRealisasi: s.belReal,
        pembiayaanAnggaran: s.pemAng,
        pembiayaanRealisasi: s.pemReal,
      },
    })
  }

  await db.realisasiSkpdPeriode.deleteMany()
  for (const s of skpdPeriodeRows) {
    await db.realisasiSkpdPeriode.create({
      data: {
        name: s.name,
        periode: s.periode,
        year: s.year,
        pendapatanAnggaran: s.pendAng,
        pendapatanRealisasi: s.pendReal,
        belanjaAnggaran: s.belAng,
        belanjaRealisasi: s.belReal,
        pembiayaanAnggaran: s.pemAng,
        pembiayaanRealisasi: s.pemReal,
      },
    })
  }

  await db.transparansiDoc.deleteMany()
  for (const [type, title] of docRows) {
    await db.transparansiDoc.create({ data: { type, title, url: '#' } })
  }

  // Penghitung pengunjung bulan berjalan
  const now = new Date()
  const month = \`\${now.getFullYear()}-\${String(now.getMonth() + 1).padStart(2, '0')}\`
  await db.visitorCounter.upsert({
    where: { month },
    update: {},
    create: { month, count: 0 },
  })

  console.log(
    'Seed selesai. Tidak ada akun bawaan — Setup Wizard first-run akan terbuka ' +
      'otomatis saat aplikasi pertama kali dijalankan untuk membuat akun admin.'
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
`)

  writeFileSync('/home/z/my-project/prisma/seed.ts', lines.join('\n'))
  console.log(
    `seed.ts ditulis: ${opds.length} OPD, ${apbd.length} APBD, ${budget.length} item anggaran, ${realisasi.length} baris realisasi, ${skpd.length}+${skpdPeriode.length} SKPD, ${docs.length} dokumen`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
