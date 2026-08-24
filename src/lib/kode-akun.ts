/**
 * Aturan kode rekening LRA sesuai Bagan Akun Standar (BAS) Permendagri
 * No. 77 Tahun 2020 tentang Pedoman Teknis Pengelolaan Keuangan Daerah:
 *
 * Struktur kode rekening (level):
 * - Level 1: kode akun              — 1 digit   (4 Pendapatan, 5 Belanja, 6 Pembiayaan)
 * - Level 2: kode kelompok          — 2 digit   (contoh 4.1)
 * - Level 3: kode jenis             — 4 digit   (contoh 4.1.01)
 * - Level 4: kode obyek             — 6 digit   (contoh 4.1.01.01)
 * - Level 5: kode rincian obyek     — 9 digit   (contoh 4.1.01.01.001)
 * - Level 6: kode sub rincian obyek — 14 digit  (contoh 4.1.01.01.001.00001)
 *
 * Catatan kompatibilitas data riil (LRA SIPD):
 * - Rincian obyek warisan 2 digit (contoh 4.1.01.01.01 = 8 digit) tetap
 *   diterima sebagai level 5.
 * - Sub rincian obyek 5 digit (contoh .00001) mengikuti rincian 3 digit
 *   (total 14 digit) maupun warisan 2 digit (total 13 digit) — keduanya
 *   diterima sebagai level 6.
 */

export const LEVEL_LABELS: Record<number, string> = {
  1: 'Akun',
  2: 'Kelompok',
  3: 'Jenis',
  4: 'Obyek',
  5: 'Rincian Obyek',
  6: 'Sub Rincian Obyek',
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
const VALID_DIGIT_LENGTHS = [1, 2, 4, 6, 8, 9, 13, 14]

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

  const level =
    len === 1
      ? 1
      : len === 2
        ? 2
        : len === 4
          ? 3
          : len === 6
            ? 4
            : len === 13 || len === 14
              ? 6
              : 5

  // Susun bentuk kanonik bertitik sesuai struktur 1-1-2-2-(2|3)-(5)
  const segs: string[] = [digits[0]]
  if (len >= 2) segs.push(digits[1])
  if (len >= 4) segs.push(digits.slice(2, 4))
  if (len >= 6) segs.push(digits.slice(4, 6))
  if (len === 9 || len === 14) {
    // baku: rincian obyek 3 digit (+ sub rincian 5 digit)
    segs.push(digits.slice(6, 9))
    if (len === 14) segs.push(digits.slice(9, 14))
  } else if (len === 8 || len === 13) {
    // varian warisan: rincian obyek 2 digit (+ sub rincian 5 digit)
    segs.push(digits.slice(6, 8))
    if (len === 13) segs.push(digits.slice(8, 13))
  }

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
 * Lengkapi & rekonsiliasi hierarki sesuai struktur LRA:
 * 1. Setiap baris level >= 2 harus memiliki induk — induk yang tidak
 *    tercetak pada PDF dibuat (ditandai "derived") dengan nomenklatur baku.
 * 2. Rekonsiliasi bottom-up (matematika LRA): setiap induk yang memiliki
 *    anak langsung bernilai jumlah anak langsungnya. Pada LRA SIPD yang sah,
 *    induk memang selalu = jumlah anak, sehingga aturan ini menjaga
 *    konsistensi penuh dan menetralkan salah baca satu baris induk.
 */
export function applyHierarchy(items: KodeItem[]): { items: KodeItem[]; derived: number } {
  const map = new Map<string, KodeItem>()
  for (const it of items) map.set(it.code, { ...it })
  const derivedSet = new Set<string>()

  // 1) Buat induk yang hilang dari level terdalam ke atas
  for (let lvl = 6; lvl >= 2; lvl--) {
    for (const it of [...map.values()]) {
      if (it.level !== lvl) continue
      const parentCode = prefixOf(it.code)
      if (!parentCode || map.has(parentCode)) continue
      map.set(parentCode, {
        code: parentCode,
        name: standardNameFor(parentCode) ?? '',
        level: lvl - 1,
        anggaran: 0,
        realisasi: 0,
      })
      derivedSet.add(parentCode)
    }
  }

  // 2) Rekonsiliasi bottom-up: induk = jumlah anak langsung (bila ada anak)
  for (let lvl = 6; lvl >= 1; lvl--) {
    for (const it of [...map.values()]) {
      if (it.level !== lvl) continue
      const children = [...map.values()].filter((c) => prefixOf(c.code) === it.code)
      if (children.length > 0) {
        it.anggaran = children.reduce((a, c) => a + c.anggaran, 0)
        it.realisasi = children.reduce((a, c) => a + c.realisasi, 0)
      }
    }
  }

  const result = [...map.values()].sort((a, b) => a.code.localeCompare(b.code))
  return { items: result, derived: derivedSet.size }
}
