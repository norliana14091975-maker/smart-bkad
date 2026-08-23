import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { SESSION_COOKIE, deleteSession } from '@/lib/auth'

export async function POST() {
  try {
    // Hapus sesi di database (jika ada) lalu bersihkan cookie
    const store = await cookies()
    const sessionId = store.get(SESSION_COOKIE)?.value
    if (sessionId) {
      await deleteSession(sessionId)
    }

    const res = NextResponse.json({ data: { ok: true } })
    res.cookies.set(SESSION_COOKIE, '', {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
    return res
  } catch (error) {
    console.error('POST /api/auth/logout error', error)
    return NextResponse.json({ error: 'Gagal keluar dari sesi' }, { status: 500 })
  }
}
