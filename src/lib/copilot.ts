import { db } from '@/lib/db'
import { getLraSync, type LraSyncRow } from '@/lib/lra-sync'
import { formatRupiah0 } from '@/lib/format'
import { periodeLabel as labelPeriode } from '@/lib/periode'

/**
 * AI Copilot — pembangun konteks data keuangan untuk prompt sistem.
 * Konteks dirangkai dari data terkini (LRA terimport, ringkasan APBD,
 * kinerja OPD) dalam format ringkas agar hemat token namun informatif.
 */

/** Batas jumlah akun teratas yang dimasukkan ke konteks. */
const MAX_TOP_AKUN = 8
/** Batas jumlah OPD pada konteks. */
const MAX_OPD = 12

function pct(realisasi: number, anggaran: number): string {
  if (anggaran <= 0) return '0%'
  return `${((realisasi / anggaran) * 100).toFixed(2)}%`
}

/** Jumlahkan baris level-3 (jenis) di bawah prefix tertentu. */
function sumJenis(rows: LraSyncRow[], prefix: string): { anggaran: number; realisasi: number } {
  const subset = rows.filter(
    (r) => r.level === 3 && (r.code === prefix || r.code.startsWith(`${prefix}.`))
  )
  return subset.reduce(
    (acc, r) => ({ anggaran: acc.anggaran + r.anggaran, realisasi: acc.realisasi + r.realisasi }),
    { anggaran: 0, realisasi: 0 }
  )
}

function topAkunLines(rows: LraSyncRow[], prefix: string): string[] {
  return rows
    .filter((r) => r.level === 3 && r.code.startsWith(prefix))
    .sort((a, b) => b.anggaran - a.anggaran)
    .slice(0, MAX_TOP_AKUN)
    .map(
      (r) =>
        `- ${r.code} ${r.name}: anggaran Rp${formatRupiah0(r.anggaran)}, realisasi Rp${formatRupiah0(r.realisasi)} (${pct(r.realisasi, r.anggaran)})`
    )
}

/**
 * Rakit konteks keuangan terkini sebagai teks untuk prompt sistem AI Copilot.
 * Mengembalikan null bila belum ada data LRA sama sekali.
 */
