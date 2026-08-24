import fs from 'fs'
import path from 'path'
import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'
import { codeLevel } from '@/lib/kode-akun'

// ---------------------------------------------------------------------------
// Konstanta import LRA
// ---------------------------------------------------------------------------

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
export const MIN_TEXT_LENGTH = 50 // lebih pendek dari ini dianggap PDF hasil scan
const CHUNK_SIZE = 15000 // ±15.000 karakter per chunk untuk LLM

/** Item LRA hasil ekstraksi, sudah diklasifikasi per level kode. */
export interface LraItem {
  code: string
  name: string
  anggaran: number
  realisasi: number
  /** 1=akun, 2=kelompok, 3=jenis, 4=obyek, 5=rincian obyek */
  level: number
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
 * Mendukung format Indonesia: "49.898.218.773.411,00" → 49898218773411.
 */
function parseLooseNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null

  let s = value.trim().replace(/^rp\.?\s*/i, '').replace(/\s|\u00a0/g, '')
  if (!s) return null

  // Tanda kurung = negatif pada laporan keuangan
  const negative = s.startsWith('(') && s.endsWith(')')
  if (negative) s = s.slice(1, -1)
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

/** Validasi satu entri hasil LLM dan klasifikasikan levelnya. */
function normalizeItem(entry: unknown): LraItem | null {
  if (typeof entry !== 'object' || entry === null) return null
  const e = entry as Record<string, unknown>

  const code =
    typeof e.code === 'string'
      ? e.code.trim()
      : typeof e.code === 'number'
        ? String(e.code)
        : ''
  if (!code) return null

  const anggaran = parseLooseNumber(e.anggaran)
  const realisasi = parseLooseNumber(e.realisasi)
  if (anggaran === null || realisasi === null) return null
  if (anggaran < 0 || realisasi < 0) return null

  const name = typeof e.name === 'string' ? e.name.trim() : e.name != null ? String(e.name).trim() : ''

  return { code, name, anggaran, realisasi, level: codeLevel(code) }
}

/** Parse jawaban LLM secara tangguh: buang code fence lalu ambil array JSON. */
function parseLlmJsonArray(raw: string): unknown[] {
  if (!raw) return []

  let s = raw.trim()
  s = s
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()

  const start = s.indexOf('[')
  const end = s.lastIndexOf(']')
  if (start === -1 || end === -1 || end <= start) return []

  try {
    const parsed: unknown = JSON.parse(s.slice(start, end + 1))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** Potong teks menjadi chunk pada batas baris agar baris tabel tidak terbelah. */
function chunkText(text: string, size = CHUNK_SIZE): string[] {
  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    let end = Math.min(start + size, text.length)
    if (end < text.length) {
      const nextBreak = text.indexOf('\n', end)
      const lastBreak = text.lastIndexOf('\n', end)
      if (nextBreak !== -1 && nextBreak - end <= 2000) {
        end = nextBreak + 1
      } else if (lastBreak > start) {
        end = lastBreak + 1
      }
    }
    const chunk = text.slice(start, end)
    if (chunk.trim()) chunks.push(chunk)
    start = end
  }

  return chunks
}

// ---------------------------------------------------------------------------
// Prompt LLM — ekstraksi semua level kode rekening
// ---------------------------------------------------------------------------

const LLM_SYSTEM_PROMPT =
  'Anda adalah asisten ekstraksi data laporan keuangan daerah Indonesia ' +
  '(LRA — Laporan Realisasi Anggaran). Tugas Anda membaca teks hasil ekstraksi PDF LRA ' +
  'dan mengembalikan baris-baris rekening sebagai JSON yang ketat tanpa teks tambahan.'

function buildChunkPrompt(chunk: string): string {
  return (
    'Berikut potongan teks hasil ekstraksi PDF LRA:\n\n' +
    chunk +
    '\n\nEkstrak SEMUA baris yang memiliki kode rekening: deretan angka yang dipisah titik, ' +
    '1 sampai 5 segmen, diawali angka 4 (pendapatan), 5 (belanja), atau 6 (pembiayaan). ' +
    'Contoh semua level yang harus diambil:\n' +
    '- level akun (1 segmen): "4", "5", "6"\n' +
    '- level kelompok (2 segmen): "4.1", "4.2", "5.1", "6.1"\n' +
    '- level jenis (3 segmen): "4.1.01", "5.1.02"\n' +
    '- level obyek (4 segmen): "4.1.01.01", "5.1.02.01"\n' +
    '- level rincian obyek (5 segmen): "4.1.01.01.01"\n' +
    'Untuk setiap baris kumpulkan: "code" (kode rekening persis seperti di teks), ' +
    '"name" (uraian/nama rekening), "anggaran" (nilai anggaran), dan "realisasi" (nilai realisasi).\n' +
    'Aturan:\n' +
    '1. Ubah format angka Indonesia (titik pemisah ribuan, koma desimal, contoh ' +
    '"49.898.218.773.411,00") menjadi angka polos (49898218773411).\n' +
    '2. Nilai kosong, strip, atau tidak ada dianggap 0.\n' +
    '3. Lewati kepala kolom dan baris tanpa kode rekening.\n' +
    '4. Jangan mengarang data — hanya baris yang benar-benar ada pada teks.\n\n' +
    'Balas HANYA array JSON valid tanpa penjelasan dan tanpa blok kode, contoh:\n' +
    '[{"code":"4","name":"PENDAPATAN DAERAH","anggaran":71450673065697,"realisasi":45000000000000},\n' +
    '{"code":"4.1.01","name":"Pajak Daerah","anggaran":49898218773411,"realisasi":30000000000000}]\n' +
    'Jika tidak ada baris yang cocok, balas [].'
  )
}

// ---------------------------------------------------------------------------
// Ekstraksi PDF + LLM
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

/**
 * Ekstraksi item LRA dari teks PDF: potong per chunk lalu klasifikasikan
 * dengan LLM secara sekuensial (aman rate limit). Hasil dedupe per kode.
 */
export async function extractLraItems(text: string): Promise<LraItem[]> {
  const chunks = chunkText(text)
  const merged = new Map<string, LraItem>()

  const zai = await ZAI.create()
  for (const chunk of chunks) {
    try {
      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'assistant', content: LLM_SYSTEM_PROMPT },
          { role: 'user', content: buildChunkPrompt(chunk) },
        ],
        thinking: { type: 'disabled' },
      })
      const raw = completion.choices[0]?.message?.content ?? ''
      for (const entry of parseLlmJsonArray(raw)) {
        const item = normalizeItem(entry)
        if (item) merged.set(item.code, item)
      }
    } catch (error) {
      // Chunk gagal diproses → lewati, lanjut chunk berikutnya
      console.error('Gagal memproses chunk LLM', error)
    }
  }

  return [...merged.values()].sort((a, b) => a.code.localeCompare(b.code))
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
  const lraItems = [...merged.values()]

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
