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
import { AkunUraian } from '@/components/dashboard/akun-uraian'
import type { BudgetItemDto, BudgetTabDto } from '@/types/budget'

const SERIES_MURNI = { key: 'murni', label: '2026 Murni', color: '#f4a08a' }
const SERIES_APBDP = { key: 'apbdp', label: '2026 APBDP (Perubahan)', color: '#f59e0b' }
const SERIES_2025 = { key: 'y2025', label: '2025', color: '#b22222' }

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

interface BelanjaRow {
  code: string
  name: string
  murni: number
  apbdp: number | null
  y2025: number
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

  // gabungkan murni/APBDP/2025 per kode akun untuk tab aktif
  // (murni & 2025 dari baseline; APBDP dari import LRA)
  const rows = useMemo<BelanjaRow[]>(() => {
    const tabData = tabsData?.find((t) => t.tab === tab)
    const byCode = new Map<string, BelanjaRow>()
    for (const it of tabData?.items ?? []) {
      const existing =
        byCode.get(it.code) ??
        { code: it.code, name: it.name, murni: 0, apbdp: null, y2025: 0 }
      if (it.year === 2026) existing.murni = it.amount
      if (it.year === 2025) existing.y2025 = it.amount
      byCode.set(it.code, existing)
    }
    for (const it of tabData?.apbdpItems ?? []) {
      const existing =
        byCode.get(it.code) ??
        { code: it.code, name: it.name, murni: 0, apbdp: null, y2025: 0 }
      existing.apbdp = it.amount
      byCode.set(it.code, existing)
    }
    return Array.from(byCode.values()).sort((a, b) => a.code.localeCompare(b.code))
  }, [tabsData, tab])

  const tabSynced =
    (tabsData?.find((t) => t.tab === tab)?.apbdpItems?.length ?? 0) > 0

  const chartData = rows.map((r) => ({
    name: r.code,
    murni: r.murni / 1e12,
    apbdp: r.apbdp !== null ? r.apbdp / 1e12 : null,
    y2025: r.y2025 / 1e12,
  }))

  const total = useMemo(
    () => ({
      murni: rows.reduce((a, r) => a + r.murni, 0),
      apbdp: tabSynced ? rows.reduce((a, r) => a + (r.apbdp ?? 0), 0) : null,
      y2025: rows.reduce((a, r) => a + r.y2025, 0),
    }),
    [rows, tabSynced]
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
                  {(tabSynced ? [SERIES_MURNI, SERIES_APBDP, SERIES_2025] : [SERIES_MURNI, SERIES_2025]).map((s) => (
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
                  <TableHead className="text-right whitespace-nowrap">2026 Murni</TableHead>
                  <TableHead className="text-right whitespace-nowrap">2025</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={tabSynced ? 4 : 3}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r) => (
                    <TableRow key={r.code}>
                      <TableCell className="font-medium">
                        <AkunUraian code={r.code} name={r.name} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatRupiah(r.murni)}</TableCell>
                      {tabSynced && (
                        <TableCell className="text-right tabular-nums">
                          {r.apbdp !== null ? formatRupiah(r.apbdp) : '—'}
                        </TableCell>
                      )}
                      <TableCell className="text-right tabular-nums">{formatRupiah(r.y2025)}</TableCell>
                    </TableRow>
                  ))
                )}
                {!isLoading && (
                  <TableRow className="bg-muted/70 font-bold">
                    <TableCell>JUMLAH</TableCell>
                    <TableCell className="text-right tabular-nums">{formatRupiah(total.murni)}</TableCell>
                {tabSynced && (
                  <TableCell className="text-right tabular-nums">
                    {total.apbdp !== null ? formatRupiah(total.apbdp) : '—'}
                  </TableCell>
                )}
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
