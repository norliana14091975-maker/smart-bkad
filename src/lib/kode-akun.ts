/**
 * Aturan kode rekening LRA sesuai Bagan Akun Standar (BAS) Permendagri
 * No. 77 Tahun 2020 tentang Pedoman Teknis Pengelolaan Keuangan Daerah:
 *
 * Struktur kode rekening (level):
 * - Level 1: kode akun          — 1 digit  (4 Pendapatan, 5 Belanja, 6 Pembiayaan)
 * - Level 2: kode kelompok      — 2 digit  (contoh 4.1)
 * - Level 3: kode jenis         — 4 digit  (contoh 4.1.01)
 * - Level 4: kode obyek         — 6 digit  (contoh 4.1.01.01)
 * - Level 5: kode rincian obyek — 9 digit  (contoh 4.1.01.01.001)
 *
 * Sebagian LRA warisan menulis rincian obyek dengan 2 digit terakhir
 * (contoh 4.1.01.01.01); format tersebut tetap diterima sebagai level 5.
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

// ---------------------------------------------------------------------------
// Nomenklatur baku Permendagri (akun & kelompok)
// ---------------------------------------------------------------------------

export const AKUN_STANDAR: Record<string, string> = {
  '4': 'PENDAPATAN DAERAH',
  '5': 'BELANJA DAERAH',
  '6': 'PEMBIAYAAN',
}

export const KELOMPOK_STANDAR: Record<string, string> = {
  '4.1': 'PENDAPATAN ASLI DAERAH',
  '4.2': 'PENDAPATAN TRANSFER',
  '4.3': 'LAIN-LAIN PENDAPATAN YANG SAH',
  '5.1': 'BELANJA OPERASI',
  '5.2': 'BELANJA MODAL',
  '5.3': 'BELANJA TIDAK TERDUGA',
  '5.4': 'BELANJA TRANSFER',
  '6.1': 'PENERIMAAN PEMBIAYAAN',
  '6.2': 'PENGELUARAN PEMBIAYAAN',
}

/** Nama bakuPermendagri untuk kode akun/kelompok; null bila tidak ada. */
export function standardNameFor(code: string): string | null {
  return AKUN_STANDAR[code] ?? KELOMPOK_STANDAR[code] ?? null
}

// ---------------------------------------------------------------------------
// Validasi & normalisasi kode rekening
// ---------------------------------------------------------------------------

/** Kelompok yang valid per akun sesuai BAS. */
const VALID_KELOMPOK: Record<string, string[]> = {
  '4': ['1', '2', '3'],
  '5': ['1', '2', '3', '4'],
  '6': ['1', '2'],
}

/**
 * Panjang total digit yang valid menurut struktur BAS 1-1-2-2-3:
 * 1=akun, 2=kelompok, 4=jenis, 6=obyek, 9=rincian obyek (3 digit),
 * 8=rincian obyek warisan (2 digit).
 */
const VALID_DIGIT_LENGTHS = [1, 2, 4, 6, 8, 9]

export interface NormalizedKode {
  code: string
  level: number
}

/**
 * Validasi & normalisasi satu kode rekening ke bentuk baku bertitik.
 * - Menerima kode bertitik maupun flat tanpa titik (mis. "4102" → "4.1.02").
 * - Menolak kode di luar struktur BAS: akun selain 4/5/6, kelompok tidak
 *   baku (mis. 4.4), atau jumlah digit tidak sesuai level manapun.
 * Mengembalikan null bila kode tidak valid.
 */
export function normalizeKode(raw: string): NormalizedKode | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim().replace(/\s+/g, '')
  if (!s || !/^[0-9.]+$/.test(s)) return null

  const digits = s.replace(/\./g, '')
  if (!digits) return null

  // Hanya akun 4 (Pendapatan), 5 (Belanja), 6 (Pembiayaan) yang sah di LRA
  const akun = digits[0]
  if (akun !== '4' && akun !== '5' && akun !== '6') return null

  const len = digits.length
  if (!VALID_DIGIT_LENGTHS.includes(len)) return null

  // Kelompok harus sesuai nomenklatur BAS
  if (len >= 2 && !VALID_KELOMPOK[akun].includes(digits[1])) return null

  const level = len === 1 ? 1 : len === 2 ? 2 : len === 4 ? 3 : len === 6 ? 4 : 5

  // Susun bentuk kanonik bertitik sesuai struktur 1-1-2-2-(2|3)
  const segs: string[] = [digits[0]]
  if (len >= 2) segs.push(digits[1])
  if (len >= 4) segs.push(digits.slice(2, 4))
  if (len >= 6) segs.push(digits.slice(4, 6))
  if (len >= 8) segs.push(digits.slice(6, len))

  return { code: segs.join('.'), level }
}

// ---------------------------------------------------------------------------
// Konsistensi hierarki (induk = jumlah anak, sesuai struktur LRA)
// ---------------------------------------------------------------------------

export interface KodeItem {
  code: string
  name: string
  level: number
  anggaran: number
  realisasi: number
}

/** Kode induk (prefix) dari sebuah kode rekening. */
export function prefixOf(code: string): string {
  return code.split('.').slice(0, -1).join('.')
}

/**
 * Lengkapi hierarki sesuai struktur LRA: setiap baris level >= 2 harus
 * memiliki induk. Induk yang tidak tercetak pada PDF diturunkan dari
 * penjumlahan anak langsungnya (bottom-up); nilai induk hasil turunan
 * selalu dihitung ulang bila anak baru ditemukan, sedangkan nilai induk
 * yang memang tercetak pada LRA dipertahankan apa adanya.
 */
export function applyHierarchy(items: KodeItem[]): { items: KodeItem[]; derived: number } {
  const map = new Map<string, KodeItem>()
  for (const it of items) map.set(it.code, { ...it })
  const derivedSet = new Set<string>()

  const ensureAncestors = (code: string, level: number): void => {
    if (level <= 1) return
    const parentCode = prefixOf(code)
    if (!parentCode) return

    const existing = map.get(parentCode)
    if (!existing || derivedSet.has(parentCode)) {
      // Anak langsung induk = baris pada level `level` dengan prefix tersebut
      const children = [...map.values()].filter(
        (it) => it.level === level && it.code.startsWith(`${parentCode}.`)
      )
      if (children.length > 0) {
        const anggaran = children.reduce((a, c) => a + c.anggaran, 0)
        const realisasi = children.reduce((a, c) => a + c.realisasi, 0)
        if (!existing) {
          map.set(parentCode, {
            code: parentCode,
            name: standardNameFor(parentCode) ?? '',
            level: level - 1,
            anggaran,
            realisasi,
          })
          derivedSet.add(parentCode)
        } else {
          existing.anggaran = anggaran
          existing.realisasi = realisasi
        }
      }
    }
    ensureAncestors(parentCode, level - 1)
  }

  // Proses dari level terdalam ke atas agar agregat induk selalu lengkap
  for (let lvl = 5; lvl >= 2; lvl--) {
    for (const it of [...map.values()]) {
      if (it.level === lvl) ensureAncestors(it.code, lvl)
    }
  }

  const result = [...map.values()].sort((a, b) => a.code.localeCompare(b.code))
  return { items: result, derived: derivedSet.size }
}
