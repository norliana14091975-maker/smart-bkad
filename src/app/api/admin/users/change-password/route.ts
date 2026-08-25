import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { getAdminUser, unauthorized, verifyPassword, SESSION_COOKIE } from '@/lib/auth'
import { hashPassword } from '@/lib/password'

/**
 * POST — ganti password akun yang sedang login (dipakai Setup Wizard,
 * langkah Keamanan Akun).
 * Body: { currentPassword, newPassword }
 * Password lama diverifikasi; sesi lain dihapus, sesi aktif dipertahankan
 * agar pengguna tidak keluar mendadak.
 */
export async function POST(req: Request) {
  try {
    const user = await getAdminUser()
    if (!user) return unauthorized()

    const body = (await req.json().catch(() => null)) as
      | { currentPassword?: unknown; newPassword?: unknown }
      | null

    const currentPassword =
      typeof body?.currentPassword === 'string' ? body.currentPassword : ''
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword.trim() : ''

    if (!currentPassword) {
      return NextResponse.json({ error: 'Password saat ini wajib diisi' }, { status: 400 })
    }
    if (newPassword.length < 8 || newPassword.length > 72) {
      return NextResponse.json({ error: 'Password baru harus 8-72 karakter' }, { status: 400 })
    }
    if (/\s/.test(newPassword)) {
      return NextResponse.json({ error: 'Password baru tidak boleh mengandung spasi' }, { status: 400 })
    }

    const row = await db.adminUser.findUnique({ where: { id: user.id } })
    if (!row) return unauthorized()

    if (!verifyPassword(currentPassword, row.passwordHash)) {
      return NextResponse.json({ error: 'Password saat ini salah' }, { status: 400 })
    }
    if (verifyPassword(newPassword, row.passwordHash)) {
      return NextResponse.json(
        { error: 'Password baru harus berbeda dari password saat ini' },
        { status: 400 }
      )
    }

    // Sesi yang sedang dipakai tetap hidup; sesi lain dihapus (login ulang)
    const store = await cookies()
    const currentSessionId = store.get(SESSION_COOKIE)?.value ?? null

    await db.$transaction([
      db.adminUser.update({
        where: { id: row.id },
        data: { passwordHash: hashPassword(newPassword) },
      }),
      db.adminSession.deleteMany({
        where: { userId: row.id, ...(currentSessionId ? { id: { not: currentSessionId } } : {}) },
      }),
    ])

    return NextResponse.json({ data: { username: row.username } })
  } catch (error) {
    console.error('POST /api/admin/users/change-password error', error)
    return NextResponse.json({ error: 'Gagal mengganti password' }, { status: 500 })
  }
}
