/**
 * Klasifikasi kode rekening sesuai struktur Permendagri:
 * - Level 1 (satu)   : kode akun          (contoh: 4)
 * - Level 2 (dua)    : kode kelompok      (contoh: 4.1)
 * - Level 3 (tiga)   : kode jenis         (contoh: 4.1.01)
 * - Level 4 (empat)  : kode obyek         (contoh: 4.1.01.01)
 * - Level 5 (lima)   : kode rincian obyek (contoh: 4.1.01.01.01)
 */

export const LEVEL_LABELS: Record<number, string> = {
  1: 'Akun',
  2: 'Kelompok',
  3: 'Jenis',
  4: 'Obyek',
  5: 'Rincian Obyek',
}

/** Label singkat untuk badge, mis. "L3 · Jenis". */
export function levelBadge(level: number): string {
  return `L${level} · ${LEVEL_LABELS[level] ?? '?'}`
}

/**
 * Tentukan level kode rekening dari jumlah segmennya.
 * "4" → 1, "4.1" → 2, "4.1.01" → 3, dst. (maksimum 5).
 */
export function codeLevel(code: string): number {
  const segs = code
    .split('.')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && /^\d+$/.test(s))
  return Math.min(Math.max(segs.length, 1), 5)
}
