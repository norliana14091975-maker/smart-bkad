import { NextResponse } from 'next/server'
import { requireAdmin, unauthorized } from '@/lib/auth'
import { getSetupWizardStatus, markSetupCompleted, resetSetupCompleted } from '@/lib/setup-wizard'

/**
 * GET — status Setup Wizard: apakah setup pernah ditandai selesai dan
 * hasil pemeriksaan konfigurasi (identitas, password bawaan, AI Copilot).
 */
export async function GET() {
  try {
    const admin = await requireAdmin()
    if (!admin) return unauthorized()

    const data = await getSetupWizardStatus(admin)
    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET /api/admin/setup-wizard error', error)
    return NextResponse.json({ error: 'Gagal memuat status Setup Wizard' }, { status: 500 })
  }
}

/**
 * POST — tandai Setup Wizard selesai. Setelah ini wizard tidak terbuka
 * otomatis lagi saat login admin (tetap bisa dijalankan ulang manual).
 */
export async function POST() {
  try {
    const admin = await requireAdmin()
    if (!admin) return unauthorized()

    await markSetupCompleted()
    const data = await getSetupWizardStatus(admin)
    return NextResponse.json({ data })
  } catch (error) {
    console.error('POST /api/admin/setup-wizard error', error)
    return NextResponse.json({ error: 'Gagal menandai setup selesai' }, { status: 500 })
  }
}

/**
 * DELETE — hapus penanda selesai. Wizard akan kembali terbuka otomatis
 * pada login admin berikutnya.
 */
export async function DELETE() {
  try {
    const admin = await requireAdmin()
    if (!admin) return unauthorized()

    await resetSetupCompleted()
    const data = await getSetupWizardStatus(admin)
    return NextResponse.json({ data })
  } catch (error) {
    console.error('DELETE /api/admin/setup-wizard error', error)
    return NextResponse.json({ error: 'Gagal mereset status Setup Wizard' }, { status: 500 })
  }
}
