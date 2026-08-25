import { NextResponse } from 'next/server'
import { requireExecutive, unauthorized } from '@/lib/auth'
import { getRiskAnalysis } from '@/lib/risk-analysis'

/**
 * GET /api/risk-analysis
 * Analisis risiko pengelolaan keuangan daerah (deterministik, berbasis data
 * LRA terimport). Hanya untuk peran eksekutif: admin dan Kepala Daerah.
 */
export async function GET() {
  try {
    const user = await requireExecutive()
    if (!user) return unauthorized()

    const data = await getRiskAnalysis()
    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET /api/risk-analysis error', error)
    return NextResponse.json({ error: 'Gagal memuat analisis risiko' }, { status: 500 })
  }
}
