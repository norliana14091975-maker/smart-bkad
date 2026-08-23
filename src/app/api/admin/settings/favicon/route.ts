import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminUser, unauthorized } from '@/lib/auth'
import { MAX_IMAGE_SIZE, saveUploadedImage, removeUploadedImage } from '@/lib/image-upload'

const BASE_NAME = 'app-favicon'

/** Unggah favicon aplikasi (ikon tab browser). */
export async function POST(req: Request) {
  try {
    const user = await getAdminUser()
    if (!user) return unauthorized()

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
      where: { key: 'faviconUrl' },
      update: { value: url },
      create: { key: 'faviconUrl', value: url },
    })

    return NextResponse.json({ data: { faviconUrl: url } })
  } catch (error) {
    console.error('POST /api/admin/settings/favicon error', error)
    return NextResponse.json({ error: 'Gagal mengunggah favicon' }, { status: 500 })
  }
}

/** Hapus favicon kustom. */
export async function DELETE() {
  try {
    const user = await getAdminUser()
    if (!user) return unauthorized()

    removeUploadedImage(BASE_NAME)
    await db.appSetting.deleteMany({ where: { key: 'faviconUrl' } })

    return NextResponse.json({ data: { ok: true } })
  } catch (error) {
    console.error('DELETE /api/admin/settings/favicon error', error)
    return NextResponse.json({ error: 'Gagal menghapus favicon' }, { status: 500 })
  }
}
