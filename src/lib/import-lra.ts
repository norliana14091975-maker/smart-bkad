import fs from 'fs'
import path from 'path'
import { db } from '@/lib/db'
import { applyHierarchy, normalizeKode, standardNameFor } from '@/lib/kode-akun'

// ---------------------------------------------------------------------------
// Konstanta import LRA
// ---------------------------------------------------------------------------

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
export const MIN_TEXT_LENGTH = 50 // lebih pendek dari ini dianggap PDF hasil scan

/** Item LRA hasil ekstraksi, sudah diklasifikasi per level kode. */
export interface LraItem {
  code: string
  name: string
  anggaran: number
  realisasi: number
  /** 1=akun, 2=kelompok, 3=jenis, 4=obyek, 5=rincian obyek */
  level: number
}

/** Statistik penerapan aturan BAS pada hasil ekstraksi. */
export interface ExtractStats {
  valid: number
  dropped: number
  derived: number
  droppedExamples: string[]
}

export interface ExtractResult {
  items: LraItem[]
  stats: ExtractStats
}

/** Scope penyimpanan: 'global' (konsolidasi) atau 'opd:<id>'. */
export function scopeFor(opdId: number | null): string {
  return opdId ? `opd:${opdId}` : 'global'
}

// ---------------------------------------------------------------------------
// Utilitas parsing angka & item
// ---------------------------------------------------------------------------

/**
 * Ubah nilai (number/string) menjadi angka polos.
 * Mendukung format Indonesia: "49.898.218.773.411,00" → 49898218773411,
 * nilai negatif dalam tanda kurung (format LRA) maupun bertanda minus.
 */
function parseLooseNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null

  let s = value.trim().replace(/^rp\.?\s*/i, '').replace(/\s|\u00a0/g, '')
  if (!s) return null

  // Negatif: tanda kurung (konvensi laporan keuangan) atau minus
  const negative =
    (s.startsWith('(') && s.endsWith(')')) || s.startsWith('-')
  if (s.startsWith('(') && s.endsWith(')')) s = s.slice(1, -1)
  if (s.startsWith('-')) s = s.slice(1)
  if (!/^\d+(\.\d+)*(,\d+)*$/.test(s)) return null

  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')

  if (lastDot !== -1 && lastComma !== -1) {
    if (lastComma > lastDot) {
      // 1.234.567,89 → koma desimal (format Indonesia)
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      // 1,234,567.89 → titik desimal (format Inggris)
      s = s.replace(/,/g, '')
    }
  } else if (lastComma !== -1) {
    s = s.replace(',', '.')
  } else if (lastDot !== -1 && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    // Hanya titik dengan kelompok 3 digit: pemisah ribuan
    s = s.replace(/\./g, '')
  }

  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return negative ? -n : n
}

/**
 * Validasi satu entri item LRA (objek dari hasil parse/frontend) menurut
 * aturan BAS Permendagri: kode dinormalisasi ke bentuk baku (bertitik/flat
 * diterima), nama akun/kelompok dinormalkan ke nomenklatur baku, anggaran
 * tidak boleh negatif, realisasi boleh negatif (koreksi LRA).
 */
function normalizeItem(entry: unknown): LraItem | null {
  if (typeof entry !== 'object' || entry === null) return null
  const e = entry as Record<string, unknown>

  const codeRaw =
    typeof e.code === 'string' ? e.code : typeof e.code === 'number' ? String(e.code) : ''

  const normalized = normalizeKode(codeRaw)
  if (!normalized) return null

  const anggaran = parseLooseNumber(e.anggaran)
  const realisasi = parseLooseNumber(e.realisasi)
  if (anggaran === null || realisasi === null) return null
  if (anggaran < 0) return null

  let name =
    typeof e.name === 'string' ? e.name.trim() : e.name != null ? String(e.name).trim() : ''
  // Nomenklatur baku Permendagri untuk level akun & kelompok
  const stdName = standardNameFor(normalized.code)
  if (stdName) name = stdName

  return { code: normalized.code, name, anggaran, realisasi, level: normalized.level }
}

