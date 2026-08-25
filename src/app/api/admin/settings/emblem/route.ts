import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, unauthorized } from '@/lib/auth'
import { MAX_IMAGE_SIZE, saveUploadedImage, removeUploadedImage } from '@/lib/image-upload'

const BASE_NAME = 'app-emblem'

/** Unggah logo/lencana pojok kanan header. */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin()
    if (!admin) return unauthorized()

    const form = await req.formData().catch(() => null)
    const file = form?.get('file')
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'File gambar wajib diunggah' }, { status: 400 })
    }
    if (file.size > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: 'Ukuran file melebihi batas maksimum 2 MB' },
        { status: 400 },
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    let url: string
    try {
      url = await saveUploadedImage(buffer, BASE_NAME)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'File tidak valid'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    await db.appSetting.upsert({
      where: { key: 'emblemUrl' },
      update: { value: url },
      create: { key: 'emblemUrl', value: url },
    })

    return NextResponse.json({ data: { emblemUrl: url } })
  } catch (error) {
    console.error('POST /api/admin/settings/sidebar-logo error', error)
    return NextResponse.json({ error: 'Gagal mengunggah lencana pojok kanan' }, { status: 500 })
  }
}

/** Hapus lencana kustom — kembali ke emblem emas bawaan. */
export async function DELETE() {
  try {
    const admin = await requireAdmin()
    if (!admin) return unauthorized()

    removeUploadedImage(BASE_NAME)
    await db.appSetting.deleteMany({ where: { key: 'emblemUrl' } })

    return NextResponse.json({ data: { ok: true } })
  } catch (error) {
    console.error('DELETE /api/admin/settings/sidebar-logo error', error)
    return NextResponse.json({ error: 'Gagal menghapus lencana pojok kanan' }, { status: 500 })
  }
}
