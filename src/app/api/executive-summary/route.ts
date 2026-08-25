import { NextResponse } from 'next/server'
import { requireExecutive, unauthorized } from '@/lib/auth'
import { getExecutiveSummary } from '@/lib/executive-summary'

/**
 * GET /api/executive-summary — Ringkasan Eksekutif untuk pimpinan
 * (kalkulasi deterministik dari data LRA terimport).
 * Hanya untuk admin penuh dan Kepala Daerah (akun OPD/anonim ditolak).
 */
export async function GET() {
  try {
    const user = await requireExecutive()
    if (!user) return unauthorized()

    const data = await getExecutiveSummary()
    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET /api/executive-summary error', error)
    return NextResponse.json(
      { error: 'Gagal memuat ringkasan eksekutif' },
      { status: 500 }
    )
  }
}
