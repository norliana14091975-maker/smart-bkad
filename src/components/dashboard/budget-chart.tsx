'use client'

import { useMemo } from 'react'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatRupiah, formatRupiah0 } from '@/lib/format'

export interface ChartSeries {
  key: string
  label: string
  color: string
}

export interface ChartRow {
  label: string
  values: Record<string, number>
}

interface BudgetChartProps {
  title: string
  rows: ChartRow[]
  series: ChartSeries[]
  /** pembagi sumbu Y, mis. 1e12 untuk triliun */
  divisor?: number
  unitLabel?: string
  loading?: boolean
  /** tampilan tabel: baris label + kolom nilai */
  tableFirstColLabel?: string
  /** jika true, tabel menampilkan kolom nilai per seri (mode ringkasan tahunan) */
  summaryMode?: boolean
  height?: number
}

export function BudgetChart({
  title,
  rows,
  series,
  divisor = 1e12,
  unitLabel = 'JUMLAH (Triliun)',
  loading = false,
  tableFirstColLabel = 'Tahun',
  summaryMode = true,
  height = 320,
}: BudgetChartProps) {
  const data = useMemo(
    () =>
      rows.map((r) => {
        const entry: Record<string, string | number> = { name: r.label }
        for (const s of series) {
          entry[s.key] = r.values[s.key] / divisor
        }
        return entry
      }),
    [rows, series, divisor]
  )

  return (
    <div className="rounded-lg border bg-muted/40 p-4 sm:p-5">
      <h3 className="mb-3 text-center text-sm font-bold uppercase tracking-widest text-foreground/80">
        {title}
      </h3>
      {loading ? (
        <Skeleton className="w-full" style={{ height }} />
      ) : (
        <div className="w-full" style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12 }}
                stroke="#64748b"
                interval={0}
                angle={data.length > 6 ? -20 : 0}
                textAnchor={data.length > 6 ? 'end' : 'middle'}
                height={data.length > 6 ? 50 : 30}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="#64748b"
                width={56}
                label={{
                  value: unitLabel,
                  angle: -90,
                  position: 'insideLeft',
                  style: { fontSize: 10, fill: '#64748b' },
                }}
              />
              <Tooltip
                formatter={(value: number | string) =>
                  `${formatRupiah0(Number(value) * divisor)}`
                }
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
                  maxBarSize={42}
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
              <TableHead className="min-w-[200px]">{tableFirstColLabel}</TableHead>
              {series.map((s) => (
                <TableHead key={s.key} className="text-right whitespace-nowrap">
                  {s.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={series.length + 1}>
                  <Skeleton className="h-5 w-full" />
                </TableCell>
              </TableRow>
            ) : summaryMode ? (
              rows.map((r) => (
                <TableRow key={r.label}>
                  <TableCell className="font-medium">{r.label}</TableCell>
                  {series.map((s) => (
                    <TableCell key={s.key} className="text-right tabular-nums">
                      {formatRupiah(r.values[s.key] ?? 0)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={series.length + 1} className="text-center text-muted-foreground">
                  —
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
