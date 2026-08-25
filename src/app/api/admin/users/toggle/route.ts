import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, unauthorized } from '@/lib/auth'
import { countActiveAdmins } from '@/lib/users'

/**
 * POST — aktifkan/nonaktifkan akun pengguna (?id=<userId>).
 * Saat dinonaktifkan semua sesi aktif dihapus (logout paksa) dan login
 * berikutnya ditolak. Admin tidak bisa menonaktifkan akunnya sendiri
 * maupun admin aktif terakhir.
 */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin()
    if (!admin) return unauthorized()

    const url = new URL(req.url)
    const id = url.searchParams.get('id') ?? ''
    if (!id) {
      return NextResponse.json({ error: 'ID pengguna tidak valid' }, { status: 400 })
    }

    const user = await db.adminUser.findUnique({ where: { id } })
    if (!user) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 })
    }
    if (user.id === admin.id) {
      return NextResponse.json(
        { error: 'Tidak dapat menonaktifkan akun yang sedang digunakan' },
        { status: 400 }
      )
    }

    const active = !user.active
    if (!active && user.role === 'admin') {
      const others = await countActiveAdmins(user.id)
      if (others === 0) {
        return NextResponse.json(
          { error: 'Minimal harus ada satu admin aktif — tidak dapat menonaktifkan admin terakhir' },
          { status: 400 }
        )
      }
    }

    await db.$transaction([
      db.adminUser.update({ where: { id }, data: { active } }),
      // nonaktifkan → hapus sesi agar langsung logout
      ...(!active ? [db.adminSession.deleteMany({ where: { userId: user.id } })] : []),
    ])

    return NextResponse.json({ data: { id, active } })
  } catch (error) {
    console.error('POST /api/admin/users/toggle error', error)
    return NextResponse.json({ error: 'Gagal mengubah status pengguna' }, { status: 500 })
  }
}
