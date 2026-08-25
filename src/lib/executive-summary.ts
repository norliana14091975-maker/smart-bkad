import { db } from '@/lib/db'
import { getLraSync } from '@/lib/lra-sync'
import { sumByPrefix } from '@/lib/import-lra'
import { formatPct, formatRupiah0 } from '@/lib/format'

/**
 * Ringkasan Eksekutif — kalkulasi deterministik (TANPA AI/LLM) dari data LRA
 * terimport + ringkasan APBD/SKPD untuk kebutuhan pimpinan (admin & Kepala
 * Daerah). Semua angka dihitung ulang setiap permintaan sehingga selalu
 * mengikuti data terbaru.
 */

export interface ExecKpi {
  label: string
  anggaran: number
  realisasi: number
  /** realisasi/anggaran*100, 0 bila anggaran 0 */
  pct: number
}

export interface ExecTopAkun {
  code: string
  name: string
  anggaran: number
  realisasi: number
  pct: number
}

export interface ExecOpdRow {
  name: string
  pendapatanRealisasi: number
  belanjaAnggaran: number
  belanjaRealisasi: number
  belanjaPct: number
}

export interface ExecYearRow {
  year: number
  /** pakai APBDP (anggaran perubahan) sebagai nilai terakhir */
  pendapatan: number
  belanja: number
}

export interface ExecutiveSummaryDto {
  /** false bila belum ada data LRA */
  available: boolean
  /** tahun anggaran aktif */
  year: number | null
  periode: number | null
  periodeLabel: string | null
  /** mis. "2 OPD/SKPD" atau "Konsolidasi BUD" */
  sourceLabel: string
  opdNames: string[]
  kpi: { pendapatan: ExecKpi; belanja: ExecKpi; pembiayaan: ExecKpi } | null
  /** pendapatan realisasi + penerimaan pembiayaan realisasi - belanja realisasi - pengeluaran pembiayaan realisasi */
  silpa: number | null
  /** true bila silpa < 0 */
  deficit: boolean
  /** top 5 akun jenis (level 3) kode 4.x.yy, sort anggaran desc */
  topPendapatan: ExecTopAkun[]
  /** top 5 akun jenis (level 3) kode 5.x.yy, sort anggaran desc */
  topBelanja: ExecTopAkun[]
  /** dari db.realisasiSkpd tahun aktif, sort belanjaPct desc */
  opdRows: ExecOpdRow[]
  /** dari db.apbdSummary (maks 5 tahun terakhir), pakai nilai Apbdp */
  yearRows: ExecYearRow[]
  /** 4-6 poin sorotan otomatis (template deterministik) */
  highlights: string[]
  /** ISO datetime */
  generatedAt: string
}

/** Persentase realisasi terhadap anggaran (0 bila anggaran <= 0). */
function pctOf(realisasi: number, anggaran: number): number {
  return anggaran > 0 ? (realisasi / anggaran) * 100 : 0
}

/** Bentuk KPI standar untuk kartu ringkasan. */
function makeKpi(label: string, anggaran: number, realisasi: number): ExecKpi {
  return { label, anggaran, realisasi, pct: pctOf(realisasi, anggaran) }
}

/**
 * 5 akun jenis (level 3) teratas dari baris LRA untuk kelompok rekening
 * tertentu (prefix '4' pendapatan / '5' belanja), diurutkan anggaran desc.
 */
function topAkun(
  rows: { code: string; name: string; level: number; anggaran: number; realisasi: number }[],
  prefix: '4' | '5'
): ExecTopAkun[] {
  return rows
    .filter((r) => r.level === 3 && r.code.startsWith(prefix))
    .sort((a, b) => b.anggaran - a.anggaran)
    .slice(0, 5)
    .map((r) => ({
      code: r.code,
      name: r.name,
      anggaran: r.anggaran,
      realisasi: r.realisasi,
      pct: pctOf(r.realisasi, r.anggaran),
    }))
}

/**
 * Hitung Ringkasan Eksekutif lengkap:
 * - Sumber utama: agregat LRA terimport (getLraSync, tahun terbaru).
 * - kpi.pembiayaan: total kelompok '6' (penerimaan + pengeluaran pembiayaan).
 * - SiLPA: pendapatan + penerimaan pembiayaan (6.1) - belanja - pengeluaran
 *   pembiayaan (6.2); fallback prefix '6' bila sub-kelompok tidak tersedia.
 * - opdRows: ringkasan per OPD pada tahun anggaran aktif.
 * - yearRows: APBDP tahunan (maks 5 tahun terakhir) untuk tren.
 */
