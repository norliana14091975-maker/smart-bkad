import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { RealisasiAkunDto } from '@/types/budget'

export async function GET() {
  try {
    const rows = await db.realisasiAkun.findMany({ orderBy: { code: 'asc' } })
    const data: RealisasiAkunDto[] = rows.map((r) => ({
      code: r.code,
      name: r.name,
      group: r.group,
      anggaran: r.anggaran,
      realisasi: r.realisasi,
      pct: r.anggaran > 0 ? (r.realisasi / r.anggaran) * 100 : 0,
    }))

    const totalApbd =
      rows.filter((r) => r.group === 'BELANJA').reduce((a, r) => a + r.anggaran, 0) +
      rows.filter((r) => r.group === 'PEMBIAYAAN' && r.code.startsWith('6.2')).reduce((a, r) => a + r.anggaran, 0)

    const totalPenerimaan =
      rows.filter((r) => r.group === 'PENDAPATAN').reduce((a, r) => a + r.realisasi, 0) +
      rows.filter((r) => r.group === 'PEMBIAYAAN' && r.code.startsWith('6.1')).reduce((a, r) => a + r.realisasi, 0)

    const totalPengeluaran =
      rows.filter((r) => r.group === 'BELANJA').reduce((a, r) => a + r.realisasi, 0) +
      rows.filter((r) => r.group === 'PEMBIAYAAN' && r.code.startsWith('6.2')).reduce((a, r) => a + r.realisasi, 0)

    return NextResponse.json({
      data,
      summary: {
        totalApbd,
        totalRealisasiPenerimaan: totalPenerimaan,
        totalRealisasiPengeluaran: totalPengeluaran,
        silpa: totalPenerimaan - totalPengeluaran,
      },
    })
  } catch (error) {
    console.error('GET /api/realisasi/akun error', error)
    return NextResponse.json({ error: 'Gagal memuat realisasi per akun' }, { status: 500 })
  }
}
