import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/auth'

export async function GET() {
  try {
    const user = await getAdminUser()
    if (!user) {
      return NextResponse.json({ error: 'Belum login' }, { status: 401 })
    }
    return NextResponse.json({
      data: {
        username: user.username,
        role: user.role,
        opdName: user.opdName,
      },
    })
  } catch (error) {
    console.error('GET /api/auth/me error', error)
    return NextResponse.json({ error: 'Gagal memuat sesi' }, { status: 500 })
  }
}
