'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Binoculars,
  Gauge,
  Lightbulb,
  ListChecks,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  TriangleAlert,
} from 'lucide-react'
import { SectionHeading } from '@/components/dashboard/section-heading'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { cn } from '@/lib/utils'
import { formatDateID, formatPct } from '@/lib/format'
import type { RiskAnalysisDto, RiskItem, RiskLevel } from '@/lib/risk-analysis'

async function fetchRiskAnalysis(): Promise<{ data: RiskAnalysisDto }> {
  const res = await fetch('/api/risk-analysis')
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('Analisis risiko hanya tersedia untuk akun eksekutif (admin/Kepala Daerah).')
    }
    throw new Error('Gagal memuat analisis risiko')
  }
  return (await res.json()) as { data: RiskAnalysisDto }
}

/** Label tingkat risiko. */
const LEVEL_LABEL: Record<RiskLevel, string> = {
  rendah: 'Rendah',
  sedang: 'Sedang',
  tinggi: 'Tinggi',
}

/** Gaya badge per tingkat risiko: rendah=emerald, sedang=amber, tinggi=rose. */
const LEVEL_BADGE: Record<RiskLevel, string> = {
  rendah: 'border-emerald-300 bg-emerald-100 text-emerald-800',
  sedang: 'border-amber-300 bg-amber-100 text-amber-800',
  tinggi: 'border-rose-300 bg-rose-100 text-rose-800',
}

/** Warna angka besar skor per tingkat risiko. */
const LEVEL_TEXT: Record<RiskLevel, string> = {
  rendah: 'text-emerald-600',
  sedang: 'text-amber-500',
  tinggi: 'text-rose-600',
}

/** Warna isi batang skor (override indikator di dalam komponen Progress). */
const LEVEL_BAR: Record<RiskLevel, string> = {
  rendah: '[&_[data-slot=progress-indicator]]:bg-emerald-600',
  sedang: '[&_[data-slot=progress-indicator]]:bg-amber-500',
  tinggi: '[&_[data-slot=progress-indicator]]:bg-rose-600',
}

/** Latar kotak rekomendasi diberi rona sesuai tingkat risiko. */
const LEVEL_RECO_BG: Record<RiskLevel, string> = {
  rendah: 'border-emerald-200 bg-emerald-50',
  sedang: 'border-amber-200 bg-amber-50',
  tinggi: 'border-rose-200 bg-rose-50',
}

/** Ikon perisai per tingkat risiko. */
function LevelIcon({ level, className }: { level: RiskLevel; className?: string }) {
  const Icon = level === 'tinggi' ? ShieldAlert : level === 'sedang' ? ShieldQuestion : ShieldCheck
  return <Icon className={className} aria-hidden="true" />
}

/** Kerangka pemuatan seksi analisis risiko. */
function RiskSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="mx-auto h-5 w-64" />
      <Skeleton className="h-40 w-full rounded-lg" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-80 w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-56 w-full rounded-lg" />
    </div>
  )
}

