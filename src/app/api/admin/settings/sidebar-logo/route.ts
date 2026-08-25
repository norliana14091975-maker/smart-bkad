import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, unauthorized } from '@/lib/auth'
import { MAX_IMAGE_SIZE, saveUploadedImage, removeUploadedImage } from '@/lib/image-upload'

const BASE_NAME = 'app-sidebar-logo'

/** Unggah logo khusus pojok kiri atas sidebar. */
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
      where: { key: 'sidebarLogoUrl' },
      update: { value: url },
      create: { key: 'sidebarLogoUrl', value: url },
    })

    return NextResponse.json({ data: { sidebarLogoUrl: url } })
  } catch (error) {
    console.error('POST /api/admin/settings/sidebar-logo error', error)
    return NextResponse.json({ error: 'Gagal mengunggah logo sidebar' }, { status: 500 })
  }
}

/** Hapus logo sidebar kustom — kembali mengikuti Logo Aplikasi. */
export async function DELETE() {
  try {
    const admin = await requireAdmin()
    if (!admin) return unauthorized()

    removeUploadedImage(BASE_NAME)
    await db.appSetting.deleteMany({ where: { key: 'sidebarLogoUrl' } })

    return NextResponse.json({ data: { ok: true } })
  } catch (error) {
    console.error('DELETE /api/admin/settings/sidebar-logo error', error)
    return NextResponse.json({ error: 'Gagal menghapus logo sidebar' }, { status: 500 })
  }
}
