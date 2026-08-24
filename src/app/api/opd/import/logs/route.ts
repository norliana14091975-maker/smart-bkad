import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminUser, unauthorized } from '@/lib/auth'

/** Riwayat import LRA milik OPD yang sedang login saja. */
export async function GET() {
  try {
    const user = await getAdminUser()
    if (!user || user.role !== 'opd' || !user.opdId) return unauthorized()

    const logs = await db.importLog.findMany({
      where: { opdId: user.opdId },
      include: { opd: { select: { name: true } } },
      orderBy: { id: 'desc' },
    })
    const data = logs.map((log) => ({
      id: log.id,
      filename: log.filename,
      pages: log.pages,
      records: log.records,
      status: log.status,
      message: log.message,
      opdName: log.opd?.name ?? null,
      createdAt: log.createdAt.toISOString(),
    }))
    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET /api/opd/import/logs error', error)
    return NextResponse.json({ error: 'Gagal memuat riwayat import' }, { status: 500 })
  }
}
