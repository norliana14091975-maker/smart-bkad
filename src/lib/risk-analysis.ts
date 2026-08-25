import { db } from '@/lib/db'
import { getLraSync, lraTotal } from '@/lib/lra-sync'
import { formatPct, formatRupiah0 } from '@/lib/format'

/**
 * Analisis Risiko pengelolaan keuangan daerah — SEPENUHNYA DETERMINISTIK
 * (tanpa AI): seluruh skor dihitung dari data LRA terimport, ringkasan
 * realisasi SKPD, dan ringkasan APBD dengan aturan ambang baku.
 */

export type RiskLevel = 'rendah' | 'sedang' | 'tinggi'

export interface RiskItem {
  id: string
  /** Kategori indikator, mis. "Realisasi Pendapatan" */
  category: string
  title: string
  level: RiskLevel
  /** 0-100 (semakin tinggi semakin berisiko) */
  score: number
  /** Narasi situasi dengan angka */
  description: string
  /** Rekomendasi mitigasi */
  recommendation: string
  /** Metrik pendukung (maks. 4 baris) */
  detail: { label: string; value: string }[]
}

export interface RiskAnalysisDto {
  available: boolean
  year: number | null
  periode: number | null
  periodeLabel: string | null
  /** Rata-rata tertimbang seluruh indikator (0-100) */
  overallScore: number
  overallLevel: RiskLevel
  /** Kesimpulan 1-2 kalimat */
  summary: string
  items: RiskItem[]
  /** OPD dengan serapan belanja di bawah target periode */
  opdWatchlist: { name: string; belanjaPct: number; level: RiskLevel }[]
  generatedAt: string
}

/** Ambang skor → tingkat risiko: ≥65 tinggi, ≥40 sedang, sisanya rendah. */
export function levelFromScore(score: number): RiskLevel {
  if (score >= 65) return 'tinggi'
  if (score >= 40) return 'sedang'
  return 'rendah'
}

/** Pembulatan skor ke rentang 0..100. */
const clampScore = (n: number): number => Math.round(Math.max(0, Math.min(100, n)))

/**
 * Skor risiko LAJU REALISASI terhadap target pace periode.
 * ratio = %realisasi / %target (realisasi kumulatif s.d. periode N
 * seharusnya ≈ N/12 dari anggaran). ratio ≥ 1,15 → skor 0 (aman);
 * ratio 0,5 → skor 100 (sangat tertinggal).
 */
const paceScore = (ratio: number): number => clampScore((1.15 - ratio) * 160)

/** Format deviasi dalam poin persentase (pp), mis. "-38,97 pp". */
const fmtPp = (v: number): string =>
  `${new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v)} pp`

/** Label tingkat risiko untuk kalimat ringkasan. */
const LEVEL_WORD: Record<RiskLevel, string> = {
  rendah: 'rendah',
  sedang: 'sedang',
  tinggi: 'tinggi',
}

/**
 * Bobot indikator pada skor keseluruhan: realisasi pendapatan & belanja
 * berbobot 2 (inti fiskal), indikator lain berbobot 1.
 */
const ITEM_WEIGHT: Record<string, number> = {
  'realisasi-pendapatan': 2,
  'realisasi-belanja': 2,
}

/**
 * Hitung analisis risiko lengkap dari data terkini:
 * - getLraSync(): agregat LRA tahun anggaran terbaru (per akun)
 * - db.realisasiSkpd: serapan belanja per OPD pada tahun aktif
 * - db.apbdSummary: disiplin anggaran (perubahan belanja APBDP antar-tahun)
 */
