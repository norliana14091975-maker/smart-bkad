import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
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
  // fallback agar file ini tidak dianggap route kosong saat diimpor
  const tabs = request.nextUrl.searchParams.get('tabs') ?? 'utama'
  try {
    const data = await getBudgetTabs('pendapatan', tabs.split(','))
    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET budget error', error)
    return NextResponse.json({ error: 'Gagal memuat data anggaran' }, { status: 500 })
  }
}
