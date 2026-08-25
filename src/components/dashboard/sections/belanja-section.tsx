'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SectionHeading } from '@/components/dashboard/section-heading'
import { useSettings } from '@/hooks/use-settings'
import { DEFAULT_SETTINGS } from '@/lib/default-settings'
import { LraSyncBadge, type LraSyncMetaDto } from '@/components/dashboard/lra-sync-badge'
import { formatRupiah, formatRupiah0 } from '@/lib/format'
import type { BudgetItemDto, BudgetTabDto } from '@/types/budget'

const SERIES = [
  { key: 'y2026', label: '2026', color: '#f4a08a' },
  { key: 'y2025', label: '2025', color: '#b22222' },
]

const TAB_KEYS = ['ops', 'mdl', 'ttdg', 'tf', 'urusan'] as const
type TabKey = (typeof TAB_KEYS)[number]

const TAB_LABELS: Record<TabKey, string> = {
  ops: 'Operasi',
  mdl: 'Modal',
  ttdg: 'Tidak Terduga',
  tf: 'Transfer',
  urusan: 'Per-Urusan',
}

async function fetchBelanja(): Promise<{ tabs: BudgetTabDto[]; meta?: LraSyncMetaDto }> {
  const res = await fetch('/api/belanja?tabs=ops,mdl,ttdg,tf,urusan')
  if (!res.ok) throw new Error('Gagal memuat data belanja')
  const json = (await res.json()) as { data: BudgetTabDto[]; meta?: LraSyncMetaDto }
  return { tabs: json.data, meta: json.meta }
}

export function BelanjaSection() {
  const settingsQuery = useSettings()
  const govName = settingsQuery.data?.govName ?? DEFAULT_SETTINGS.govName

  const [tab, setTab] = useState<TabKey>('ops')
  const { data, isLoading, isError } = useQuery({
    queryKey: ['belanja'],
    queryFn: fetchBelanja,
  })

  const tabsData = data?.tabs

  // gabungkan 2026/2025 per kode akun untuk tab aktif
  const rows = useMemo(() => {
    const tabData = tabsData?.find((t) => t.tab === tab)
    const byCode = new Map<string, { code: string; name: string; y2026: number; y2025: number }>()
    for (const it of tabData?.items ?? []) {
      const existing = byCode.get(it.code) ?? { code: it.code, name: it.name, y2026: 0, y2025: 0 }
      if (it.year === 2026) existing.y2026 = it.amount
      if (it.year === 2025) existing.y2025 = it.amount
      byCode.set(it.code, existing)
    }
    return Array.from(byCode.values())
  }, [tabsData, tab])

  const chartData = rows.map((r) => ({
    name: r.code,
    y2026: r.y2026 / 1e12,
    y2025: r.y2025 / 1e12,
  }))

  const total = useMemo(
    () => ({
      y2026: rows.reduce((a, r) => a + r.y2026, 0),
      y2025: rows.reduce((a, r) => a + r.y2025, 0),
    }),
    [rows]
  )

  const isUrusan = tab === 'urusan'

  return (
    <div>
      <SectionHeading title="Anggaran Belanja" subtitle={govName} />
      {isError && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Gagal memuat data belanja.
        </p>
      )}

      <LraSyncBadge meta={data?.meta} />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="w-full">
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-auto w-max gap-1 bg-muted p-1">
            {TAB_KEYS.map((k) => (
              <TabsTrigger
                key={k}
                value={k}
                className="px-4 py-1.5 text-xs font-semibold uppercase data-[state=active]:bg-[#17408b] data-[state=active]:text-white sm:text-sm"
              >
                {TAB_LABELS[k]}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="mt-4 rounded-lg border bg-muted/40 p-4 sm:p-5">
          <h3 className="mb-3 text-center text-sm font-bold uppercase tracking-widest text-foreground/80">
            Anggaran Belanja {TAB_LABELS[tab]}
          </h3>
          {isLoading ? (
            <Skeleton className="h-[320px] w-full" />
          ) : (
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: isUrusan ? 9 : 11 }}
                    stroke="#64748b"
                    interval={0}
                    angle={isUrusan ? -45 : 0}
                    textAnchor={isUrusan ? 'end' : 'middle'}
                    height={isUrusan ? 60 : 30}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    stroke="#64748b"
                    width={56}
                    label={{
                      value: 'JUMLAH (Triliun)',
                      angle: -90,
                      position: 'insideLeft',
                      style: { fontSize: 10, fill: '#64748b' },
                    }}
                  />
                  <Tooltip
                    formatter={(value: number | string) => formatRupiah0(Number(value) * 1e12)}
                    labelStyle={{ fontWeight: 700 }}
                    contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} iconType="square" />
                  {SERIES.map((s) => (
                    <Bar
                      key={s.key}
                      dataKey={s.key}
                      name={s.label}
                      fill={s.color}
                      radius={[3, 3, 0, 0]}
                      maxBarSize={isUrusan ? 20 : 48}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="mt-4 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60">
                  <TableHead className="min-w-[320px]">{isUrusan ? 'Urusan' : 'AKUN'}</TableHead>
                  <TableHead className="text-right whitespace-nowrap">2026</TableHead>
                  <TableHead className="text-right whitespace-nowrap">2025</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={3}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.code}>
                      <TableCell className="font-medium">
                        <span className="text-muted-foreground">{r.code} / </span>
                        {r.name}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatRupiah(r.y2026)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatRupiah(r.y2025)}</TableCell>
                    </TableRow>
                  ))
                )}
                {!isLoading && (
                  <TableRow className="bg-muted/70 font-bold">
                    <TableCell>JUMLAH</TableCell>
                    <TableCell className="text-right tabular-nums">{formatRupiah(total.y2026)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatRupiah(total.y2025)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </Tabs>
    </div>
  )
}
