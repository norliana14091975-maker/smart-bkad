import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminUser, unauthorized } from '@/lib/auth'
import type { OpdSelfDto } from '@/types/budget'

/**
 * Data milik OPD yang sedang login: profil + realisasi SKPD-nya
 * (dicocokkan berdasarkan nama OPD).
 */
export async function GET() {
  try {
    const user = await getAdminUser()
    if (!user || user.role !== 'opd' || !user.opdId) return unauthorized()

    const opd = await db.opd.findUnique({
      where: { id: user.opdId },
      include: { user: { select: { username: true } } },
    })
    if (!opd) return unauthorized()

    const realisasiRow = await db.realisasiSkpd.findUnique({ where: { name: opd.name } })

    // Ringkasan per periode milik OPD (kumulatif s.d. bulan ke-N)
    const periodeRows = await db.realisasiSkpdPeriode.findMany({
      where: { name: opd.name },
      orderBy: { periode: 'asc' },
    })

    const data: OpdSelfDto = {
      opd: {
        id: opd.id,
        code: opd.code,
        name: opd.name,
        username: opd.user?.username ?? user.username,
        active: opd.active,
        createdAt: opd.createdAt.toISOString(),
      },
      realisasi: realisasiRow
        ? {
            pendapatan: { anggaran: realisasiRow.pendapatanAnggaran, realisasi: realisasiRow.pendapatanRealisasi },
            belanja: { anggaran: realisasiRow.belanjaAnggaran, realisasi: realisasiRow.belanjaRealisasi },
            pembiayaan: { anggaran: realisasiRow.pembiayaanAnggaran, realisasi: realisasiRow.pembiayaanRealisasi },
          }
        : null,
      realisasiPeriode: periodeRows.map((p) => ({
        periode: p.periode,
        pendapatan: { anggaran: p.pendapatanAnggaran, realisasi: p.pendapatanRealisasi },
        belanja: { anggaran: p.belanjaAnggaran, realisasi: p.belanjaRealisasi },
        pembiayaan: { anggaran: p.pembiayaanAnggaran, realisasi: p.pembiayaanRealisasi },
      })),
    }
    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET /api/opd/me error', error)
    return NextResponse.json({ error: 'Gagal memuat data OPD' }, { status: 500 })
  }
}
