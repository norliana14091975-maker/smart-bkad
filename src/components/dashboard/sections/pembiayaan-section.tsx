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
import { LraSyncBadge, type LraSyncMetaDto } from '@/components/dashboard/lra-sync-badge'
import { formatRupiah, formatRupiah0 } from '@/lib/format'
import type { BudgetItemDto, BudgetTabDto } from '@/types/budget'

const SERIES = [
  { key: 'y2026', label: '2026', color: '#7da7f5' },
  { key: 'y2025', label: '2025', color: '#1e3fd0' },
]

const SERIES_KELUAR = [
  { key: 'y2026', label: '2026', color: '#f3ce4a' },
  { key: 'y2025', label: '2025', color: '#e07b00' },
]

type TabKey = 'terima' | 'keluar'

async function fetchPembiayaan(): Promise<{ tabs: BudgetTabDto[]; meta?: LraSyncMetaDto }> {
  const res = await fetch('/api/pembiayaan?tabs=terima,keluar')
  if (!res.ok) throw new Error('Gagal memuat data pembiayaan')
  const json = (await res.json()) as { data: BudgetTabDto[]; meta?: LraSyncMetaDto }
  return { tabs: json.data, meta: json.meta }
}

export function PembiayaanSection() {
  const [tab, setTab] = useState<TabKey>('terima')
  const { data, isLoading, isError } = useQuery({
    queryKey: ['pembiayaan'],
    queryFn: fetchPembiayaan,
  })

  const tabsData = data?.tabs

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

  const series = tab === 'terima' ? SERIES : SERIES_KELUAR

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

  return (
    <div>
      <SectionHeading title="Anggaran Pembiayaan" subtitle="Pemerintah Provinsi DKI Jakarta" />
      {isError && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Gagal memuat data pembiayaan.
        </p>
      )}

      <LraSyncBadge meta={data?.meta} />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="w-full">
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-auto w-max gap-1 bg-muted p-1">
            <TabsTrigger
              value="terima"
              className="px-4 py-1.5 text-xs font-semibold uppercase data-[state=active]:bg-[#17408b] data-[state=active]:text-white sm:text-sm"
            >
              Penerimaan
            </TabsTrigger>
            <TabsTrigger
              value="keluar"
              className="px-4 py-1.5 text-xs font-semibold uppercase data-[state=active]:bg-[#17408b] data-[state=active]:text-white sm:text-sm"
            >
              Pengeluaran
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="mt-4 rounded-lg border bg-muted/40 p-4 sm:p-5">
          <h3 className="mb-3 text-center text-sm font-bold uppercase tracking-widest text-foreground/80">
            Anggaran {tab === 'terima' ? 'Penerimaan' : 'Pengeluaran'} Pembiayaan
          </h3>
          {isLoading ? (
            <Skeleton className="h-[320px] w-full" />
          ) : (
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#64748b" interval={0} />
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
                  {series.map((s) => (
                    <Bar
                      key={s.key}
                      dataKey={s.key}
                      name={s.label}
                      fill={s.color}
                      radius={[3, 3, 0, 0]}
                      maxBarSize={48}
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
                  <TableHead className="min-w-[320px]">AKUN</TableHead>
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