// ---------------------------------------------------------------------------
// Ekstraksi teks PDF
// ---------------------------------------------------------------------------

/** Baca teks PDF memakai pdf-parse (worker diarahkan ke path absolut). */
export async function extractPdfText(buffer: Buffer): Promise<{ text: string; pages: number }> {
  const { PDFParse } = await import('pdf-parse')
  // Arahkan worker pdfjs ke path absolut (di bundler Turbopack resolusi
  // relatif "pdf.worker.mjs" gagal karena diarahkan ke folder .next).
  const workerPath = path.join(
    process.cwd(),
    'node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'
  )
  if (fs.existsSync(workerPath)) {
    PDFParse.setWorker(workerPath)
  }
  const parser = new PDFParse({ data: new Uint8Array(buffer) })
  try {
    const result = await parser.getText()
    return { text: result.text ?? '', pages: result.total ?? result.pages?.length ?? 0 }
  } finally {
    await parser.destroy().catch(() => undefined)
  }
}

// ---------------------------------------------------------------------------
// Parser deterministik LRA (tanpa AI)
// ---------------------------------------------------------------------------

/**
 * Pola angka moneter/persen format Indonesia pada LRA:
 * "10.000.000,00", "3.311.202.831,00", "0,00", "53,64", "1.234.567".
 * Angka biasa tanpa koma desimal/pemisah ribuan (mis. "3" pada nama
 * "Pajak Hotel Bintang 3") sengaja TIDAK cocok agar tidak terbaca nilai.
 */
const NUMBER_RE = /\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+,\d{1,2}/g

/** Baris data LRA: diawali kode rekening lalu uraian. */
const CODE_LINE_RE = /^(\d[\d.]*)\s+(.*)$/

/** Baris non-data yang dilewati (judul, kepala kolom, penanda halaman, dst). */
function isNoiseLine(line: string): boolean {
  if (!line) return true
  if (line.startsWith('--') || /\bof\b\s*\d+\s*--$/.test(line)) return true // -- 1 of 2 --
  if (/^kode\s+rekening/i.test(line)) return true
  if (/^pemerintahan\b|^kab(upaten)?\.|^kecamatan\b|^provinsi\b/i.test(line)) return true
  if (/^laporan\s+realisasi\b/i.test(line)) return true
  if (/^tahun\s+anggaran\b/i.test(line)) return true
  if (/^\d{1,2}\s+\w+\s+\d{4}\s+sampai/i.test(line)) return true // "01 Januari 2026 Sampai ..."
  return false
}

/**
 * Uraikan teks LRA menjadi baris rekening secara deterministik:
 * - kode rekening di awal baris (bertitik/flat) + uraian + kolom angka
 * - kolom ANGGARAN (tahun berjalan) dan REALISASI (tahun berjalan) adalah
 *   dua angka pertama pada baris; kolom persen & realisasi tahun sebelumnya
 *   diabaikan
 * - uraian yang terlipat (wrap) ke baris berikut digabungkan
 * - baris JUMLAH/subtotal dan judul dilewati
 * Kode kemudian divalidasi normalizeKode (aturan BAS Permendagri).
 */