export async function buildCopilotContext(): Promise<string | null> {
  const sync = await getLraSync()
  if (!sync.available || !sync.year) return null

  const [skpdRows, apbdRows, settings] = await Promise.all([
    db.realisasiSkpd.findMany({ where: { year: sync.year } }),
    db.apbdSummary.findMany({ orderBy: { year: 'desc' }, take: 3 }),
    db.appSetting.findMany({
      where: { key: { in: ['govName', 'appName'] } },
    }),
  ])
  const settingMap = new Map(settings.map((s) => [s.key, s.value]))
  const govName = settingMap.get('govName') ?? 'Kabupaten Seruyan'

  const pendapatan = sumJenis(sync.rows, '4')
  const belanja = sumJenis(sync.rows, '5')
  const pembiayaanTerima = sumJenis(sync.rows, '6.1')
  const pembiayaanKeluar = sumJenis(sync.rows, '6.2')

  const lines: string[] = []
  lines.push(`DATA KONTEKS DASHBOARD KEUANGAN ${govName.toUpperCase()}`)
  lines.push(`Tanggal hari ini: ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(new Date())}`)
  lines.push(
    `Sumber: LRA terimport — TA ${sync.year}, periode ${labelPeriode(sync.periode ?? 12)}, ${sync.mode === 'aggregate' ? `${sync.opdCount} OPD/SKPD (${sync.opdNames.join(', ')})` : 'konsolidasi global (BUD)'}`
  )
  lines.push('')
  lines.push('RINGKASAN UTAMA (anggaran = APBDP hasil LRA):')
  lines.push(
    `- Pendapatan: anggaran Rp${formatRupiah0(pendapatan.anggaran)}, realisasi Rp${formatRupiah0(pendapatan.realisasi)} (${pct(pendapatan.realisasi, pendapatan.anggaran)})`
  )
  lines.push(
    `- Belanja: anggaran Rp${formatRupiah0(belanja.anggaran)}, realisasi Rp${formatRupiah0(belanja.realisasi)} (${pct(belanja.realisasi, belanja.anggaran)})`
  )
  lines.push(
    `- Penerimaan pembiayaan: anggaran Rp${formatRupiah0(pembiayaanTerima.anggaran)}, realisasi Rp${formatRupiah0(pembiayaanTerima.realisasi)}`
  )
  lines.push(
    `- Pengeluaran pembiayaan: anggaran Rp${formatRupiah0(pembiayaanKeluar.anggaran)}, realisasi Rp${formatRupiah0(pembiayaanKeluar.realisasi)}`
  )
  const silpa =
    pendapatan.realisasi +
    pembiayaanTerima.realisasi -
    belanja.realisasi -
    pembiayaanKeluar.realisasi
  lines.push(
    `- ${silpa >= 0 ? 'SiLPA (surplus)' : 'Defisit'}: Rp${formatRupiah0(Math.abs(silpa))}`
  )

  lines.push('')
  lines.push('AKUN PENDAPATAN TERATAS (level jenis):')
  lines.push(...topAkunLines(sync.rows, '4'))
  lines.push('')
  lines.push('AKUN BELANJA TERATAS (level jenis):')
  lines.push(...topAkunLines(sync.rows, '5'))

  if (skpdRows.length > 0) {
    lines.push('')
    lines.push('KINERJA OPD/SKPD (realisasi belanja):')
    for (const s of skpdRows.slice(0, MAX_OPD)) {
      lines.push(
        `- ${s.name}: anggaran Rp${formatRupiah0(s.belanjaAnggaran)}, realisasi Rp${formatRupiah0(s.belanjaRealisasi)} (${pct(s.belanjaRealisasi, s.belanjaAnggaran)})`
      )
    }
  }

  if (apbdRows.length > 0) {
    lines.push('')
    lines.push('RINGKASAN APBD TAHUN TERAKHIR (APBD murni / APBDP):')
    for (const r of apbdRows) {
      lines.push(
        `- TA ${r.year}: pendapatan Rp${formatRupiah0(r.pendapatanApbd)} / Rp${formatRupiah0(r.pendapatanApbdp)}; belanja Rp${formatRupiah0(r.belanjaApbd)} / Rp${formatRupiah0(r.belanjaApbdp)}`
      )
    }
  }

  return lines.join('\n')
}

/** Prompt sistem AI Copilot (Bahasa Indonesia). */
export function copilotSystemPrompt(context: string | null, role: string): string {
  const base = [
    'Anda adalah "AI Copilot" pada dashboard monitoring pengelolaan keuangan daerah Kabupaten Seruyan (Kalimantan Tengah, Indonesia).',
    `Anda melayani pengguna dengan peran: ${role === 'kepala_daerah' ? 'Kepala Daerah (Bupati)' : 'Admin dashboard'}.`,
    '',
    'TUGAS ANDA:',
    '- Menjawab pertanyaan tentang kondisi keuangan daerah: realisasi pendapatan/belanja/pembiayaan, kinerja OPD/SKPD, SiLPA, tren APBD, dan risiko.',
    '- Membantu menyusun ringkasan/narasi untuk rapat atau laporan pimpinan.',
    '- Memberikan analisis dan rekomendasi kebijakan yang praktis dalam konteks pemerintahan daerah Indonesia.',
    '',
    'ATURAN JAWABAN:',
    '- WAJIB berbahasa Indonesia yang baik, formal namun mudah dipahami pimpinan.',
    '- Gunakan HANYA data konteks yang diberikan; jangan mengarang angka. Bila data tidak tersedia dalam konteks, katakan terus terang dan sarankan mengimpor LRA terbaru.',
    '- Format angka gaya Indonesia (titik ribuan), sebutkan "Rp" dan persentase dengan 2 desimal bila relevan.',
    '- Susun jawaban ringkas dan terstruktur: gunakan poin/bullet untuk jawaban panjang (maks ~300 kata). Bila cocok, akhiri dengan rekomendasi tindak lanjut.',
    '- Angka realisasi bersifat kumulatif s.d. periode yang tercantum pada konteks — sebutkan periode saat membahas realisasi.',
  ]
  if (context) {
    base.push('', '===', context, '===')
  } else {
    base.push(
      '',
      'PENTING: Saat ini belum ada data LRA yang terimport ke sistem. Jawab bahwa data keuangan belum tersedia dan sarankan mengimpor LRA melalui menu admin terlebih dahulu.'
    )
  }
  return base.join('\n')
}
