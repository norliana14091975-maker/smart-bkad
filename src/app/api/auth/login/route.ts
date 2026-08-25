import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSession,
  verifyPassword,
} from '@/lib/auth'

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { username?: unknown; password?: unknown }
      | null

    const username = typeof body?.username === 'string' ? body.username.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username dan password wajib diisi' },
        { status: 400 },
      )
    }

    const user = await db.adminUser.findUnique({
      where: { username },
      include: { opd: true },
    })
    if (!user || !verifyPassword(password, user.passwordHash)) {
      // Belum ada akun sama sekali → arahkan ke Setup Wizard first-run
      const totalUsers = await db.adminUser.count()
      if (totalUsers === 0) {
        return NextResponse.json(
          {
            error:
              'Belum ada akun pengguna. Setup Wizard akan terbuka otomatis di halaman utama untuk membuat akun admin pertama.',
          },
          { status: 403 },
        )
      }
      return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 })
    }

    // Akun dinonaktifkan admin (Manajemen Pengguna) → tolak login
    if (!user.active) {
      return NextResponse.json(
        { error: 'Akun ini dinonaktifkan. Hubungi admin.' },
        { status: 403 },
      )
    }

    // Akun OPD dengan OPD dinonaktifkan → tolak login
    if (user.role === 'opd' && user.opd && !user.opd.active) {
      return NextResponse.json(
        { error: 'Akun OPD ini dinonaktifkan. Hubungi admin.' },
        { status: 403 },
      )
    }

    // Buat sesi baru (id UUID, berlaku 7 hari) dan pasang cookie httpOnly
    const session = await createSession(user.id)

    const res = NextResponse.json({
      data: {
        username: user.username,
        role:
          user.role === 'opd'
            ? ('opd' as const)
            : user.role === 'kepala_daerah'
              ? ('kepala_daerah' as const)
              : ('admin' as const),
        opdName: user.opd?.name ?? null,
      },
    })
    res.cookies.set(SESSION_COOKIE, session.id, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
      expires: session.expiresAt,
    })
    return res
  } catch (error) {
    console.error('POST /api/auth/login error', error)
    return NextResponse.json({ error: 'Gagal memproses login' }, { status: 500 })
  }
}
