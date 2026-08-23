import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import ZAI from 'z-ai-web-dev-sdk'
import { db } from '@/lib/db'
import { getAdminUser, unauthorized } from '@/lib/auth'
import type { ImportItemDto } from '@/types/budget'

// Pastikan handler berjalan di runtime Node (pdf-parse butuh API Node)
export const runtime = 'nodejs'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB
const MIN_TEXT_LENGTH = 50 // teks lebih pendek dari ini dianggap PDF hasil scan
const CHUNK_SIZE = 15000 // ±15.000 karakter per chunk untuk LLM

// ---------------------------------------------------------------------------
// Utilitas parsing angka & item
// ---------------------------------------------------------------------------

/**
 * Ubah nilai (number/string) menjadi angka polos.
 * Mendukung format Indonesia: "49.898.218.773.411,00" → 49898218773411.
 * Mengembalikan null jika tidak bisa diparse.
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
    // Hanya koma: anggap desimal (format Indonesia)
    s = s.replace(',', '.')
  } else if (lastDot !== -1 && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    // Hanya titik dengan kelompok 3 digit: pemisah ribuan (1.234.567)
    s = s.replace(/\./g, '')
  }

  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return negative ? -n : n
}

interface NormalizedItem {
  code: string
  name: string
  anggaran: number
  realisasi: number
}

/**
 * Validasi satu entri hasil LLM: code string tidak kosong, anggaran/realisasi
 * angka berhingga dan >= 0. Mengembalikan null jika tidak valid.
 */
function normalizeItem(entry: unknown): NormalizedItem | null {
  if (typeof entry !== 'object' || entry === null) return null
  const e = entry as Record<string, unknown>

  // Kode rekening: terima string atau angka (dikoersi), harus tidak kosong
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

  const name =
    typeof e.name === 'string'
      ? e.name.trim()
      : e.name != null
        ? String(e.name).trim()
        : ''

  return { code, name, anggaran, realisasi }
}

/**
 * Parse jawaban LLM secara tangguh: buang code fence ```json, ambil substring
 * dari '[' pertama hingga ']' terakhir, lalu JSON.parse dalam try/catch.
 */
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

/**
 * Potong teks menjadi chunk ±CHUNK_SIZE karakter, dipotong pada batas baris
 * agar baris tabel LRA tidak terbelah antar chunk.
 */
function chunkText(text: string, size = CHUNK_SIZE): string[] {
  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    let end = Math.min(start + size, text.length)
    if (end < text.length) {
      // Perpanjang hingga baris berikutnya (maks 2000 karakter) agar utuh
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
// Prompt LLM (Bahasa Indonesia)
// ---------------------------------------------------------------------------

const LLM_SYSTEM_PROMPT =
  'Anda adalah asisten ekstraksi data laporan keuangan daerah Indonesia ' +
  '(LRA — Laporan Realisasi Anggaran). Tugas Anda membaca teks hasil ekstraksi PDF LRA ' +
  'dan mengembalikan baris-baris rekening sebagai JSON yang ketat tanpa teks tambahan.'

function buildChunkPrompt(chunk: string): string {
  return (
    'Berikut potongan teks hasil ekstraksi PDF LRA:\n\n' +
    chunk +
    '\n\nEkstrak SEMUA baris yang memiliki kode rekening berpola kelompok angka dipisah titik ' +
    'dan diawali angka 4, 5, atau 6 (contoh: 4.1.01, 4.1.02.01, 5.1.02.01, 6.1.01). ' +
    'Untuk setiap baris kumpulkan: "code" (kode rekening persis seperti di teks), ' +
    '"name" (uraian/nama rekening), "anggaran" (nilai anggaran), dan "realisasi" (nilai realisasi).\n' +
    'Aturan:\n' +
    '1. Ubah format angka Indonesia (titik sebagai pemisah ribuan, koma sebagai desimal, ' +
    'contoh "49.898.218.773.411,00") menjadi angka polos (49898218773411).\n' +
    '2. Nilai kosong, strip, atau tidak ada dianggap 0.\n' +
    '3. Lewati baris judul, kepala kolom, baris JUMLAH/subtotal, dan baris tanpa kode rekening.\n' +
    '4. Jangan mengarang data — hanya baris yang benar-benar ada pada teks.\n\n' +
    'Balas HANYA array JSON valid tanpa penjelasan dan tanpa blok kode, contoh:\n' +
    '[{"code":"4.1.01","name":"Pajak Daerah","anggaran":49898218773411,"realisasi":30000000000000}]\n' +
    'Jika tidak ada baris yang cocok, balas [].'
  )
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    const user = await getAdminUser()
    if (!user) return unauthorized()

    // --- Baca & validasi file ---
    const form = await req.formData().catch(() => null)
    const file = form?.get('file')
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'File PDF wajib diunggah' }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Ukuran file melebihi batas maksimum 10 MB' },
        { status: 400 },
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    // Cek magic bytes: file PDF selalu diawali "%PDF-"
    if (buffer.length < 5 || buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
      return NextResponse.json(
        { error: 'File bukan PDF yang valid' },
        { status: 400 },
      )
    }

    // --- Ekstraksi teks dengan pdf-parse ---
    let text = ''
    let pages = 0
    try {
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
        text = result.text ?? ''
        pages = result.total ?? result.pages?.length ?? 0
      } finally {
        await parser.destroy().catch(() => undefined)
      }
    } catch (error) {
      console.error('Ekstraksi teks PDF gagal', error)
      return NextResponse.json(
        { error: 'Gagal membaca isi PDF' },
        { status: 500 },
      )
    }

    if (text.trim().length < MIN_TEXT_LENGTH) {
      return NextResponse.json(
        {
          error:
            'PDF tidak mengandung teks yang dapat dibaca (kemungkinan hasil pindai/scan). Gunakan PDF digital.',
        },
        { status: 400 },
      )
    }

    // --- Ekstraksi baris LRA per chunk dengan LLM (sekuensial agar aman rate limit) ---
    const chunks = chunkText(text)
    const merged = new Map<string, NormalizedItem>()

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
            // Dedupe berdasarkan kode — chunk berikutnya menimpa chunk sebelumnya
            merged.set(item.code, item)
          }
        }
      } catch (error) {
        // Chunk gagal diproses → lewati, lanjut chunk berikutnya
        console.error('Gagal memproses chunk LLM', error)
      }
    }

    const items: ImportItemDto[] = [...merged.values()]
      .sort((a, b) => a.code.localeCompare(b.code))
      .map((item) => ({
        code: item.code,
        name: item.name,
        anggaran: item.anggaran,
        realisasi: item.realisasi,
        pct: item.anggaran > 0 ? (item.realisasi / item.anggaran) * 100 : 0,
      }))

    // --- Catat log import ---
    const log = await db.importLog.create({
      data: {
        filename: file.name,
        pages,
        records: items.length,
        status: 'parsed',
        message:
          items.length === 0 ? 'Tidak ada baris LRA terdeteksi dari PDF' : null,
      },
    })

    return NextResponse.json({
      data: {
        importLogId: log.id,
        filename: log.filename,
        pages,
        items,
        textPreview: text.slice(0, 500),
      },
    })
  } catch (error) {
    console.error('POST /api/admin/import/lra error', error)
    return NextResponse.json({ error: 'Gagal memproses import LRA' }, { status: 500 })
  }
}
