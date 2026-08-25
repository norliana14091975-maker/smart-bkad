import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, unauthorized } from '@/lib/auth'

/** Riwayat import LRA seluruh OPD + konsolidasi (admin). */
export async function GET() {
  try {
    const admin = await requireAdmin()
    if (!admin) return unauthorized()

    const logs = await db.importLog.findMany({
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
      year: log.year,
      periode: log.periode,
      createdAt: log.createdAt.toISOString(),
    }))
    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET /api/admin/import/logs error', error)
    return NextResponse.json({ error: 'Gagal memuat riwayat import' }, { status: 500 })
  }
}