export function parseLraRows(text: string): {
  rows: LraItem[]
  dropped: number
  droppedExamples: string[]
} {
  const lines = text.split(/\r?\n/).map((l) => l.trim())
  const rows = new Map<string, LraItem>()
  let dropped = 0
  const droppedExamples: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (isNoiseLine(line)) continue

    const m = CODE_LINE_RE.exec(line)
    if (!m) continue
    const codeRaw = m[1]

    // Kumpulkan angka dari sisa baris, plus baris lanjutan bila nilai
    // terlipat ke baris berikutnya (urungan nama / kolom angka terpisah).
    let rest = m[2]
    let nums = rest.match(NUMBER_RE) ?? []
    let j = i
    while (nums.length < 2 && j + 1 < lines.length) {
      const next = lines[j + 1]
      if (
        isNoiseLine(next) ||
        CODE_LINE_RE.test(next) ||
        next.toUpperCase().startsWith('JUMLAH')
      ) {
        break
      }
      nums = nums.concat(next.match(NUMBER_RE) ?? [])
      rest += ` ${next}`
      j++
    }
    // Baris data tanpa nilai angka → bukan baris rekening LRA
    if (nums.length < 2) {
      i = j
      continue
    }

    const anggaran = parseLooseNumber(nums[0])
    const realisasi = parseLooseNumber(nums[1])
    if (anggaran === null || realisasi === null || anggaran < 0) {
      i = j
      continue
    }

    // Nama rekening = teks sebelum angka pertama
    let name = rest
    const firstNum = rest.match(NUMBER_RE)
    if (firstNum) {
      const idx = rest.indexOf(firstNum[0])
      if (idx >= 0) name = rest.slice(0, idx)
    }
    name = name.replace(/\s+/g, ' ').trim()

    const normalized = normalizeKode(codeRaw)
    if (!normalized) {
      // Kode di luar struktur BAS — hanya hitung bila mirip kode LRA (4-9)
      if (/^[4-9]/.test(codeRaw)) {
        dropped += 1
        if (droppedExamples.length < 5 && !droppedExamples.includes(codeRaw)) {
          droppedExamples.push(codeRaw)
        }
      }
      i = j
      continue
    }

    const stdName = standardNameFor(normalized.code)
    if (stdName) name = stdName

    rows.set(normalized.code, {
      code: normalized.code,
      name,
      anggaran,
      realisasi,
      level: normalized.level,
    })
    i = j
  }

  return { rows: [...rows.values()], dropped, droppedExamples }
}

/**
 * Ekstraksi item LRA dari teks PDF secara deterministik (tanpa AI):
 * parse baris rekening → validasi kode BAS → lengkapi hierarki
 * (induk = jumlah anak). Hasil dedupe per kode.
 */
export async function extractLraItems(text: string): Promise<ExtractResult> {
  const { rows, dropped, droppedExamples } = parseLraRows(text)
  const base = [...rows].sort((a, b) => a.code.localeCompare(b.code))
  const { items, derived } = applyHierarchy(base)
  return { items, stats: { valid: base.length, dropped, derived, droppedExamples } }
}

// ---------------------------------------------------------------------------
// Konfirmasi import (simpan RealisasiAkun per scope + ringkasan SKPD)
// ---------------------------------------------------------------------------

/** Kelompok rekening dari awalan kode: 4→PENDAPATAN, 5→BELANJA, 6→PEMBIAYAAN. */
export function groupFromCode(code: string): string {
  if (code.startsWith('4')) return 'PENDAPATAN'
  if (code.startsWith('5')) return 'BELANJA'
  return 'PEMBIAYAAN'
}

/**
 * Jumlahkan baris dengan awalan kode tertentu. Baris bertingkat (akun/
 * kelompok/jenis/…) dijumlahkan hanya pada level terendah yang tersedia
 * agar total tidak terhitung ganda.
 */
export function sumByPrefix(
  items: { code: string; level: number; anggaran: number; realisasi: number }[],
  prefix: string,
  field: 'anggaran' | 'realisasi'
): number {
  const subset = items.filter((i) => i.code === prefix || i.code.startsWith(`${prefix}.`))
  if (subset.length === 0) return 0
  const minLevel = Math.min(...subset.map((i) => i.level))
  return subset
    .filter((i) => i.level === minLevel)
    .reduce((acc, r) => acc + r[field], 0)
}

