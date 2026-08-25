import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { TAB_LABELS } from '@/app/api/pendapatan/route'
import { getLraSync, metaFrom, syncTabItems } from '@/lib/lra-sync'
import type { BudgetTabDto } from '@/types/budget'

// Tab pembiayaan → prefix kode rekening LRA
const TAB_PREFIX: Record<string, string> = {
  terima: '6.1',
  keluar: '6.2',
}

/**
 * Anggaran pembiayaan per tab (penerimaan/pengeluaran), disinkronkan dengan
 * LRA terimport pada level jenis (6.x.yy).
 */
export async function GET(request: NextRequest) {
  const tabsParam = request.nextUrl.searchParams.get('tabs') ?? 'terima,keluar'
  const tabs = tabsParam.split(',')
  try {
    const [rowsByTab, sync] = await Promise.all([
      (async () => {
        const out: Record<string, BudgetTabDto> = {}
        for (const tab of tabs) {
          const rows = await db.budgetItem.findMany({
            where: { section: 'pembiayaan', tab },
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
      if (!base || !prefix) return base

      const { items, apbdpItems, synced } = syncTabItems(base.items, sync, (r) => r.level === 3 && r.code.startsWith(`${prefix}.`))
      if (synced) anySynced = true
      return { ...base, items, apbdpItems }
    })

    return NextResponse.json({ data, meta: metaFrom(sync, anySynced) })
  } catch (error) {
    console.error('GET /api/pembiayaan error', error)
    return NextResponse.json({ error: 'Gagal memuat data pembiayaan' }, { status: 500 })
  }
}
