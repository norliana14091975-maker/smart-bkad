import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { TransparansiDocDto } from '@/types/budget'

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get('type') === 'Realisasi' ? 'Realisasi' : 'APBD'
  try {
    const rows = await db.transparansiDoc.findMany({
      where: { type },
      orderBy: { id: 'asc' },
    })
    const data: TransparansiDocDto[] = rows.map((r) => ({ title: r.title, url: r.url }))
    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET /api/transparansi error', error)
    return NextResponse.json({ error: 'Gagal memuat dokumen transparansi' }, { status: 500 })
  }
}
