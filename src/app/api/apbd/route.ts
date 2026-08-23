import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { ApbdSummaryDto } from '@/types/budget'

export async function GET() {
  try {
    const rows = await db.apbdSummary.findMany({ orderBy: { year: 'desc' } })
    const data: ApbdSummaryDto[] = rows.map((r) => ({
      year: r.year,
      pendapatan: { apbd: r.pendapatanApbd, apbdp: r.pendapatanApbdp },
      belanja: { apbd: r.belanjaApbd, apbdp: r.belanjaApbdp },
      penerimaanPembiayaan: { apbd: r.terimaApbd, apbdp: r.terimaApbdp },
      pengeluaranPembiayaan: { apbd: r.keluarApbd, apbdp: r.keluarApbdp },
    }))
    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET /api/apbd error', error)
    return NextResponse.json({ error: 'Gagal memuat data APBD' }, { status: 500 })
  }
}
