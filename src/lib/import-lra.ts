import fs from 'fs'
import path from 'path'
import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'
import { applyHierarchy, normalizeKode, standardNameFor } from '@/lib/kode-akun'

// ---------------------------------------------------------------------------
// Konstanta import LRA
// ---------------------------------------------------------------------------

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
export const MIN_TEXT_LENGTH = 50 // lebih pendek dari ini dianggap PDF hasil scan
const CHUNK_SIZE = 8000 // ±8.000 karakter per chunk agar keluaran LLM aman dari batas token

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
 * Validasi satu entri hasil LLM menurut aturan BAS Permendagri:
 * - kode dinormalisasi ke bentuk baku (bertitik/flat diterima)
 * - nama akun/kelompok dinormalkan ke nomenklatur baku
 * - anggaran tidak boleh negatif; realisasi boleh negatif (koreksi LRA)
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

/**
 * Parse jawaban LLM secara tangguh: buang code fence lalu ambil array JSON.
 * Respons LLM dapat terpotong oleh batas token sehingga array tidak tertutup;
 * pada kasus itu pulihkan dengan membaca setiap objek {...} yang utuh satu
 * per satu sehingga item sebelum titik potong tetap terselamatkan.
 */
function parseLlmJsonArray(raw: string): unknown[] {
  if (!raw) return []

  let s = raw.trim()
  s = s
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()

  const start = s.indexOf('[')
  if (start === -1) return []
  const end = s.lastIndexOf(']')

  // 1) Coba parse array utuh terlebih dahulu
  if (end > start) {
    try {
      const parsed: unknown = JSON.parse(s.slice(start, end + 1))
      if (Array.isArray(parsed)) return parsed
    } catch {
      // lanjut ke pemulihan objek per objek
    }
  }

  // 2) Pemulihan respons terpotong: objek LRA datar tanpa braket bersarang
  const items: unknown[] = []
  const body = s.slice(start)
  const objectRe = /\{[^{}]*\}/g
  for (const match of body.matchAll(objectRe)) {
    try {
      items.push(JSON.parse(match[0]))
    } catch {
      // lewati objek rusak
    }
  }
  return items
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
    '\n\nEkstrak SEMUA baris yang memiliki kode rekening LRA sesuai struktur Bagan Akun ' +
    'Standar (BAS) Permendagri 77/2020, yaitu deretan angka yang diawali 4 (pendapatan), ' +
    '5 (belanja), atau 6 (pembiayaan) dengan level:\n' +
    '- level akun (1 digit): "4", "5", "6"\n' +
    '- level kelompok: "4.1" s.d. "4.3", "5.1" s.d. "5.4", "6.1"-"6.2"\n' +
    '- level jenis: "4.1.01", "5.1.02"\n' +
    '- level obyek: "4.1.01.01", "5.1.02.01"\n' +
    '- level rincian obyek (3 digit): "4.1.01.01.001", "5.1.01.01.001"\n' +
    '- level sub rincian obyek (5 digit tambahan): "4.1.02.03.007.00001", "5.1.01.01.001.00001"\n' +
    'Kode boleh tertulis tanpa titik (mis. "4102" artinya 4.1.02) — salin persis seperti di teks.\n' +
    'KOLOM ANGKA: "anggaran" = kolom ANGGARAN 2026 (tahun berjalan), "realisasi" = kolom ' +
    'REALISASI 2026. JANGAN memakai kolom REALISASI tahun sebelumnya (mis. REALISASI 2025) ' +
    'atau kolom persentase.\n' +
    'Untuk setiap baris kumpulkan: "code" (kode rekening persis seperti di teks), ' +
    '"name" (uraian/nama rekening), "anggaran" (nilai anggaran), dan "realisasi" (nilai realisasi).\n' +
    'Aturan:\n' +
    '1. "anggaran" dan "realisasi" WAJIB berupa STRING yang disalin PERSIS dari teks, ' +
    'termasuk titik dan koma apa adanya — JANGAN mengubahnya menjadi angka dan jangan ' +
    'menghitung ulang jumlah nolnya (contoh teks "10.000.000,00" ditulis ' +
    '"anggaran":"10.000.000,00").\n' +
    '2. Nilai kosong, strip, atau tidak ada dianggap 0. Realisasi negatif ditulis angka minus.\n' +
    '3. Lewati kepala kolom, baris JUMLAH/subtotal, dan baris tanpa kode rekening.\n' +
    '4. Jangan mengarang data — hanya baris yang benar-benar ada pada teks.\n\n' +
    'Balas HANYA array JSON valid tanpa penjelasan dan tanpa blok kode, contoh:\n' +
    '[{"code":"4","name":"PENDAPATAN DAERAH","anggaran":"71.450.673.065.697,00","realisasi":"45.000.000.000.000,00"},\n' +
    '{"code":"4.1.01.01.001","name":"Pajak Hotel Bintang 3","anggaran":"3.000.000.000.000,00","realisasi":"1.800.000.000.000,00"}]\n' +
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
 * dengan LLM secara sekuensial (aman rate limit). Setiap entri divalidasi
 * menurut aturan BAS Permendagri (kode di luar struktur dibuang), lalu
 * hierarki dilengkapi (induk yang tidak tercetak diturunkan dari jumlah
 * anak-anaknya). Hasil dedupe per kode.
 */
export async function extractLraItems(text: string): Promise<ExtractResult> {
  const chunks = chunkText(text)
  const merged = new Map<string, LraItem>()
  let dropped = 0
  const droppedExamples: string[] = []

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
        if (item) {
          merged.set(item.code, item)
        } else {
          // Baris tidak sesuai struktur BAS Permendagri → dibuang
          dropped += 1
          const codeRaw = (entry as Record<string, unknown> | null)?.code
          const codeStr =
            typeof codeRaw === 'string' || typeof codeRaw === 'number' ? String(codeRaw) : ''
          if (codeStr && droppedExamples.length < 5 && !droppedExamples.includes(codeStr)) {
            droppedExamples.push(codeStr)
          }
        }
      }
    } catch (error) {
      // Chunk gagal diproses → lewati, lanjut chunk berikutnya
      console.error('Gagal memproses chunk LLM', error)
    }
  }

  const base = [...merged.values()].sort((a, b) => a.code.localeCompare(b.code))
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
