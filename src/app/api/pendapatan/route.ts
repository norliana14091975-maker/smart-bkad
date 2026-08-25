import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getLraSync, metaFrom, syncTabItems } from '@/lib/lra-sync'
import type { BudgetTabDto } from '@/types/budget'

export const TAB_LABELS: Record<string, string> = {
  utama: 'Pendapatan',
  ops: 'Operasi',
  mdl: 'Modal',
  ttdg: 'Tidak Terduga',
  tf: 'Transfer',
  urusan: 'Per-Urusan',
  terima: 'Penerimaan',
  keluar: 'Pengeluaran',
}

/**
 * Mengambil item anggaran untuk sebuah section dan kumpulan tab.
 * Contoh: /api/belanja?tabs=ops,mdl,ttdg,tf,urusan
 */
export async function getBudgetTabs(section: string, tabs: string[]): Promise<BudgetTabDto[]> {
  const result: BudgetTabDto[] = []
  for (const tab of tabs) {
    const rows = await db.budgetItem.findMany({
      where: { section, tab },
      orderBy: [{ code: 'asc' }, { year: 'desc' }],
    })
    result.push({
      tab,
      label: TAB_LABELS[tab] ?? tab,
      items: rows.map((r) => ({ code: r.code, name: r.name, year: r.year, amount: r.amount })),
    })
  }
  return result
}

export async function GET(request: NextRequest) {
  const tabs = request.nextUrl.searchParams.get('tabs') ?? 'utama'
  try {
    const [staticTabs, sync] = await Promise.all([
      getBudgetTabs('pendapatan', tabs.split(',')),
      getLraSync(),
    ])

    // Sinkronisasi: anggaran tahun berjalan dari LRA terimport (level jenis),
    // tahun sebelumnya tetap dari baseline untuk pembanding
    let anySynced = false
    const data: BudgetTabDto[] = staticTabs.map((t) => {
      const { items, synced } = syncTabItems(
        t.items,
        sync,
        (r) => r.group === 'PENDAPATAN' && r.level === 3
      )
      if (synced) anySynced = true
      return { ...t, items }
    })

    return NextResponse.json({ data, meta: metaFrom(sync, anySynced) })
  } catch (error) {
    console.error('GET budget error', error)
    return NextResponse.json({ error: 'Gagal memuat data anggaran' }, { status: 500 })
  }
}
