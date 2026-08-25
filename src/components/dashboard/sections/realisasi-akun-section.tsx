'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, CalendarRange, Landmark, Layers, PiggyBank, TrendingUp, Wallet } from 'lucide-react'
import { Input } from '@/components/ui/input'
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
import { AkunUraian } from '@/components/dashboard/akun-uraian'
import { useSettings } from '@/hooks/use-settings'
import { DEFAULT_SETTINGS } from '@/lib/default-settings'
import { useToday } from '@/hooks/use-today'
import { useLevelFilter } from '@/hooks/use-level-filter'
import { LevelFilterControls } from '@/components/dashboard/level-filter-controls'
import { usePeriodeFilter, PeriodeFilterControls } from '@/components/dashboard/periode-filter-controls'
import { formatDateFromISO, formatPct, formatRupiah, formatTriliun } from '@/lib/format'
import type { RealisasiAkunDto } from '@/types/budget'

interface Summary {
  totalApbd: number
  totalRealisasiPenerimaan: number
  totalRealisasiPengeluaran: number
  silpa: number
}

interface Meta {
  mode: 'opd' | 'aggregate' | 'global'
  opdCount: number
  opdNames: string[]
  periode: number | null
  periodeLabel: string | null
}

interface CompareRow {
  periode: number
  label: string
  penerimaan: number
  pengeluaran: number
  tersedia: boolean
}

async function fetchRealisasiAkun(periode: number | null): Promise<{
  data: RealisasiAkunDto[]
  summary: Summary
  meta: Meta
  compare?: CompareRow[]
}> {
  const params = new URLSearchParams({ compare: '1' })
  if (periode !== null) params.set('periode', String(periode))
  const res = await fetch(`/api/realisasi/akun?${params}`)
  if (!res.ok) throw new Error('Gagal memuat realisasi')
  return (await res.json()) as {
    data: RealisasiAkunDto[]
    summary: Summary
    meta: Meta
    compare?: CompareRow[]
  }
}

const GROUPS = [
  { key: 'PENDAPATAN', label: 'Realisasi Pendapatan' },
  { key: 'BELANJA', label: 'Realisasi Belanja' },
  { key: 'PEMBIAYAAN', label: 'Realisasi Pembiayaan' },
]

