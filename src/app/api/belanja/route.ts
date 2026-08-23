import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { TAB_LABELS } from '@/app/api/pendapatan/route'
import type { BudgetTabDto } from '@/types/budget'

export async function GET(request: NextRequest) {
  const tabsParam = request.nextUrl.searchParams.get('tabs') ?? 'ops,mdl,ttdg,tf,urusan'
  const tabs = tabsParam.split(',')
  try {
    const data: BudgetTabDto[] = []
    for (const tab of tabs) {
      const rows = await db.budgetItem.findMany({
        where: { section: 'belanja', tab },
        orderBy: [{ code: 'asc' }, { year: 'desc' }],
      })
      data.push({
        tab,
        label: TAB_LABELS[tab] ?? tab,
        items: rows.map((r) => ({ code: r.code, name: r.name, year: r.year, amount: r.amount })),
      })
    }
    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET /api/belanja error', error)
    return NextResponse.json({ error: 'Gagal memuat data belanja' }, { status: 500 })
  }
}