export async function getExecutiveSummary(): Promise<ExecutiveSummaryDto> {
  const sync = await getLraSync()

  // Belum ada data realisasi LRA sama sekali → semua nilai kosong
  if (!sync.available) {
    return {
      available: false,
      year: null,
      periode: null,
      periodeLabel: null,
      sourceLabel: 'Belum ada data LRA',
      opdNames: [],
      kpi: null,
      silpa: null,
      deficit: false,
      topPendapatan: [],
      topBelanja: [],
      opdRows: [],
      yearRows: [],
      highlights: [],
      generatedAt: new Date().toISOString(),
    }
  }

  const rows = sync.rows
  const activeYear = sync.year

  // KPI utama per kelompok rekening (total pada level terendah yang tersedia)
  const pendapatan = makeKpi(
    'Pendapatan',
    sumByPrefix(rows, '4', 'anggaran'),
    sumByPrefix(rows, '4', 'realisasi')
  )
  const belanja = makeKpi(
    'Belanja',
    sumByPrefix(rows, '5', 'anggaran'),
    sumByPrefix(rows, '5', 'realisasi')
  )
  const pembiayaan = makeKpi(
    'Pembiayaan',
    sumByPrefix(rows, '6', 'anggaran'),
    sumByPrefix(rows, '6', 'realisasi')
  )

  // SiLPA: penerimaan pembiayaan = prefix '6.1' (fallback '6'),
  // pengeluaran pembiayaan = prefix '6.2' (fallback '6')
  const has61 = rows.some((r) => r.code === '6.1' || r.code.startsWith('6.1.'))
  const has62 = rows.some((r) => r.code === '6.2' || r.code.startsWith('6.2.'))
  const terimaRealisasi = sumByPrefix(rows, has61 ? '6.1' : '6', 'realisasi')
  const keluarRealisasi = sumByPrefix(rows, has62 ? '6.2' : '6', 'realisasi')
  const silpa =
    pendapatan.realisasi + terimaRealisasi - belanja.realisasi - keluarRealisasi

  // Ringkasan per OPD (tahun anggaran aktif) + tren APBDP tahunan (paralel)
  const [skpdRows, apbdRows] = await Promise.all([
    activeYear
      ? db.realisasiSkpd.findMany({ where: { year: activeYear } })
      : Promise.resolve([]),
    db.apbdSummary.findMany({ orderBy: { year: 'asc' } }),
  ])

  const opdRows: ExecOpdRow[] = skpdRows
    .map((r) => ({
      name: r.name,
      pendapatanRealisasi: r.pendapatanRealisasi,
      belanjaAnggaran: r.belanjaAnggaran,
      belanjaRealisasi: r.belanjaRealisasi,
      belanjaPct:
        r.belanjaAnggaran > 0 ? (r.belanjaRealisasi / r.belanjaAnggaran) * 100 : 0,
    }))
    .sort((a, b) => b.belanjaPct - a.belanjaPct)

  const yearRows: ExecYearRow[] = apbdRows.slice(-5).map((r) => ({
    year: r.year,
    pendapatan: r.pendapatanApbdp,
    belanja: r.belanjaApbdp,
  }))

  // Label sumber: agregat OPD atau konsolidasi BUD
  const sourceLabel =
    sync.mode === 'aggregate' ? `${sync.opdCount} OPD/SKPD` : 'Konsolidasi BUD'

  // ---- Poin sorotan otomatis (template deterministik, maks 6) ----
  // Label periode sudah berformat "s.d. <bulan>" sehingga template cukup
  // menyisipkannya langsung (tidak perlu awalan "s.d." lagi)
  const periodeLabel = sync.periodeLabel ?? 'periode terakhir'
  const highlights: string[] = []

  highlights.push(
    `Realisasi pendapatan ${periodeLabel} mencapai ${formatPct(pendapatan.pct)} dari anggaran Rp${formatRupiah0(pendapatan.anggaran)}.`
  )
  highlights.push(
    `Realisasi belanja ${periodeLabel} mencapai ${formatPct(belanja.pct)} dari anggaran Rp${formatRupiah0(belanja.anggaran)}.`
  )
  highlights.push(
    silpa >= 0
      ? `Posisi keuangan surplus SiLPA sebesar Rp${formatRupiah0(silpa)}.`
      : `Posisi keuangan defisit sebesar Rp${formatRupiah0(Math.abs(silpa))}.`
  )

  // OPD dengan serapan tertinggi / terendah
  if (opdRows.length > 0) {
    const best = opdRows[0]
    highlights.push(
      `Serapan belanja tertinggi: ${best.name} (${formatPct(best.belanjaPct)}).`
    )
  }
  if (opdRows.length > 1) {
    const worst = opdRows[opdRows.length - 1]
    highlights.push(
      `Serapan belanja terendah: ${worst.name} (${formatPct(worst.belanjaPct)}) — perlu perhatian.`
    )
  }

  // Belanja modal (kelompok 5.2)
  const modalAnggaran = sumByPrefix(rows, '5.2', 'anggaran')
  const modalRealisasi = sumByPrefix(rows, '5.2', 'realisasi')
  if (modalAnggaran > 0) {
    highlights.push(
      `Realisasi belanja modal ${formatPct(pctOf(modalRealisasi, modalAnggaran))} dari anggaran.`
    )
  }

  // Perbandingan YoY anggaran belanja (APBDP) bila tahun sebelumnya tersedia
  if (activeYear) {
    const prev = yearRows.find((y) => y.year === activeYear - 1)
    const curr = yearRows.find((y) => y.year === activeYear)
    if (prev && curr && prev.belanja > 0) {
      const delta = ((curr.belanja - prev.belanja) / prev.belanja) * 100
      highlights.push(
        `Anggaran belanja ${delta >= 0 ? 'naik' : 'turun'} ${formatPct(Math.abs(delta))} dibanding TA sebelumnya.`
      )
    }
  }

  return {
    available: true,
    year: sync.year,
    periode: sync.periode,
    periodeLabel: sync.periodeLabel,
    sourceLabel,
    opdNames: sync.opdNames,
    kpi: { pendapatan, belanja, pembiayaan },
    silpa,
    deficit: silpa < 0,
    topPendapatan: topAkun(rows, '4'),
    topBelanja: topAkun(rows, '5'),
    opdRows,
    yearRows,
    highlights: highlights.slice(0, 6),
    generatedAt: new Date().toISOString(),
  }
}