/** Kartu satu indikator risiko. */
function RiskItemCard({ item }: { item: RiskItem }) {
  return (
    <Card className="gap-4 rounded-lg py-5">
      <CardContent className="space-y-3 px-5">
        {/* Kepala: kategori + badge tingkat */}
        <div className="flex items-start justify-between gap-2">
          <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {item.category}
          </p>
          <Badge className={cn('gap-1', LEVEL_BADGE[item.level])}>
            <LevelIcon level={item.level} className="h-3 w-3" />
            {LEVEL_LABEL[item.level]}
          </Badge>
        </div>

        <h3 className="font-semibold leading-snug text-foreground">{item.title}</h3>

        {/* Batang skor */}
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Skor risiko</span>
            <span className="font-semibold tabular-nums text-foreground">
              Skor {item.score}/100
            </span>
          </div>
          <Progress
            value={item.score}
            aria-label={`Skor risiko ${item.title}: ${item.score} dari 100`}
            className={cn('h-2', LEVEL_BAR[item.level])}
          />
        </div>

        {/* Narasi situasi */}
        <p className="text-sm leading-relaxed text-foreground/90">{item.description}</p>

        {/* Metrik pendukung */}
        {item.detail.length > 0 && (
          <dl className="space-y-1.5 border-t pt-2.5">
            {item.detail.map((d) => (
              <div key={d.label} className="flex items-baseline justify-between gap-3 text-xs">
                <dt className="shrink-0 text-muted-foreground">{d.label}</dt>
                <dd className="break-words text-right font-medium tabular-nums text-foreground">
                  {d.value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {/* Rekomendasi mitigasi */}
        <div
          className={cn(
            'flex gap-2 rounded-md border p-2.5 text-xs leading-relaxed',
            LEVEL_RECO_BG[item.level]
          )}
        >
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <p>
            <span className="font-semibold">Rekomendasi:</span> {item.recommendation}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

export function RiskAnalysisSection() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['risk-analysis'],
    queryFn: fetchRiskAnalysis,
  })

  const risk = data?.data

  // Target pace periode (realisasi kumulatif s.d. bulan N ≈ N/12 anggaran)
  const expectedPct = risk?.periode ? (risk.periode / 12) * 100 : null

  // Urutan tabel ringkas: skor tertinggi lebih dulu (statis, tanpa sorting)
  const sortedItems = useMemo(
    () => (risk?.items ?? []).slice().sort((a, b) => b.score - a.score),
    [risk]
  )

  // Distribusi tingkat indikator untuk ringkasan cepat
  const levelCounts = useMemo(() => {
    const counts: Record<RiskLevel, number> = { rendah: 0, sedang: 0, tinggi: 0 }
    for (const it of risk?.items ?? []) counts[it.level] += 1
    return counts
  }, [risk])

  return (
    <div>
      <SectionHeading
        title="Analisis Risiko"
        subtitle="Identifikasi & mitigasi risiko pengelolaan keuangan daerah"
      />

      {isError && (
        <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error instanceof Error
            ? error.message
            : 'Gagal memuat analisis risiko. Silakan muat ulang halaman.'}
        </p>
      )}

      {isLoading && <RiskSkeleton />}

      {!isLoading && risk && !risk.available && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-6 text-center">
          <TriangleAlert className="mx-auto mb-2 h-8 w-8 text-amber-500" aria-hidden="true" />
          <p className="font-semibold text-amber-900">Belum ada data realisasi LRA</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-amber-800">
            Analisis risiko dihitung dari data realisasi LRA yang diimpor. Impor LRA terlebih
            dahulu agar skor risiko, indikator, dan rekomendasi mitigasi dapat ditampilkan.
          </p>
        </div>
      )}

      {!isLoading && risk && risk.available && (
        <>
          {/* Baris badge konteks data */}
          <div className="mb-5 flex flex-wrap items-center justify-center gap-2">
            <Badge
              variant="outline"
              className="border-[#17408b]/30 bg-[#17408b]/5 font-semibold text-[#17408b]"
            >
              TA {risk.year}
            </Badge>
            {risk.periodeLabel && (
              <Badge variant="outline" className="border-slate-300 bg-muted/50 text-slate-700">
                {risk.periodeLabel}
              </Badge>
            )}
            <Badge variant="outline" className="border-slate-300 bg-muted/50 text-slate-700">
              {risk.items.length} indikator
            </Badge>
          </div>

          {/* Skor risiko keseluruhan */}
          <Card className="mb-5 gap-4 rounded-lg">
            <CardHeader className="pb-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Gauge className="h-4 w-4 text-[#17408b]" aria-hidden="true" />
                Skor Risiko Keseluruhan
              </CardTitle>
              <CardDescription>
                Rata-rata tertimbang seluruh indikator (realisasi pendapatan &amp; belanja
                berbobot 2×)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex items-baseline gap-2 sm:w-44 sm:justify-center">
                  <span
                    className={cn(
                      'text-5xl font-bold tabular-nums leading-none',
                      LEVEL_TEXT[risk.overallLevel]
                    )}
                  >
                    {risk.overallScore}
                  </span>
                  <span className="text-sm text-muted-foreground">/ 100</span>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Badge className={cn('gap-1', LEVEL_BADGE[risk.overallLevel])}>
                      <LevelIcon level={risk.overallLevel} className="h-3 w-3" />
                      Tingkat {LEVEL_LABEL[risk.overallLevel]}
                    </Badge>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {levelCounts.tinggi} tinggi · {levelCounts.sedang} sedang ·{' '}
                      {levelCounts.rendah} rendah
                    </span>
                  </div>
                  <Progress
                    value={risk.overallScore}
                    aria-label={`Skor risiko keseluruhan ${risk.overallScore} dari 100`}
                    className={cn('h-3', LEVEL_BAR[risk.overallLevel])}
                  />
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-foreground/90">{risk.summary}</p>
            </CardContent>
          </Card>

          {/* Grid kartu indikator risiko */}
          {risk.items.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {risk.items.map((item) => (
                <RiskItemCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Belum ada indikator yang dapat dihitung dari data saat ini.
            </p>
          )}

          {/* Tabel ringkas seluruh indikator */}
          {sortedItems.length > 0 && (
            <Card className="mt-5 gap-4 rounded-lg">
              <CardHeader className="pb-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ListChecks className="h-4 w-4 text-[#17408b]" aria-hidden="true" />
                  Ringkasan Seluruh Indikator
                </CardTitle>
                <CardDescription>Diurutkan dari skor risiko tertinggi</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto nice-scrollbar">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead scope="col">Indikator</TableHead>
                        <TableHead scope="col">Kategori</TableHead>
                        <TableHead scope="col" className="text-right">
                          Skor
                        </TableHead>
                        <TableHead scope="col">Tingkat</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedItems.map((it) => (
                        <TableRow key={it.id}>
                          <TableCell
                            className="max-w-[240px] truncate font-medium"
                            title={it.title}
                          >
                            {it.title}
                          </TableCell>
                          <TableCell className="text-muted-foreground">{it.category}</TableCell>
                          <TableCell className="text-right font-semibold tabular-nums">
                            {it.score}
                          </TableCell>
                          <TableCell>
                            <Badge className={LEVEL_BADGE[it.level]}>
                              {LEVEL_LABEL[it.level]}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* OPD watchlist: serapan di bawah target periode */}
          {risk.opdWatchlist.length > 0 && (
            <Card className="mt-5 gap-4 rounded-lg">
              <CardHeader className="pb-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Binoculars className="h-4 w-4 text-[#17408b]" aria-hidden="true" />
                  OPD Watchlist — Perlu Perhatian
                </CardTitle>
                <CardDescription>
                  OPD dengan serapan belanja di bawah target periode
                  {expectedPct !== null ? ` (${formatPct(expectedPct)})` : ''}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead scope="col">OPD</TableHead>
                      <TableHead scope="col" className="text-right">
                        Serapan Belanja
                      </TableHead>
                      <TableHead scope="col">Tingkat Risiko</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {risk.opdWatchlist.map((opd) => (
                      <TableRow key={opd.name}>
                        <TableCell className="max-w-[280px] truncate font-medium" title={opd.name}>
                          {opd.name}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {formatPct(opd.belanjaPct)}
                        </TableCell>
                        <TableCell>
                          <Badge className={LEVEL_BADGE[opd.level]}>{LEVEL_LABEL[opd.level]}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Catatan kaki */}
          <p className="mt-4 text-center text-xs text-muted-foreground">
            Analisis deterministik berbasis data LRA terimport ·{' '}
            {formatDateID(new Date(risk.generatedAt))}
          </p>
        </>
      )}
    </div>
  )
}
