'use client'

import { useQuery } from '@tanstack/react-query'
import { TrendingDown, TrendingUp } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
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
import { formatDateID, formatPct, formatRupiah0, formatTriliun } from '@/lib/format'
// Import tipe saja — file lib memiliki dependensi server (Prisma)
import type { ExecutiveSummaryDto } from '@/lib/executive-summary'

type ExecKpiDto = NonNullable<ExecutiveSummaryDto['kpi']>['pendapatan']
type ExecTopAkunDto = ExecutiveSummaryDto['topPendapatan'][number]

async function fetchExecutiveSummary(): Promise<ExecutiveSummaryDto> {
  const res = await fetch('/api/executive-summary')
  if (!res.ok) throw new Error('Gagal memuat ringkasan eksekutif')
  const json = (await res.json()) as { data: ExecutiveSummaryDto }
  return json.data
}

/** Nada warna capaian serapan: hijau >= 75, kuning 40-75, merah < 40. */
type Tone = 'emerald' | 'amber' | 'rose'

function toneOf(pct: number): Tone {
  if (pct >= 75) return 'emerald'
  if (pct >= 40) return 'amber'
  return 'rose'
}

const TONE_BADGE: Record<Tone, string> = {
  emerald: 'border-emerald-600/30 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-500/40 bg-amber-50 text-amber-700',
  rose: 'border-rose-600/30 bg-rose-50 text-rose-700',
}

const TONE_PROGRESS: Record<Tone, string> = {
  emerald: '[&_[data-slot=progress-indicator]]:bg-emerald-600',
  amber: '[&_[data-slot=progress-indicator]]:bg-amber-500',
  rose: '[&_[data-slot=progress-indicator]]:bg-rose-600',
}

/** Warna titik daftar sorotan (bergilir, deterministik). */
const BULLET_COLORS = ['bg-emerald-600', 'bg-amber-500', 'bg-rose-600', 'bg-[#17408b]']

/** Batas angka progres 0..100 agar bar tidak meluber saat capaian > 100%. */
function clampPct(pct: number): number {
  return Math.min(Math.max(pct, 0), 100)
}

/** Kartu KPI: anggaran (kecil, redup), realisasi (besar, tebal), % + progres. */
function KpiCard({ kpi }: { kpi: ExecKpiDto }) {
  const tone = toneOf(kpi.pct)
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/70">
          {kpi.label}
        </h3>
        <Badge variant="outline" className={TONE_BADGE[tone]}>
          {formatPct(kpi.pct)}
        </Badge>
      </div>
      <p className="mt-3 text-lg font-bold tabular-nums text-foreground sm:text-2xl">
        Rp {formatRupiah0(kpi.realisasi)}
      </p>
      <p className="mt-1 text-xs tabular-nums text-muted-foreground">
        Anggaran: Rp {formatRupiah0(kpi.anggaran)}
      </p>
      <Progress
        value={clampPct(kpi.pct)}
        aria-label={`Serapan ${kpi.label}: ${formatPct(kpi.pct)}`}
        className={`mt-3 h-2 bg-muted ${TONE_PROGRESS[tone]}`}
      />
    </div>
  )
}