/**
 * Simpan hasil import LRA:
 * - mode 'replace': hapus seluruh baris pada scope lalu sisipkan semua
 * - mode 'append' : upsert per kode dalam scope
 * - Untuk scope OPD: ringkasan RealisasiSkpd OPD ikut diperbarui dari
 *   total per kelompok (level terendah yang tersedia).
 */
export async function confirmLra(params: {
  items: unknown
  mode: 'replace' | 'append'
  scope: string
  opdId: number | null
  importLogId: number
}): Promise<{ saved: number }> {
  const { items, mode, scope, opdId, importLogId } = params
  if (!Array.isArray(items)) throw new Error('Data items tidak valid')

  const merged = new Map<string, LraItem>()
  for (const entry of items) {
    const item = normalizeItem(entry)
    if (item) merged.set(item.code, item)
  }

  // Lengkapi hierarki sesuai struktur LRA (induk hilang diturunkan dari
  // jumlah anaknya) - idempoten terhadap hasil parse.
  const { items: lraItems } = applyHierarchy([...merged.values()])

  const rows = lraItems.map((item) => ({
    code: item.code,
    name: item.name,
    group: groupFromCode(item.code),
    level: item.level,
    scope,
    opdId,
    anggaran: item.anggaran,
    realisasi: item.realisasi,
  }))

  let saved = 0
  if (mode === 'replace') {
    await db.realisasiAkun.deleteMany({ where: { scope } })
    if (rows.length > 0) {
      await db.realisasiAkun.createMany({ data: rows })
    }
    saved = rows.length
  } else {
    for (const row of rows) {
      await db.realisasiAkun.upsert({
        where: { code_scope: { code: row.code, scope } },
        update: {
          name: row.name,
          group: row.group,
          level: row.level,
          opdId,
          anggaran: row.anggaran,
          realisasi: row.realisasi,
        },
        create: row,
      })
    }
    saved = rows.length
  }

  // Scope OPD → perbarui ringkasan RealisasiSkpd milik OPD tersebut.
  // Pembiayaan memakai penerimaan (6.1) bila ada, selain itu seluruh grup 6.
  if (opdId) {
    const opd = await db.opd.findUnique({ where: { id: opdId } })
    if (opd) {
      const hasPenerimaan = lraItems.some((i) => i.code === '6.1' || i.code.startsWith('6.1.'))
      const pemPrefix = hasPenerimaan ? '6.1' : '6'
      const pendapatan = {
        anggaran: sumByPrefix(lraItems, '4', 'anggaran'),
        realisasi: sumByPrefix(lraItems, '4', 'realisasi'),
      }
      const belanja = {
        anggaran: sumByPrefix(lraItems, '5', 'anggaran'),
        realisasi: sumByPrefix(lraItems, '5', 'realisasi'),
      }
      const pembiayaan = {
        anggaran: sumByPrefix(lraItems, pemPrefix, 'anggaran'),
        realisasi: sumByPrefix(lraItems, pemPrefix, 'realisasi'),
      }
      await db.realisasiSkpd.upsert({
        where: { name: opd.name },
        update: {
          pendapatanAnggaran: pendapatan.anggaran,
          pendapatanRealisasi: pendapatan.realisasi,
          belanjaAnggaran: belanja.anggaran,
          belanjaRealisasi: belanja.realisasi,
          pembiayaanAnggaran: pembiayaan.anggaran,
          pembiayaanRealisasi: pembiayaan.realisasi,
        },
        create: {
          name: opd.name,
          pendapatanAnggaran: pendapatan.anggaran,
          pendapatanRealisasi: pendapatan.realisasi,
          belanjaAnggaran: belanja.anggaran,
          belanjaRealisasi: belanja.realisasi,
          pembiayaanAnggaran: pembiayaan.anggaran,
          pembiayaanRealisasi: pembiayaan.realisasi,
        },
      })
    }
  }

  await db.importLog.updateMany({
    where: { id: importLogId },
    data: { status: 'confirmed', records: saved },
  })

  return { saved }
}
