import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, unauthorized } from '@/lib/auth'

/**
 * Aktifkan/nonaktifkan akun OPD (?id=<opdId>).
 * Saat dinonaktifkan, semua sesi aktif dihapus (logout paksa) dan
 * login berikutnya ditolak.
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

    const opd = await db.opd.findUnique({ where: { id }, include: { user: true } })
    if (!opd) {
      return NextResponse.json({ error: 'OPD tidak ditemukan' }, { status: 404 })
    }

    const active = !opd.active
    await db.$transaction([
      db.opd.update({ where: { id }, data: { active } }),
      // nonaktifkan → hapus sesi agar langsung logout
      ...(opd.user && !active
        ? [db.adminSession.deleteMany({ where: { userId: opd.user.id } })]
        : []),
    ])

    return NextResponse.json({ data: { id, active } })
  } catch (error) {
    console.error('POST /api/admin/opd/toggle error', error)
    return NextResponse.json({ error: 'Gagal mengubah status OPD' }, { status: 500 })
  }
}