/** Kartu tabel "5 Akun Teratas" (pendapatan / belanja) dengan gulir halus. */
function TopAkunCard({ title, rows }: { title: string; rows: ExecTopAkunDto[] }) {
  return (
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="px-4 pt-4 sm:px-5 sm:pt-5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/70">
          {title}
        </h3>
      </div>
      <div className="nice-scrollbar mt-3 max-h-96 overflow-y-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted">
            <TableRow className="hover:bg-muted">
              <TableHead className="pl-4 sm:pl-5">Kode</TableHead>
              <TableHead>Uraian</TableHead>
              <TableHead className="text-right whitespace-nowrap">Anggaran</TableHead>
              <TableHead className="text-right whitespace-nowrap">Realisasi</TableHead>
              <TableHead className="pr-4 text-right sm:pr-5">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                  Tidak ada data.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => {
                const tone = toneOf(r.pct)
                return (
                  <TableRow key={r.code} className="text-xs sm:text-[13px]">
                    <TableCell className="pl-4 font-mono text-muted-foreground sm:pl-5">
                      {r.code}
                    </TableCell>
                    <TableCell className="max-w-[160px] sm:max-w-[220px]">
                      <span className="block truncate" title={r.name}>
                        {r.name}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatRupiah0(r.anggaran)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatRupiah0(r.realisasi)}
                    </TableCell>
                    <TableCell className="pr-4 text-right sm:pr-5">
                      <Badge variant="outline" className={TONE_BADGE[tone]}>
                        {formatPct(r.pct)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

/** Kartu tren anggaran tahunan (APBDP) — grafik batang pendapatan vs belanja. */
function TrenAnggaranCard({ dto }: { dto: ExecutiveSummaryDto }) {
  const chartRows = dto.yearRows.map((r) => ({
    tahun: String(r.year),
    pendapatan: r.pendapatan,
    belanja: r.belanja,
  }))

  if (chartRows.length === 0) {
    return (
      <div className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-foreground/70">
          Tren Anggaran (APBDP)
        </h3>
        <p className="py-10 text-center text-sm text-muted-foreground">
          Belum ada data tren anggaran tahunan.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-foreground/70">
        Tren Anggaran (APBDP)
      </h3>
      <div className="w-full" style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis
              dataKey="tahun"
              tick={{ fontSize: 12 }}
              stroke="#64748b"
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              stroke="#64748b"
              width={64}
              tickFormatter={(value: number | string) => formatTriliun(Number(value))}
            />
            <Tooltip
              formatter={(value: number | string) => formatRupiah0(Number(value))}
              labelStyle={{ fontWeight: 700 }}
              contentStyle={{ borderRadius: 8, fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} iconType="square" />
            <Bar
              dataKey="pendapatan"
              name="Pendapatan"
              fill="#1e7a34"
              radius={[3, 3, 0, 0]}
              maxBarSize={42}
            />
            <Bar
              dataKey="belanja"
              name="Belanja"
              fill="#b22222"
              radius={[3, 3, 0, 0]}
              maxBarSize={42}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/** Isi utama ringkasan (dipanggil hanya bila data tersedia). */
function ExecutiveSummaryBody({ dto }: { dto: ExecutiveSummaryDto }) {
  const kpi = dto.kpi
  const surplus = !dto.deficit

  return (
    <>
      {/* Baris badge sumber data */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className="gap-1.5 border-emerald-600/40 bg-emerald-50 text-emerald-800"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-600" aria-hidden="true" />
          TA {dto.year}
        </Badge>
        <Badge variant="outline">{dto.periodeLabel ?? 'Periode n/a'}</Badge>
        <Badge variant="outline">Sumber: {dto.sourceLabel}</Badge>
      </div>

      {/* Kartu KPI */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpi && (
          <>
            <KpiCard kpi={kpi.pendapatan} />
            <KpiCard kpi={kpi.belanja} />
            <KpiCard kpi={kpi.pembiayaan} />
          </>
        )}
      </div>

      {/* Kartu SiLPA / Defisit */}
      {dto.silpa !== null && (
        <div
          className={`mt-4 flex items-center gap-4 rounded-lg border p-4 shadow-sm sm:p-5 ${
            surplus
              ? 'border-emerald-600/30 bg-emerald-50'
              : 'border-rose-600/30 bg-rose-50'
          }`}
        >
          {surplus ? (
            <TrendingUp
              className="h-8 w-8 shrink-0 text-emerald-600"
              aria-hidden="true"
            />
          ) : (
            <TrendingDown
              className="h-8 w-8 shrink-0 text-rose-600"
              aria-hidden="true"
            />
          )}
          <div className="min-w-0">
            <h3
              className={`text-xs font-bold uppercase tracking-widest ${
                surplus ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {surplus ? 'Surplus (SiLPA)' : 'Defisit'}
            </h3>
            <p
              className={`mt-1 text-lg font-bold tabular-nums sm:text-2xl ${
                surplus ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              Rp {formatRupiah0(Math.abs(dto.silpa))}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Pendapatan + penerimaan pembiayaan − belanja − pengeluaran
              pembiayaan (realisasi)
            </p>
          </div>
        </div>
      )}

      {/* Sorotan utama + tren anggaran */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-foreground/70">
            Sorotan Utama
          </h3>
          <ul className="space-y-2.5">
            {dto.highlights.map((h, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 text-sm leading-relaxed text-foreground/90"
              >
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    BULLET_COLORS[i % BULLET_COLORS.length]
                  }`}
                  aria-hidden="true"
                />
                <span>{h}</span>
              </li>
            ))}
          </ul>
        </div>
        <TrenAnggaranCard dto={dto} />
      </div>

      {/* Tabel 5 akun teratas */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopAkunCard title="5 Akun Pendapatan Teratas" rows={dto.topPendapatan} />
        <TopAkunCard title="5 Akun Belanja Teratas" rows={dto.topBelanja} />
      </div>

      {/* Kinerja OPD/SKPD */}
      <div className="mt-4 rounded-lg border bg-card shadow-sm">
        <div className="px-4 pt-4 sm:px-5 sm:pt-5">
          <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/70">
            Kinerja OPD/SKPD — Serapan Belanja TA {dto.year}
          </h3>
        </div>
        <div className="nice-scrollbar mt-3 max-h-96 overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted">
              <TableRow className="hover:bg-muted">
                <TableHead className="pl-4 sm:pl-5">OPD</TableHead>
                <TableHead className="text-right whitespace-nowrap">
                  Pendapatan Realisasi
                </TableHead>
                <TableHead className="text-right whitespace-nowrap">
                  Belanja Anggaran
                </TableHead>
                <TableHead className="text-right whitespace-nowrap">
                  Belanja Realisasi
                </TableHead>
                <TableHead className="pr-4 text-right sm:pr-5">Serapan %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dto.opdRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                    Belum ada ringkasan kinerja OPD/SKPD untuk tahun anggaran ini.
                  </TableCell>
                </TableRow>
              ) : (
                dto.opdRows.map((r) => {
                  const tone = toneOf(r.belanjaPct)
                  return (
                    <TableRow key={r.name} className="text-xs sm:text-[13px]">
                      <TableCell className="max-w-[180px] pl-4 font-medium sm:max-w-[260px] sm:pl-5 lg:max-w-[340px]">
                        <span className="block whitespace-normal break-words">
                          {r.name}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatRupiah0(r.pendapatanRealisasi)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatRupiah0(r.belanjaAnggaran)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatRupiah0(r.belanjaRealisasi)}
                      </TableCell>
                      <TableCell className="pr-4 text-right sm:pr-5">
                        <Badge variant="outline" className={TONE_BADGE[tone]}>
                          {formatPct(r.belanjaPct)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Catatan kaki */}
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Dibuat otomatis dari data LRA terimport ·{' '}
        {formatDateID(new Date(dto.generatedAt))}
      </p>
    </>
  )
}

/** Kerangka pemuatan selaras dengan tata letak isi. */
function ExecutiveSummarySkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Memuat ringkasan eksekutif">
      <div className="mx-auto flex justify-center gap-2">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-6 w-40" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
      <Skeleton className="h-24 rounded-lg" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
      <Skeleton className="h-48 rounded-lg" />
    </div>
  )
}

/**
 * Seksi Ringkasan Eksekutif — ikhtisar kinerja keuangan daerah untuk
 * pimpinan (admin & Kepala Daerah). Semua angka dihitung deterministik
 * di server dari data LRA terimport (tanpa AI).
 */
export function ExecutiveSummarySection() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['executive-summary'],
    queryFn: fetchExecutiveSummary,
  })

  return (
    <section aria-label="Ringkasan Eksekutif">
      <SectionHeading
        title="Ringkasan Eksekutif"
        subtitle="Ikhtisar kinerja keuangan daerah untuk pimpinan"
      />

      {isError && (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
        >
          Gagal memuat ringkasan eksekutif. Silakan muat ulang halaman.
        </p>
      )}

      {isLoading && <ExecutiveSummarySkeleton />}

      {data && !data.available && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-50 p-4 text-sm text-amber-800 sm:p-5">
          <p className="font-semibold">Belum ada data realisasi LRA.</p>
          <p className="mt-1">
            Ringkasan eksekutif akan tersedia setelah data LRA (realisasi
            anggaran) diimpor oleh OPD/SKPD atau melalui berkas konsolidasi BUD.
          </p>
        </div>
      )}

      {data && data.available && data.kpi && <ExecutiveSummaryBody dto={data} />}
    </section>
  )
}
