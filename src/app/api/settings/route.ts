import { NextResponse } from 'next/server'
import { getSettings } from '@/lib/settings'
import { DEFAULT_SETTINGS } from '@/lib/default-settings'

/**
 * Pengaturan aplikasi untuk konsumsi publik (nama, logo, favicon, teks).
 * Jika database bermasalah, kembalikan nilai bawaan agar aplikasi tetap tampil.
 */
export async function GET() {
  try {
    const data = await getSettings()
    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET /api/settings error', error)
    return NextResponse.json({ data: DEFAULT_SETTINGS })
  }
}