export async function getRiskAnalysis(): Promise<RiskAnalysisDto> {
  const sync = await getLraSync()

  // Belum ada data realisasi LRA sama sekali → seksi menampilkan pesan kosong
  if (!sync.available || !sync.year || !sync.periode) {
    return {
      available: false,
      year: null,
      periode: null,
      periodeLabel: null,
      overallScore: 0,
      overallLevel: 'rendah',
      summary: '',
      items: [],
      opdWatchlist: [],
      generatedAt: new Date().toISOString(),
    }
  }

  const year = sync.year
  const periode = sync.periode
  const periodeLabel = sync.periodeLabel ?? `s.d. periode ${periode}`
  const rows = sync.rows

  // Target pace: realisasi kumulatif s.d. periode N seharusnya ≈ N/12 anggaran
  const expectedPct = (periode / 12) * 100
  const items: RiskItem[] = []

  // ── Nilai dasar dari LRA (anggaran = pagu APBDP hasil import) ──────────
  const pendAnggaran = lraTotal(rows, '4', 'anggaran')
  const pendRealisasi = lraTotal(rows, '4', 'realisasi') ?? 0
  const belAnggaran = lraTotal(rows, '5', 'anggaran')
  const belRealisasi = lraTotal(rows, '5', 'realisasi') ?? 0

  // 1) Laju realisasi pendapatan ────────────────────────────────────────────
  if (pendAnggaran !== null && pendAnggaran > 0) {
    const pct = (pendRealisasi / pendAnggaran) * 100
    const ratio = pct / expectedPct
    const score = paceScore(ratio)
    items.push({
      id: 'realisasi-pendapatan',
      category: 'Realisasi Pendapatan',
      title: 'Laju Realisasi Pendapatan',
      level: levelFromScore(score),
      score,
      description: `Realisasi pendapatan kumulatif ${periodeLabel} mencapai ${formatPct(
        pct
      )} dari anggaran Rp ${formatRupiah0(pendAnggaran)} — ${pct >= expectedPct ? 'di atas' : 'di bawah'} target pace periode ${formatPct(
        expectedPct
      )} (rasio pencapaian ${formatPct(ratio * 100)}).`,
      recommendation:
        pct >= expectedPct
          ? 'Pertahankan tren penagihan pajak dan retribusi; waspadai pelambatan penerimaan pada bulan sisa serta tetap pantau pos pendapatan yang belum terealisasi.'
          : 'Intensifikasi penagihan PAD (pajak daerah, retribusi, pemanfaatan aset) dan percepatan pencairan dana transfer yang belum masuk agar target tahunan tetap tercapai.',
      detail: [
        { label: 'Anggaran', value: `Rp ${formatRupiah0(pendAnggaran)}` },
        { label: 'Realisasi', value: `Rp ${formatRupiah0(pendRealisasi)}` },
        { label: '% Realisasi', value: formatPct(pct) },
        { label: `% Target s.d. periode ${periode}`, value: formatPct(expectedPct) },
      ],
    })
  }

  // 2) Laju realisasi belanja ───────────────────────────────────────────────
  if (belAnggaran !== null && belAnggaran > 0) {
    const pct = (belRealisasi / belAnggaran) * 100
    const ratio = pct / expectedPct
    const deviasi = pct - expectedPct
    const score = paceScore(ratio)
    items.push({
      id: 'realisasi-belanja',
      category: 'Realisasi Belanja',
      title: 'Laju Realisasi Belanja',
      level: levelFromScore(score),
      score,
      description: `Realisasi belanja kumulatif ${periodeLabel} baru ${formatPct(
        pct
      )} dari anggaran Rp ${formatRupiah0(belAnggaran)}, ${pct >= expectedPct ? 'di atas' : 'di bawah'} target pace ${formatPct(
        expectedPct
      )} (deviasi ${fmtPp(deviasi)}).`,
      recommendation:
        pct >= expectedPct
          ? 'Kendalikan pace belanja agar tidak terjadi lonjakan realisasi pada triwulan akhir; verifikasi kesesuaian belanja dengan prioritas program.'
          : 'Percepat eksekusi belanja: selesaikan proses lelang/pengadaan yang tertunda, tindak lanjuti kontrak belum jalan, dan lakukan evaluasi bulanan pagu yang belum terserap.',
      detail: [
        { label: 'Anggaran', value: `Rp ${formatRupiah0(belAnggaran)}` },
        { label: 'Realisasi', value: `Rp ${formatRupiah0(belRealisasi)}` },
        { label: '% Realisasi', value: formatPct(pct) },
        { label: 'Deviasi vs target', value: fmtPp(deviasi) },
      ],
    })
  }

  // 3) Belanja modal (kelompok rekening 5.2) ───────────────────────────────
  const modalAnggaran = lraTotal(rows, '5.2', 'anggaran')
  if (modalAnggaran !== null && modalAnggaran > 0) {
    const modalRealisasi = lraTotal(rows, '5.2', 'realisasi') ?? 0
    const pct = (modalRealisasi / modalAnggaran) * 100
    const ratio = pct / expectedPct
    const score = paceScore(ratio)
    items.push({
      id: 'realisasi-belanja-modal',
      category: 'Belanja Modal',
      title: 'Serapan Belanja Modal',
      level: levelFromScore(score),
      score,
      description: `Realisasi belanja modal (rekening 5.2) ${periodeLabel} sebesar ${formatPct(
        pct
      )} dari pagu Rp ${formatRupiah0(modalAnggaran)} — ${pct >= expectedPct ? 'sesuai' : 'jauh di bawah'} target pace ${formatPct(
        expectedPct
      )} (deviasi ${fmtPp(pct - expectedPct)}).`,
      recommendation:
        'Percepat lelang/pengadaan belanja modal (aset tetap, gedung bangunan, mesin dan peralatan); evaluasi hambatan administrasi pengadaan agar konstruksi masih punya waktu memadai sebelum akhir tahun anggaran.',
      detail: [
        { label: 'Anggaran', value: `Rp ${formatRupiah0(modalAnggaran)}` },
        { label: 'Realisasi', value: `Rp ${formatRupiah0(modalRealisasi)}` },
        { label: '% Realisasi', value: formatPct(pct) },
      ],
    })
  }

  // 4) Konsentrasi / ketergantungan dana transfer ──────────────────────────
  if (pendAnggaran !== null && pendAnggaran > 0) {
    const padAnggaran = lraTotal(rows, '4.1', 'anggaran') ?? 0
    const transferAnggaran = lraTotal(rows, '4.2', 'anggaran')
    if (transferAnggaran !== null) {
      const share = (transferAnggaran / pendAnggaran) * 100
      const score = share <= 50 ? 10 : share <= 70 ? 40 : share <= 85 ? 65 : 90
      const padShare = (padAnggaran / pendAnggaran) * 100
      const lainnya = pendAnggaran - padAnggaran - transferAnggaran
      const lainnyaShare = 100 - padShare - share
      items.push({
        id: 'konsentrasi-pendapatan',
        category: 'Struktur Pendapatan',
        title: 'Ketergantungan Dana Transfer',
        level: levelFromScore(score),
        score,
        description: `Dana transfer (rekening 4.2) menyumbang ${formatPct(
          share
        )} dari total anggaran pendapatan, sedangkan PAD hanya ${formatPct(
          padShare
        )} — struktur pendapatan ${share > 70 ? 'sangat tergantung' : 'cukup tergantung'} pada kebijakan fiskal pusat/provinsi.`,
        recommendation:
          'Intensifikasi penerimaan PAD melalui pemutakhiran basis data pajak, optimalisasi retribusi daerah, dan pemanfaatan aset daerah agar ketergantungan pada dana transfer berkurang.',
        detail: [
          {
            label: 'PAD (4.1)',
            value: `Rp ${formatRupiah0(padAnggaran)} (${formatPct(padShare)})`,
          },
          {
            label: 'Transfer (4.2)',
            value: `Rp ${formatRupiah0(transferAnggaran)} (${formatPct(share)})`,
          },
          {
            label: 'Lainnya (4.3 dst.)',
            value: `Rp ${formatRupiah0(lainnya)} (${formatPct(lainnyaShare)})`,
          },
        ],
      })
    }
  }

  // 5) Posisi fiskal / SiLPA kumulatif ─────────────────────────────────────
  {
    const terimaPembiayaan = lraTotal(rows, '6.1', 'realisasi') ?? lraTotal(rows, '6', 'realisasi') ?? 0
    const keluarPembiayaan = lraTotal(rows, '6.2', 'realisasi') ?? 0
    const silpa = pendRealisasi + terimaPembiayaan - belRealisasi - keluarPembiayaan
    const score = silpa > 0 ? 15 : silpa === 0 ? 35 : 85
    items.push({
      id: 'silkas-defisit',
      category: 'Posisi Fiskal',
      title: 'Posisi Fiskal (Estimasi SiLPA)',
      level: levelFromScore(score),
      score,
      description: `Posisi fiskal kumulatif ${periodeLabel} ${
        silpa > 0 ? 'SURPLUS' : silpa === 0 ? 'SEIMBANG' : 'DEFISIT'
      }: pendapatan + penerimaan pembiayaan (Rp ${formatRupiah0(
        pendRealisasi + terimaPembiayaan
      )}) ${silpa >= 0 ? 'melebihi' : 'kurang dari'} belanja + pengeluaran pembiayaan (Rp ${formatRupiah0(
        belRealisasi + keluarPembiayaan
      )}) sehingga estimasi SiLPA Rp ${formatRupiah0(silpa)}.`,
      recommendation:
        silpa >= 0
          ? 'Manfaatkan surplus secara tertib: prioritaskan percepatan belanja produktif dan pelunasan kewajiban agar tidak menumpuk menjadi SiLPA besar pada akhir tahun.'
          : 'Kendalikan defisit: batasi belanja non-prioritas, percepat penerimaan, dan sinkronkan penjadwalan pembiayaan sebelum posisi kas semakin tertekan.',
      detail: [
        { label: 'Pendapatan (realisasi)', value: `Rp ${formatRupiah0(pendRealisasi)}` },
        { label: 'Belanja (realisasi)', value: `Rp ${formatRupiah0(belRealisasi)}` },
        {
          label: 'Pembiayaan bersih',
          value: `Rp ${formatRupiah0(terimaPembiayaan - keluarPembiayaan)}`,
        },
        { label: 'Estimasi SiLPA', value: `Rp ${formatRupiah0(silpa)}` },
      ],
    })
  }

  // 6) Kinerja OPD: serapan belanja per SKPD pada tahun aktif ─────────────
  const skpdRows = await db.realisasiSkpd.findMany({ where: { year } })
  const opdSerapan = skpdRows
    .map((s) => ({
      name: s.name,
      pct: s.belanjaAnggaran > 0 ? (s.belanjaRealisasi / s.belanjaAnggaran) * 100 : null,
    }))
    .filter((s): s is { name: string; pct: number } => s.pct !== null)

  if (opdSerapan.length > 0) {
    const worst = opdSerapan.reduce((min, s) => (s.pct < min.pct ? s : min))
    const avg = opdSerapan.reduce((a, s) => a + s.pct, 0) / opdSerapan.length
    const score =
      worst.pct < expectedPct ? clampScore((expectedPct - worst.pct) * 1.6 + 10) : 10
    items.push({
      id: 'serapan-opd',
      category: 'Kinerja OPD',
      title: 'Ketimpangan Serapan Belanja OPD',
      level: levelFromScore(score),
      score,
      description: `Dari ${opdSerapan.length} OPD pelapor, serapan belanja terendah ${formatPct(
        worst.pct
      )} (${worst.name}) dengan rata-rata ${formatPct(
        avg
      )}, sementara target pace periode ini ${formatPct(expectedPct)}.`,
      recommendation:
        'Lakukan monitoring mingguan terhadap OPD dengan serapan di bawah 50% target; minta rencana aksi percepatan belanja dan bedah hambatan pengadaan bersama BKAD/UKPBJ.',
      detail: [
        { label: 'OPD terendah', value: worst.name },
        { label: '% terendah', value: formatPct(worst.pct) },
        { label: 'Rata-rata serapan', value: formatPct(avg) },
        { label: 'Jumlah OPD', value: String(opdSerapan.length) },
      ],
    })
  }

  // 7) Disiplin anggaran: perubahan belanja APBDP antar-tahun ─────────────
  {
    const [apbdNow, apbdPrev] = await Promise.all([
      db.apbdSummary.findUnique({ where: { year } }),
      db.apbdSummary.findUnique({ where: { year: year - 1 } }),
    ])
    // Bila tidak ada tahun pembanding → indikator dilewati (tidak dihitung)
    if (apbdNow && apbdPrev && apbdPrev.belanjaApbdp > 0) {
      const naikPct = ((apbdNow.belanjaApbdp - apbdPrev.belanjaApbdp) / apbdPrev.belanjaApbdp) * 100
      const score = naikPct > 30 ? 70 : naikPct > 15 ? 50 : naikPct > 0 ? 30 : 20
      items.push({
        id: 'deviasi-apbdp',
        category: 'Disiplin Anggaran',
        title: 'Perubahan Belanja APBDP',
        level: levelFromScore(score),
        score,
        description: `Belanja APBDP TA ${year} ${naikPct >= 0 ? 'naik' : 'turun'} ${formatPct(
          Math.abs(naikPct)
        )} dibanding TA ${year - 1} (Rp ${formatRupiah0(
          apbdPrev.belanjaApbdp
        )} menjadi Rp ${formatRupiah0(apbdNow.belanjaApbdp)}) — ${naikPct > 15 ? 'kenaikan signifikan yang perlu diantisipasi keberlanjutan pendanannya' : 'perubahan masih dalam batas wajar'}.`,
        recommendation:
          'Perketat disiplin anggaran: kendalikan pergeseran dan pertambahan belanja pada APBD perubahan, prioritaskan belanja wajib (gaji, bunga, subsidi) serta program prioritas daerah.',
        detail: [
          { label: `Belanja APBDP TA ${year}`, value: `Rp ${formatRupiah0(apbdNow.belanjaApbdp)}` },
          {
            label: `Belanja APBDP TA ${year - 1}`,
            value: `Rp ${formatRupiah0(apbdPrev.belanjaApbdp)}`,
          },
          { label: 'Perubahan', value: `${naikPct >= 0 ? '+' : '-'}${formatPct(Math.abs(naikPct))}` },
        ],
      })
    }
  }

  // 8) Ketergantungan pembiayaan ────────────────────────────────────────────
  const hasPembiayaan = rows.some((r) => r.code === '6' || r.code.startsWith('6.'))
  if (hasPembiayaan && pendRealisasi > 0) {
    const terimaPembiayaan = lraTotal(rows, '6.1', 'realisasi') ?? lraTotal(rows, '6', 'realisasi') ?? 0
    const keluarPembiayaan = lraTotal(rows, '6.2', 'realisasi') ?? 0
    const rasio = (keluarPembiayaan / pendRealisasi) * 100
    const score = rasio <= 10 ? 15 : rasio <= 25 ? 45 : rasio <= 40 ? 70 : 90
    items.push({
      id: 'pembiayaan',
      category: 'Pembiayaan',
      title: 'Ketergantungan Pembiayaan',
      level: levelFromScore(score),
      score,
      description: `Pengeluaran pembiayaan (penyaluran/pembayaran kembali) setara ${formatPct(
        rasio
      )} dari pendapatan realisasi — ${rasio <= 10 ? 'proporsi masih sehat' : 'proporsi mulai membebani kas daerah'}${
        terimaPembiayaan === 0
          ? '; penerimaan pembiayaan belum terealisasi sama sekali sehingga arus kas perlu diawasi ketat'
          : ''
      }.`,
      recommendation:
        'Jaga proporsi pembiayaan tetap wajar dan hanya untuk penutupan kebutuhan kas sementara; hindari pembiayaan baru untuk belanja operasional serta pantau jatuh tempo pinjaman daerah.',
      detail: [
        { label: 'Penerimaan pembiayaan (realisasi)', value: `Rp ${formatRupiah0(terimaPembiayaan)}` },
        { label: 'Pengeluaran pembiayaan (realisasi)', value: `Rp ${formatRupiah0(keluarPembiayaan)}` },
        { label: 'Pendapatan (realisasi)', value: `Rp ${formatRupiah0(pendRealisasi)}` },
        { label: 'Rasio pembiayaan', value: formatPct(rasio) },
      ],
    })
  }

  // ── Skor keseluruhan: rata-rata tertimbang ─────────────────────────────
  let overallScore = 0
  if (items.length > 0) {
    const wSum = items.reduce((a, i) => a + (ITEM_WEIGHT[i.id] ?? 1), 0)
    const sSum = items.reduce((a, i) => a + i.score * (ITEM_WEIGHT[i.id] ?? 1), 0)
    overallScore = wSum > 0 ? Math.round(sSum / wSum) : 0
  }
  const overallLevel = levelFromScore(overallScore)

  const tinggi = items.filter((i) => i.level === 'tinggi')
  const summary =
    `Tingkat risiko keseluruhan ${LEVEL_WORD[overallLevel]} (skor ${overallScore}/100). ` +
    (tinggi.length > 0
      ? `${tinggi.length} dari ${items.length} indikator berstatus tinggi — ${tinggi
          .map((i) => i.category)
          .join(', ')}.`
      : items.length > 0
        ? `Tidak ada indikator berstatus tinggi dari ${items.length} indikator yang dipantau.`
        : 'Belum ada indikator yang dapat dihitung.')

  // ── OPD watchlist: serapan di bawah target pace, terendah lebih dulu ──
  const opdWatchlist = opdSerapan
    .filter((s) => s.pct < expectedPct)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 10)
    .map((s) => ({
      name: s.name,
      belanjaPct: Math.round(s.pct * 100) / 100,
      level:
        s.pct < expectedPct / 2 ? ('tinggi' as RiskLevel) : s.pct < expectedPct ? ('sedang' as RiskLevel) : ('rendah' as RiskLevel),
    }))

  return {
    available: true,
    year,
    periode,
    periodeLabel,
    overallScore,
    overallLevel,
    summary,
    items,
    opdWatchlist,
    generatedAt: new Date().toISOString(),
  }
}
