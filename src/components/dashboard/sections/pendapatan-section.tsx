'use client'

import { useMemo } from 'react'
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
import { useSettings } from '@/hooks/use-settings'
import { DEFAULT_SETTINGS } from '@/lib/default-settings'
import { formatRupiah, formatRupiah0 } from '@/lib/format'
import type { BudgetItemDto } from '@/types/budget'

async function fetchPendapatan(): Promise<{
  items: BudgetItemDto[]
  apbdpItems: BudgetItemDto[] | null
  meta?: LraSyncMetaDto
}> {
  const res = await fetch('/api/pendapatan?tabs=utama')
  if (!res.ok) throw new Error('Gagal memuat data pendapatan')
  const json = (await res.json()) as {
    data: { items: BudgetItemDto[]; apbdpItems?: BudgetItemDto[] | null }[]
    meta?: LraSyncMetaDto
  }
  return {
    items: json.data[0]?.items ?? [],
    apbdpItems: json.data[0]?.apbdpItems ?? null,
    meta: json.meta,
  }
}

export function PendapatanSection() {
  const settingsQuery = useSettings()
  const govName = settingsQuery.data?.govName ?? DEFAULT_SETTINGS.govName

  const { data, isLoading, isError } = useQuery({
    queryKey: ['pendapatan'],
    queryFn: fetchPendapatan,
  })

  const items = data?.items ?? []
  const apbdpItems = data?.apbdpItems ?? null
  const synced = apbdpItems !== null && apbdpItems.length > 0

  // Gabungkan item murni & APBDP per kode akun:
  // - murni / y2025 dari data statis (baseline)
  // - apbdp dari hasil import LRA (null bila kode tak ada di LRA)
  const rows = useMemo(() => {
    const byCode = new Map<
      string,
      { code: string; name: string; murni: number; apbdp: number | null; y2025: number }
    >()
    for (const it of items) {
      const existing =
        byCode.get(it.code) ??
        { code: it.code, name: it.name, murni: 0, apbdp: null, y2025: 0 }
      if (it.year === 2026) existing.murni = it.amount
      if (it.year === 2025) existing.y2025 = it.amount
      byCode.set(it.code, existing)
    }
    for (const it of apbdpItems ?? []) {
      const existing =
        byCode.get(it.code) ??
        { code: it.code, name: it.name, murni: 0, apbdp: null, y2025: 0 }
      existing.apbdp = it.amount
      byCode.set(it.code, existing)
    }
    return Array.from(byCode.values()).sort((a, b) => a.code.localeCompare(b.code))
  }, [items, apbdpItems])

  const total = useMemo(
    () => ({
      murni: rows.reduce((a, r) => a + r.murni, 0),
      apbdp: synced ? rows.reduce((a, r) => a + (r.apbdp ?? 0), 0) : null,
      y2025: rows.reduce((a, r) => a + r.y2025, 0),
    }),
    [rows, synced]
  )

  return (
    <div>
      <SectionHeading title="Anggaran Pendapatan" subtitle={govName} />
      {isError && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Gagal memuat data pendapatan.
        </p>
      )}

      <LraSyncBadge meta={data?.meta}>
        Anggaran perubahan (APBDP) tersinkron dengan LRA terimport
        {data?.meta && data.meta.opdCount > 0 && <>&nbsp;({data.meta.opdCount} OPD/SKPD)</>}
        <span className="font-normal text-emerald-800">
          &nbsp;— kolom Murni tetap, hasil import masuk kategori APBDP
        </span>
      </LraSyncBadge>

      <div className="rounded-lg border bg-muted/40 p-4 sm:p-5">
        <h3 className="mb-3 text-center text-sm font-bold uppercase tracking-widest text-foreground/80">
          Anggaran Pendapatan per Akun
        </h3>
        <BudgetChartInline
          rows={rows}
          loading={isLoading}
          synced={synced}
          total={total}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart + tabel inline (mendukung mode Murni/APBDP/2025)
// ---------------------------------------------------------------------------

type SectionRow = {
  code: string
  name: string
  murni: number
  apbdp: number | null
  y2025: number
}

const SERIES_MURNI = { key: 'murni', label: '2026 Murni', color: '#86c67c' }
const SERIES_APBDP = { key: 'apbdp', label: '2026 APBDP (Perubahan)', color: '#f59e0b' }
const SERIES_2025 = { key: 'y2025', label: '2025', color: '#1e7a34' }

function BudgetChartInline({
  rows,
  loading,
  synced,
  total,
}: {
  rows: SectionRow[]
  loading: boolean
  synced: boolean
  total: { murni: number; apbdp: number | null; y2025: number }
}) {
  const series = synced
    ? [SERIES_MURNI, SERIES_APBDP, SERIES_2025]
    : [SERIES_MURNI, SERIES_2025]

  const data = rows.map((r) => ({
    name: r.code,
    murni: r.murni / 1e12,
    apbdp: r.apbdp !== null ? r.apbdp / 1e12 : null,
    y2025: r.y2025 / 1e12,
  }))

  const colCount = synced ? 4 : 3

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
                formatter={(value: number | string) =>
                  formatRupiah0(Number(value) * 1e12)
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
              <TableHead className="text-right whitespace-nowrap">2026 Murni</TableHead>
              {synced && (
                <TableHead className="text-right whitespace-nowrap">
                  2026 APBDP (Perubahan)
                </TableHead>
              )}
              <TableHead className="text-right whitespace-nowrap">2025</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={colCount}>
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
                  <TableCell className="text-right tabular-nums">{formatRupiah(r.murni)}</TableCell>
                  {synced && (
                    <TableCell className="text-right tabular-nums">
                      {r.apbdp !== null ? formatRupiah(r.apbdp) : '—'}
                    </TableCell>
                  )}
                  <TableCell className="text-right tabular-nums">{formatRupiah(r.y2025)}</TableCell>
                </TableRow>
              ))
            )}
            {!loading && (
              <TableRow className="bg-muted/70 font-bold">
                <TableCell>JUMLAH</TableCell>
                <TableCell className="text-right tabular-nums">{formatRupiah(total.murni)}</TableCell>
                {synced && (
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
    </>
  )
}
