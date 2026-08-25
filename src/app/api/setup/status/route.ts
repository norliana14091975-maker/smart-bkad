import { NextResponse } from 'next/server'
import { getSettings } from '@/lib/settings'
import { isFirstRunNeeded } from '@/lib/setup-wizard'
import type { FirstRunStatusDto } from '@/types/budget'

/**
 * GET — status Setup Wizard first-run (PUBLIK, tanpa sesi).
 * Dipakai halaman utama untuk memutuskan apakah wizard inisialisasi
 * harus ditampilkan: true bila belum ada akun admin sama sekali.
 * Endpoint tidak membocorkan data sensitif apa pun.
 */
export async function GET() {
  try {
    const needed = await isFirstRunNeeded()
    let appTitle = 'Dashboard Keuangan Kab. Seruyan'
    try {
      const settings = await getSettings()
      if (settings.appTitle) appTitle = settings.appTitle
    } catch {
      // database belum siap → pakai judul bawaan
    }
    const data: FirstRunStatusDto = { needed, appTitle }
    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET /api/setup/status error', error)
    return NextResponse.json({ error: 'Gagal memuat status setup' }, { status: 500 })
  }
}
