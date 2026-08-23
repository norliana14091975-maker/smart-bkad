import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { VisitorDto } from '@/types/budget'

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export async function GET() {
  try {
    const month = currentMonth()
    const row = await db.visitorCounter.upsert({
      where: { month },
      update: {},
      create: { month, count: 0 },
    })
    const data: VisitorDto = { month: row.month, count: row.count }
    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET /api/visitor error', error)
    return NextResponse.json({ error: 'Gagal memuat pengunjung' }, { status: 500 })
  }
}

export async function POST() {
  try {
    const month = currentMonth()
    const row = await db.visitorCounter.upsert({
      where: { month },
      update: { count: { increment: 1 } },
      create: { month, count: 1 },
    })
    const data: VisitorDto = { month: row.month, count: row.count }
    return NextResponse.json({ data })
  } catch (error) {
    console.error('POST /api/visitor error', error)
    return NextResponse.json({ error: 'Gagal mencatat kunjungan' }, { status: 500 })
  }
}
