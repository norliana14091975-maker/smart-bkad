import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, unauthorized } from '@/lib/auth'
import { resetOpdPassword } from '@/lib/opd'

/**
 * Reset password akun OPD (?id=<opdId>). Semua sesi aktif akun tersebut
 * dihapus sehingga harus login ulang. Password baru hanya tampil sekali.
 */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin()
    if (!admin) return unauthorized()

    const url = new URL(req.url)
    const id = Number(url.searchParams.get('id'))
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: 'ID OPD tidak valid' }, { status: 400 })
    }

    const opd = await db.opd.findUnique({ where: { id } })
    if (!opd) {
      return NextResponse.json({ error: 'OPD tidak ditemukan' }, { status: 404 })
    }

    const creds = await resetOpdPassword(id)
    if (!creds) {
      return NextResponse.json({ error: 'Akun login OPD tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json({
      data: { credentials: { opdName: opd.name, ...creds } },
    })
  } catch (error) {
    console.error('POST /api/admin/opd/reset-password error', error)
    return NextResponse.json({ error: 'Gagal reset password' }, { status: 500 })
  }
}
