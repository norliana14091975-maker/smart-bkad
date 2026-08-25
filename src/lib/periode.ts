/**
 * Periode LRA kumulatif "s.d. bulan ke-N" (1..12) — sesuai ketentuan
 * penyampaian LRA (bulanan, triwulanan, semesteran) dalam peraturan
 * pengelolaan keuangan daerah (Permendagri).
 */

export const BULAN = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const

/** Label periode: 7 → "s.d. Juli", 12 → "s.d. Desember (TA)" */
export function periodeLabel(periode: number): string {
  const n = Math.min(Math.max(Math.round(periode), 1), 12)
  return n === 12 ? 's.d. Desember (Setahun)' : `s.d. ${BULAN[n - 1]}`
}

/** Label singkat untuk kolom tabel: 7 → "Jul", 12 → "TA" */
export function periodeShort(periode: number): string {
  const n = Math.min(Math.max(Math.round(periode), 1), 12)
  return n === 12 ? 'TA' : BULAN[n - 1].slice(0, 3)
}

export interface PeriodePilihan {
  value: string
  label: string
  /** null = gabung seluruh periode (mode konsolidasi periode terpilih per OPD) */
  periode: number | null
}

/**
 * Daftar pilihan periode untuk kontrol UI:
 * - Bulanan: s.d. Januari … s.d. Desember
 * - Triwulan: TW I (Maret), TW II (Juni), TW III (September), TW IV (Desember)
 * - Semester: Semester I (Juni), Semester II (Desember)
 * - Setahun: s.d. Desember
 * - "Semua": tampilkan periode terakhir yang tersedia per OPD (konsolidasi)
 */
export function periodePilihan(): PeriodePilihan[] {
  const pilihan: PeriodePilihan[] = [
    { value: 'all', label: 'Periode Terakhir', periode: null },
    { value: 'p12', label: 'Setahun — s.d. Desember', periode: 12 },
    { value: 's1', label: 'Semester I — s.d. Juni', periode: 6 },
    { value: 's2', label: 'Semester II — s.d. Desember', periode: 12 },
    { value: 'tw1', label: 'Triwulan I — s.d. Maret', periode: 3 },
    { value: 'tw2', label: 'Triwulan II — s.d. Juni', periode: 6 },
    { value: 'tw3', label: 'Triwulan III — s.d. September', periode: 9 },
    { value: 'tw4', label: 'Triwulan IV — s.d. Desember', periode: 12 },
  ]
  // pilihan bulanan Jan..Nov (Desember sudah terwakili setahun)
  for (let n = 1; n <= 11; n++) {
    pilihan.push({ value: `p${n}`, label: `Bulanan — s.d. ${BULAN[n - 1]}`, periode: n })
  }
  return pilihan
}

/**
 * Daftar pilihan periode untuk import (kesepakatan bulan LRA):
 * setiap bulan 1..12 — LRA bulanan bersifat kumulatif s.d. bulan tersebut.
 */
export function periodePilihanImport(): PeriodePilihan[] {
  return Array.from({ length: 12 }, (_, i) => ({
    value: `p${i + 1}`,
    label: `LRA s.d. ${BULAN[i]}${i === 11 ? ' (Setahun)' : ''}`,
    periode: i + 1,
  }))
}

/**
 * Daftar pilihan tahun anggaran untuk import LRA:
 * beberapa tahun ke belakang s.d. tahun depan (LRA menyusul awal tahun).
 */
export function yearPilihanImport(): number[] {
  const now = new Date().getFullYear()
  const years: number[] = []
  for (let y = now - 4; y <= now + 1; y++) years.push(y)
  return years.reverse() // terbaru lebih dulu
}

/**
 * Deteksi TAHUN ANGGARAN dari teks LRA. Prioritas pola (paling eksplisit
 * terlebih dahulu) — semua case-insensitive:
 * 1. "TAHUN ANGGARAN 2026" / "Tahun Anggaran : 2026"
 * 2. "TA 2026" / "TA. 2026"
 * 3. Rentang periode "01 Januari 2026 Sampai 31 Juli 2026" (tahun awal)
 * 4. Kepala kolom "ANGGARAN 2026"
 * 5. "s.d. 31 Juli 2026"
 * Mengembalikan null bila tidak ditemukan (pemanggil memakai pilihan manual /
 * tahun kalender berjalan).
 */
export function detectTahun(text: string): number | null {
  const valid = (y: number | undefined): number | null =>
    y !== undefined && Number.isInteger(y) && y >= 2000 && y <= 2100 ? y : null

  // 1) "TAHUN ANGGARAN 2026" — judul standar LRA
  let m = /tah?un?\s*anggaran\s*:?\s*((?:19|20)\d{2})/i.exec(text)
  if (m) {
    const y = valid(Number(m[1]))
    if (y) return y
  }

  // 2) "TA 2026" / "TA. 2026"
  m = /\bTA\.?\s*((?:19|20)\d{2})\b/.exec(text)
  if (m) {
    const y = valid(Number(m[1]))
    if (y) return y
  }

  // 3) Rentang periode: "01 Januari 2026 Sampai 31 Juli 2026"
  m = /\d{1,2}\s+\S+\s+((?:19|20)\d{2})\s+(?:sampai|s\.?d\.?|sd\.?)/i.exec(text)
  if (m) {
    const y = valid(Number(m[1]))
    if (y) return y
  }

  // 4) Kepala kolom "ANGGARAN 2026" (bukan "REALISASI <tahun sebelumnya>")
  m = /\banggaran\s+((?:19|20)\d{2})\b/i.exec(text)
  if (m) {
    const y = valid(Number(m[1]))
    if (y) return y
  }

  // 5) "s.d. 31 Juli 2026"
  m = /(?:sampai|s\.?d\.?|sd\.?)\s*(?:tgl\.?\s*)?\d{1,2}\s+\S+\s+((?:19|20)\d{2})/i.exec(text)
  if (m) {
    const y = valid(Number(m[1]))
    if (y) return y
  }

  return null
}

/**
 * Deteksi periode dari teks LRA: cari pola "01 Januari 2026 Sampai 31 Juli 2026"
 * atau "s.d. 31 Juli 2026" / "s.d Juli 2026" — bulan akhir = periode.
 * Mengembalikan null bila tidak ditemukan (pemanggil memakai pilihan manual).
 */
export function detectPeriode(text: string): number | null {
  const bulanAlt = BULAN.map((b) => `${b}|${b.slice(0, 3)}`).join('|')
  // "31 Juli 2026" / "31 Jul 2026" setelah kata "Sampai"/"s.d."/"sd."
  const re = new RegExp(
    `(?:sampai|s\\.?d\\.?|sd\\.?)\\s*(?:tgl\\.?\\s*)?\\d{1,2}\\s+(${bulanAlt})`,
    'i'
  )
  const m = re.exec(text)
  if (m) {
    const idx = BULAN.findIndex(
      (b) => b.toLowerCase() === m[1].toLowerCase() || b.slice(0, 3).toLowerCase() === m[1].toLowerCase()
    )
    if (idx >= 0) return idx + 1
  }
  // fallback: "s.d. Juli" tanpa tanggal
  const re2 = new RegExp(`(?:sampai|s\\.?d\\.?|sd\\.?)\\s+(${bulanAlt})\\s+\\d{4}`, 'i')
  const m2 = re2.exec(text)
  if (m2) {
    const idx = BULAN.findIndex(
      (b) => b.toLowerCase() === m2[1].toLowerCase() || b.slice(0, 3).toLowerCase() === m2[1].toLowerCase()
    )
    if (idx >= 0) return idx + 1
  }
  return null
}
