import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, unauthorized } from '@/lib/auth'
import type { AdminOverviewDto, ImportLogDto } from '@/types/budget'

function currentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export async function GET() {
  try {
    const user = await requireAdmin()
    if (!user) return unauthorized()

    const [apbdYears, budgetItems, realisasiAkun, realisasiSkpd, transparansiDocs, importLogs] =
      await Promise.all([
        db.apbdSummary.count(),
        db.budgetItem.count(),
        db.realisasiAkun.count(),
        db.realisasiSkpd.count(),
        db.transparansiDoc.count(),
        db.importLog.count(),
      ])

    // Upsert pengunjung bulan berjalan (buat baris jika belum ada)
    const month = currentMonth()
    const visitor = await db.visitorCounter.upsert({
      where: { month },
      update: {},
      create: { month, count: 0 },
    })

    const recentRows = await db.importLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    const recentImports: ImportLogDto[] = recentRows.map((r) => ({
      id: r.id,
      filename: r.filename,
      pages: r.pages,
      records: r.records,
      status: r.status,
      message: r.message,
      year: r.year,
      periode: r.periode,
      createdAt: r.createdAt.toISOString(),
    }))

    const data: AdminOverviewDto = {
      counts: {
        apbdYears,
        budgetItems,
        realisasiAkun,
        realisasiSkpd,
        transparansiDocs,
        importLogs,
      },
      visitorThisMonth: visitor.count,
      recentImports,
    }
    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET /api/admin/overview error', error)
    return NextResponse.json({ error: 'Gagal memuat ringkasan admin' }, { status: 500 })
  }
}
