import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { RealisasiSkpdDto } from '@/types/budget'

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get('q')?.trim().toLowerCase() ?? ''
  try {
    const rows = await db.realisasiSkpd.findMany({ orderBy: { name: 'asc' } })
    let data: RealisasiSkpdDto[] = rows.map((r) => ({
      name: r.name,
      pendapatan: { anggaran: r.pendapatanAnggaran, realisasi: r.pendapatanRealisasi },
      belanja: { anggaran: r.belanjaAnggaran, realisasi: r.belanjaRealisasi },
      pembiayaan: { anggaran: r.pembiayaanAnggaran, realisasi: r.pembiayaanRealisasi },
    }))
    if (search) {
      data = data.filter((d) => d.name.toLowerCase().includes(search))
    }
    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET /api/realisasi/skpd error', error)
    return NextResponse.json({ error: 'Gagal memuat realisasi per SKPD' }, { status: 500 })
  }
}
