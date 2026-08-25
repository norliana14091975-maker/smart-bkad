import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { TAB_LABELS } from '@/app/api/pendapatan/route'
import { getLraSync, metaFrom, syncTabItems } from '@/lib/lra-sync'
import type { BudgetTabDto } from '@/types/budget'

// Pemetaan tab belanja → prefix kode rekening LRA.
// Tab "urusan" tidak memiliki padanan kode rekening → tetap memakai baseline.
const TAB_PREFIX: Record<string, string | null> = {
  ops: '5.1',
  mdl: '5.2',
  ttdg: '5.3',
  tf: '5.4',
  urusan: null,
}

/**
 * Anggaran belanja per tab. Tab kelompok (operasi/modal/tidak terduga/
 * transfer) disinkronkan dengan LRA terimport pada level jenis (5.x.yy);
 * tab per-urusan tetap dari baseline.
 */
export async function GET(request: NextRequest) {
  const tabsParam = request.nextUrl.searchParams.get('tabs') ?? 'ops,mdl,ttdg,tf,urusan'
  const tabs = tabsParam.split(',')
  try {
    const [rowsByTab, sync] = await Promise.all([
      (async () => {
        const out: Record<string, BudgetTabDto> = {}
        for (const tab of tabs) {
          const rows = await db.budgetItem.findMany({
            where: { section: 'belanja', tab },
            orderBy: [{ code: 'asc' }, { year: 'desc' }],
          })
          out[tab] = {
            tab,
            label: TAB_LABELS[tab] ?? tab,
            items: rows.map((r) => ({
              code: r.code,
              name: r.name,
              year: r.year,
              amount: r.amount,
            })),
          }
        }
        return out
      })(),
      getLraSync(),
    ])

    let anySynced = false
    const data: BudgetTabDto[] = tabs.map((tab) => {
      const base = rowsByTab[tab]
      const prefix = TAB_PREFIX[tab]
      if (!base || prefix === null) return base

      const { items, synced } = syncTabItems(base.items, sync, (r) => r.level === 3 && r.code.startsWith(`${prefix}.`))
      if (synced) anySynced = true
      return { ...base, items }
    })

    return NextResponse.json({ data, meta: metaFrom(sync, anySynced) })
  } catch (error) {
    console.error('GET /api/belanja error', error)
    return NextResponse.json({ error: 'Gagal memuat data belanja' }, { status: 500 })
  }
}