export function RealisasiAkunSection() {
  const settingsQuery = useSettings()
  const govName = settingsQuery.data?.govName ?? DEFAULT_SETTINGS.govName

  const { periode } = usePeriodeFilter()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['realisasi-akun', periode],
    queryFn: () => fetchRealisasiAkun(periode),
  })

  // Tanggal hari ini hanya tersedia setelah hidrasi (aman dari mismatch
  // zona waktu server vs browser); pengguna dapat mengubahnya lewat input.
  const today = useToday()
  const [dateOverride, setDateOverride] = useState<string | null>(null)
  const date = dateOverride ?? today

  const items = data?.data ?? []
  const summary = data?.summary
  const meta = data?.meta
  const compare = data?.compare
  const { isVisible } = useLevelFilter()

  const byGroup = useMemo(() => {
    const map = new Map<string, RealisasiAkunDto[]>()
    for (const g of GROUPS) {
      map.set(
        g.key,
        items.filter((i) => i.group === g.key && isVisible(i.level))
      )
    }
    return map
  }, [items, isVisible])

  return (
    <div>
      {/* Filter tanggal */}
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-4 py-3">
        <label htmlFor="tanggal-akun" className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Tanggal
        </label>
        <Input
          id="tanggal-akun"
          type="date"
          value={date}
          onChange={(e) => setDateOverride(e.target.value)}
          className="h-9 w-40"
        />
      </div>

      <SectionHeading
        title="Realisasi Anggaran"
        subtitle={govName}
        extra={
          date
            ? `Tahun Anggaran ${date.slice(0, 4)} — sampai dengan: ${formatDateFromISO(date)}`
            : undefined
        }
      />
      {isError && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Gagal memuat data realisasi.
        </p>
      )}

      {/* Keterangan asal data: kumpulan semua OPD menjadi satu konsolidasi */}
      {meta && meta.mode === 'aggregate' && (
        <p className="mb-4 flex flex-wrap items-center gap-1.5 rounded-lg border border-[#17408b]/20 bg-[#17408b]/5 px-3 py-2 text-xs text-foreground/80">
          <Layers className="h-3.5 w-3.5 shrink-0 text-[#17408b]" aria-hidden="true" />
          <span>
            Konsolidasi <strong>{meta.opdCount} OPD/SKPD</strong> — nilai per kode rekening adalah
            penjumlahan seluruh LRA OPD yang telah diimpor
            {meta.opdNames.length > 0 && (
              <span className="text-muted-foreground"> ({meta.opdNames.join(', ')})</span>
            )}
            .
          </span>
        </p>
      )}
      {meta && meta.mode === 'global' && (
        <p className="mb-4 flex flex-wrap items-center gap-1.5 rounded-lg border border-muted-foreground/20 bg-muted/30 px-3 py-2 text-xs text-foreground/80">
          <Layers className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span>
            Menampilkan data konsolidasi (global). Nilai per OPD akan tergabung otomatis di sini
            setelah setiap OPD/SKPD mengimpor LRA-nya.
          </span>
        </p>
      )}

      <PeriodeFilterControls className="mb-4" />

      {/* Label periode aktif */}
      {meta?.periodeLabel && (
        <p className="mb-3 flex flex-wrap items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">
          <CalendarRange className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Menampilkan realisasi kumulatif <strong>&nbsp;{meta.periodeLabel}</strong>
        </p>
      )}

      {/* Pembanding antar periode (triwulan & semester) — memudahkan Kepala
          Daerah membandingkan capaian antar periode sesuai ketentuan LRA */}
      {compare && compare.some((c) => c.tersedia) && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {compare
            .filter((c) => c.tersedia)
            .map((c) => (
              <div key={c.periode} className="rounded-lg border bg-card p-3 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {c.label}
                </p>
                <p className="mt-1 text-xs">
                  <span className="text-muted-foreground">Penerimaan:</span>{' '}
                  <span className="font-semibold tabular-nums text-[#17408b]">
                    {formatTriliun(c.penerimaan)}
                  </span>
                </p>
                <p className="text-xs">
                  <span className="text-muted-foreground">Pengeluaran:</span>{' '}
                  <span className="font-semibold tabular-nums text-[#b22222]">
                    {formatTriliun(c.pengeluaran)}
                  </span>
                </p>
              </div>
            ))}
        </div>
      )}

      <LevelFilterControls className="mb-4" />

      {/* Kartu ringkasan */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          icon={<Landmark className="h-5 w-5" aria-hidden="true" />}
          label="Total APBD (Belanja [5] + Pengeluaran [6.2])"
          value={summary ? formatTriliun(summary.totalApbd) : undefined}
          tone="blue"
        />
        <SummaryCard
          icon={<TrendingUp className="h-5 w-5" aria-hidden="true" />}
          label="Total Realisasi Penerimaan (Pendapatan [4] + Penerimaan [6.1])"
          value={summary ? formatTriliun(summary.totalRealisasiPenerimaan) : undefined}
          tone="green"
        />
        <SummaryCard
          icon={<Wallet className="h-5 w-5" aria-hidden="true" />}
          label="Total Realisasi Pengeluaran (Belanja [5] + Pengeluaran [6.2])"
          value={summary ? formatTriliun(summary.totalRealisasiPengeluaran) : undefined}
          tone="red"
        />
        <SummaryCard
          icon={<PiggyBank className="h-5 w-5" aria-hidden="true" />}
          label="Sisa Lebih Pembiayaan Anggaran (Total Penerimaan - Total Pengeluaran)"
          value={summary ? formatTriliun(summary.silpa) : undefined}
          tone="amber"
        />
      </div>

      {/* Tabel per kelompok */}
      {GROUPS.map((g) => (
        <div key={g.key} className="mb-6 overflow-x-auto rounded-lg border">
          <div className="bg-muted/60 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-foreground/80">
            {g.label}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">No</TableHead>
                <TableHead className="min-w-[280px]">Uraian</TableHead>
                <TableHead className="text-right whitespace-nowrap">Anggaran</TableHead>
                <TableHead className="text-right whitespace-nowrap">Realisasi</TableHead>
                <TableHead className="text-right">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [1, 2, 3].map((i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                byGroup.get(g.key)?.map((item, idx) => (
                  <TableRow key={item.code}>
                    <TableCell className="text-center text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-medium">
                      <AkunUraian code={item.code} name={item.name} level={item.level} withBadge />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatRupiah(item.anggaran)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatRupiah(item.realisasi)}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {formatPct(item.pct)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
  )
}

const TONES: Record<string, string> = {
  blue: 'border-l-4 border-l-blue-800 text-blue-900',
  green: 'border-l-4 border-l-green-700 text-green-900',
  red: 'border-l-4 border-l-red-800 text-red-900',
  amber: 'border-l-4 border-l-amber-600 text-amber-800',
}

const TONE_ICONS: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-800',
  green: 'bg-green-50 text-green-700',
  red: 'bg-red-50 text-red-800',
  amber: 'bg-amber-50 text-amber-700',
}

function SummaryCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value?: string
  tone: keyof typeof TONES
}) {
  return (
    <div className={`rounded-lg border bg-card p-4 shadow-sm ${TONES[tone]}`}>
      <div className="flex items-start gap-3">
        <div className={`rounded-md p-2 ${TONE_ICONS[tone]}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold leading-snug text-muted-foreground uppercase tracking-wide">
            {label}
          </p>
          {value ? (
            <p className="mt-1 text-xl font-extrabold tabular-nums">{value}</p>
          ) : (
            <Skeleton className="mt-2 h-6 w-24" />
          )}
        </div>
      </div>
    </div>
  )
}
