import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, unauthorized } from '@/lib/auth'
import { removeUploadedImage } from '@/lib/image-upload'
import { DEFAULT_SETTINGS } from '@/lib/default-settings'

/** Kembalikan seluruh pengaturan ke nilai bawaan (termasuk logo & favicon). */
export async function POST() {
  try {
    const user = await requireAdmin()
    if (!user) return unauthorized()

    await db.appSetting.deleteMany({})
    removeUploadedImage('app-logo')
    removeUploadedImage('app-favicon')

    return NextResponse.json({ data: DEFAULT_SETTINGS })
  } catch (error) {
    console.error('POST /api/admin/settings/reset error', error)
    return NextResponse.json({ error: 'Gagal mereset pengaturan' }, { status: 500 })
  }
}
