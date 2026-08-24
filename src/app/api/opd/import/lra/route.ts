import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminUser, unauthorized } from '@/lib/auth'
import {
  MAX_FILE_SIZE,
  MIN_TEXT_LENGTH,
  extractLraItems,
  extractPdfText,
} from '@/lib/import-lra'

export const runtime = 'nodejs'

/**
 * Unggah & urai PDF LRA untuk OPD yang sedang login — scope otomatis
 * mengikuti OPD tersebut (tidak bisa mengimpor untuk OPD lain).
 */
export async function POST(req: Request) {
  try {
    const user = await getAdminUser()
    if (!user || user.role !== 'opd' || !user.opdId) return unauthorized()

    const opd = await db.opd.findUnique({ where: { id: user.opdId } })
    if (!opd) return unauthorized()
    if (!opd.active) {
      return NextResponse.json({ error: 'Akun OPD dinonaktifkan' }, { status: 403 })
    }

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
    if (buffer.length < 5 || buffer.subarray(0, 5).toString('latin1') !== '%PDF-') {
      return NextResponse.json({ error: 'File bukan PDF yang valid' }, { status: 400 })
    }

    let text = ''
    let pages = 0
    try {
      const parsed = await extractPdfText(buffer)
      text = parsed.text
      pages = parsed.pages
    } catch (error) {
      console.error('Ekstraksi teks PDF gagal', error)
      return NextResponse.json({ error: 'Gagal membaca isi PDF' }, { status: 500 })
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

    // Ekstraksi & klasifikasi kode rekening per level sesuai aturan BAS
    // Permendagri (validasi kode, hierarki lengkap) dengan LLM per chunk
    const { items, stats } = await extractLraItems(text)

    const log = await db.importLog.create({
      data: {
        filename: file.name,
        pages,
        records: items.length,
        status: 'parsed',
        opdId: opd.id,
        message: items.length === 0 ? 'Tidak ada baris LRA terdeteksi dari PDF' : null,
      },
    })

    return NextResponse.json({
      data: {
        importLogId: log.id,
        filename: log.filename,
        pages,
        opdId: opd.id,
        opdName: opd.name,
        items,
        stats,
        textPreview: text.slice(0, 500),
      },
    })
  } catch (error) {
    console.error('POST /api/opd/import/lra error', error)
    return NextResponse.json({ error: 'Gagal memproses import LRA' }, { status: 500 })
  }
}
