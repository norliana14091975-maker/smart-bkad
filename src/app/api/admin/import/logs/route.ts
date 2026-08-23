import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, unauthorized } from '@/lib/auth'
import type { ImportLogDto } from '@/types/budget'

export async function GET() {
  try {
    const user = await requireAdmin()
    if (!user) return unauthorized()

    const rows = await db.importLog.findMany({
      orderBy: { createdAt: 'desc' },
    })
    const data: ImportLogDto[] = rows.map((r) => ({
      id: r.id,
      filename: r.filename,
      pages: r.pages,
      records: r.records,
      status: r.status,
      message: r.message,
      createdAt: r.createdAt.toISOString(),
    }))
    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET /api/admin/import/logs error', error)
    return NextResponse.json({ error: 'Gagal memuat riwayat import' }, { status: 500 })
  }
}
