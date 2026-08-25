import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, unauthorized } from '@/lib/auth'
import {
  MAX_FILE_SIZE,
  MIN_TEXT_LENGTH,
  extractLraItems,
  extractPdfText,
} from '@/lib/import-lra'
import { detectPeriode, periodeLabel } from '@/lib/periode'

// Pastikan handler berjalan di runtime Node (pdf-parse butuh API Node)
export const runtime = 'nodejs'

/**
 * Unggah & urai PDF LRA (admin). Form fields:
 * - file  : PDF (≤10 MB)
 * - opdId : opsional — bila diisi, import ditujukan untuk OPD/SKPD tersebut;
 *           bila kosong, tersimpan sebagai konsolidasi (scope global).
 */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin()
    if (!admin) return unauthorized()

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

    // OPD tujuan import (validasi keberadaannya)
    let opdId: number | null = null
    const opdRaw = form?.get('opdId')
    if (typeof opdRaw === 'string' && opdRaw) {
      const n = Number(opdRaw)
      if (Number.isInteger(n) && n > 0) {
        const opd = await db.opd.findUnique({ where: { id: n } })
        if (opd) opdId = n
      }
    }

    // Periode LRA: prioritas input admin, bila kosong dideteksi otomatis
    // dari teks PDF ("... Sampai 31 Juli 2026"); default 12 (setahun)
    let periode = 12
    const periodeRaw = form?.get('periode')
    if (typeof periodeRaw === 'string' && periodeRaw) {
      const n = Number(periodeRaw)
      if (Number.isInteger(n) && n >= 1 && n <= 12) periode = n
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    // Cek magic bytes: file PDF selalu diawali "%PDF-"
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

    // Bila admin tidak menetapkan periode, deteksi dari header LRA
    if (typeof periodeRaw !== 'string' || !periodeRaw) {
      const detected = detectPeriode(text)
      if (detected) periode = detected
    }

    // Ekstraksi & klasifikasi kode rekening per level sesuai aturan BAS
    // Permendagri secara deterministik (parser baris, tanpa AI)
    const { items, stats } = await extractLraItems(text)

    const opd = opdId ? await db.opd.findUnique({ where: { id: opdId } }) : null

    const log = await db.importLog.create({
      data: {
        filename: file.name,
        pages,
        records: items.length,
        status: 'parsed',
        opdId,
        periode,
        message: items.length === 0 ? 'Tidak ada baris LRA terdeteksi dari PDF' : null,
      },
    })

    return NextResponse.json({
      data: {
        importLogId: log.id,
        filename: log.filename,
        pages,
        opdId,
        opdName: opd?.name ?? null,
        periode,
        periodeLabel: periodeLabel(periode),
        items,
        stats,
        textPreview: text.slice(0, 500),
      },
    })
  } catch (error) {
    console.error('POST /api/admin/import/lra error', error)
    return NextResponse.json({ error: 'Gagal memproses import LRA' }, { status: 500 })
  }
}
