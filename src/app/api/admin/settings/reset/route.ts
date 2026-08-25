import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, unauthorized } from '@/lib/auth'
import { removeUploadedImage } from '@/lib/image-upload'
import { DEFAULT_SETTINGS } from '@/lib/default-settings'
import { COPILOT_SETTING_KEYS } from '@/lib/copilot-config'

/**
 * Kembalikan pengaturan tampilan ke nilai bawaan (teks, logo, favicon).
 * Konfigurasi AI Copilot (provider, model, API key) DIPERTAHANKAN agar
 * admin tidak perlu memasukkan ulang kredensial integrasi.
 */
export async function POST() {
  try {
    const user = await requireAdmin()
    if (!user) return unauthorized()

    await db.appSetting.deleteMany({
      where: { key: { notIn: [...COPILOT_SETTING_KEYS] } },
    })
    removeUploadedImage('app-logo')
    removeUploadedImage('app-sidebar-logo')
    removeUploadedImage('app-emblem')
    removeUploadedImage('app-favicon')

    return NextResponse.json({ data: DEFAULT_SETTINGS })
  } catch (error) {
    console.error('POST /api/admin/settings/reset error', error)
    return NextResponse.json({ error: 'Gagal mereset pengaturan' }, { status: 500 })
  }
}
