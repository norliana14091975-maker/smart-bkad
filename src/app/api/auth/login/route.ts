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

    const user = await db.adminUser.findUnique({ where: { username } })
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 })
    }

    // Buat sesi baru (id UUID, berlaku 7 hari) dan pasang cookie httpOnly
    const session = await createSession(user.id)

    const res = NextResponse.json({ data: { username: user.username } })
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
