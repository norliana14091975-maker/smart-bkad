import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireAdmin, SESSION_COOKIE, unauthorized } from '@/lib/auth'
import { resetUserPassword } from '@/lib/users'

/**
 * POST — reset password pengguna ({ id, password? }).
 * Bila target akun sendiri, sesi yang sedang berjalan tetap dipertahankan.
 * Password baru (kustom atau buatan sistem) hanya dikembalikan sekali.
 */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin()
    if (!admin) return unauthorized()

    const body = (await req.json().catch(() => null)) as
      | { id?: unknown; password?: unknown }
      | null

    const id = typeof body?.id === 'string' ? body.id : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    if (!id) {
      return NextResponse.json({ error: 'ID pengguna tidak valid' }, { status: 400 })
    }
    if (password && (password.length < 8 || password.length > 72)) {
      return NextResponse.json({ error: 'Password kustom 8-72 karakter' }, { status: 400 })
    }

    // Pertahankan sesi admin saat ini bila ia mereset password akunnya sendiri
    let keepSessionId: string | undefined
    if (id === admin.id) {
      const store = await cookies()
      keepSessionId = store.get(SESSION_COOKIE)?.value
    }

    const credentials = await resetUserPassword(id, password || undefined, keepSessionId)
    if (!credentials) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json({ data: { credentials } })
  } catch (error) {
    console.error('POST /api/admin/users/reset-password error', error)
    return NextResponse.json({ error: 'Gagal reset password' }, { status: 500 })
  }
}
