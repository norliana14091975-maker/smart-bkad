'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BudgetChart, type ChartRow } from '@/components/dashboard/budget-chart'
import { SectionHeading } from '@/components/dashboard/section-heading'
import { LraSyncBadge, type LraSyncMetaDto } from '@/components/dashboard/lra-sync-badge'
import { formatRupiah } from '@/lib/format'
import type { BudgetItemDto } from '@/types/budget'

const SERIES = [
  { key: 'y2026', label: '2026', color: '#86c67c' },
  { key: 'y2025', label: '2025', color: '#1e7a34' },
]

async function fetchPendapatan(): Promise<{ items: BudgetItemDto[]; meta?: LraSyncMetaDto }> {
  const res = await fetch('/api/pendapatan?tabs=utama')
  if (!res.ok) throw new Error('Gagal memuat data pendapatan')
  const json = (await res.json()) as {
    data: { items: BudgetItemDto[] }[]
    meta?: LraSyncMetaDto
  }
  return { items: json.data[0]?.items ?? [], meta: json.meta }
}

export function PendapatanSection() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['pendapatan'],
    queryFn: fetchPendapatan,
  })

  const items = data?.items ?? []

  // gabungkan item 2026 & 2025 per kode akun
  const rows = useMemo(() => {
    const byCode = new Map<string, { code: string; name: string; y2026: number; y2025: number }>()
    for (const it of items) {
      const existing = byCode.get(it.code) ?? { code: it.code, name: it.name, y2026: 0, y2025: 0 }
      if (it.year === 2026) existing.y2026 = it.amount
      if (it.year === 2025) existing.y2025 = it.amount
      byCode.set(it.code, existing)
    }
    return Array.from(byCode.values())
  }, [items])

  const chartRows: ChartRow[] = rows.map((r) => ({
    label: r.code,
    values: { y2026: r.y2026, y2025: r.y2025 },
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
      <SectionHeading
        title="Anggaran Pendapatan"
        subtitle="Pemerintah Provinsi DKI Jakarta"
      />
      {isError && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Gagal memuat data pendapatan.
        </p>
      )}

      <LraSyncBadge meta={data?.meta} />
      <div className="rounded-lg border bg-muted/40 p-4 sm:p-5">
        <h3 className="mb-3 text-center text-sm font-bold uppercase tracking-widest text-foreground/80">
          Anggaran Pendapatan per Akun
        </h3>
        <BudgetChartInline
          rows={chartRows}
          loading={isLoading}
          tableRows={rows.map((r) => ({
            code: r.code,
            name: r.name,
            y2026: r.y2026,
            y2025: r.y2025,
          }))}
          total={total}
        />
      </div>
    </div>
  )
}

import { Skeleton } from '@/components/ui/skeleton'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatRupiah0 } from '@/lib/format'

interface InlineRow {
  code: string
  name: string
  y2026: number
  y2025: number
}

function BudgetChartInline({
  rows,
  loading,
  tableRows,
  total,
}: {
  rows: ChartRow[]
  loading: boolean
  tableRows: InlineRow[]
  total: { y2026: number; y2025: number }
}) {
  const data = rows.map((r) => ({
    name: r.label,
    y2026: r.values.y2026 / 1e12,
    y2025: r.values.y2025 / 1e12,
  }))

  return (
    <>
      {loading ? (
        <Skeleton className="h-[320px] w-full" />
      ) : (
        <div className="h-[320px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
              {SERIES.map((s) => (
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
            {loading ? (
              <TableRow>
                <TableCell colSpan={3}>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              </TableRow>
            ) : (
              tableRows.map((r) => (
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
            {!loading && (
              <TableRow className="bg-muted/70 font-bold">
                <TableCell>JUMLAH</TableCell>
                <TableCell className="text-right tabular-nums">{formatRupiah(total.y2026)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatRupiah(total.y2025)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </>
  )
}
