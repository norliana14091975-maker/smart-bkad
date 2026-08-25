'use client'

import { Fragment } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, FileWarning, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { levelBadge } from '@/lib/kode-akun'
import { AkunUraian } from '@/components/dashboard/akun-uraian'
import { useLevelFilter } from '@/hooks/use-level-filter'
import { LevelFilterControls } from '@/components/dashboard/level-filter-controls'
import { usePeriodeFilter, PeriodeFilterControls } from '@/components/dashboard/periode-filter-controls'
import { formatPct, formatRupiah } from '@/lib/format'
import type { RealisasiAkunDto } from '@/types/budget'

const AKUN_GROUPS: { key: string; label: string }[] = [
  { key: 'PENDAPATAN', label: 'Realisasi Pendapatan' },
  { key: 'BELANJA', label: 'Realisasi Belanja' },
  { key: 'PEMBIAYAAN', label: 'Realisasi Pembiayaan' },
]

/**
 * Dialog detail rincian realisasi per-akun milik satu SKPD/OPD.
 * Ditampilkan LAYAR PENUH (kelas modal-fullscreen) dengan kepala tetap
 * (judul + filter periode & level) dan isi yang dapat digulir.
 * Baris ditampilkan hierarkis L1-L6 sesuai struktur kode rekening
 * Permendagri (hasil import LRA).
 */
export function SkpdDetailDialog({
  skpdName,
  opdId,
  onClose,
}: {
  skpdName: string
  opdId: number | null
  onClose: () => void
}) {
  const open = opdId !== null

  const { isVisible } = useLevelFilter()
  const { periode } = usePeriodeFilter()

  const detailQuery = useQuery({
    queryKey: ['skpd-detail-akun', opdId, periode],
    queryFn: async (): Promise<RealisasiAkunDto[]> => {
      const params = new URLSearchParams({ opdId: String(opdId) })
      if (periode !== null) params.set('periode', String(periode))
      const res = await fetch(`/api/realisasi/akun?${params}`)
      if (!res.ok) throw new Error('Gagal memuat rincian')
      return ((await res.json()) as { data: RealisasiAkunDto[] }).data
    },
    enabled: open,
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="modal-fullscreen flex flex-col gap-0 overflow-hidden p-0">
        {/* Kepala tetap: judul + filter periode & level */}
        <div className="shrink-0 border-b bg-background px-4 py-4 pr-14 sm:px-6">
          <DialogHeader className="gap-1 text-left">
            <DialogTitle className="flex flex-wrap items-center gap-1.5 text-base">
              <ChevronRight className="h-4 w-4 text-[#17408b]" aria-hidden="true" />
              Rincian Realisasi — {skpdName}
            </DialogTitle>
            <DialogDescription>
              Rincian per kode rekening (L1 Akun … L6 Sub Rincian Obyek) sesuai LRA yang diimpor.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
            <PeriodeFilterControls className="lg:min-w-72" />
            <LevelFilterControls className="lg:flex-1" />
          </div>
        </div>

        {/* Isi dapat digulir */}
        <div className="nice-scrollbar flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {detailQuery.isLoading ? (
            <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-[#17408b]" aria-hidden="true" />
              <p className="text-sm">Memuat rincian…</p>
            </div>
          ) : detailQuery.isError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              Gagal memuat rincian realisasi.
            </p>
          ) : detailQuery.data && detailQuery.data.length > 0 ? (
            detailQuery.data.every((r) => !isVisible(r.level)) ? (
              <p className="rounded-lg border border-dashed bg-muted/20 p-4 text-center text-sm text-muted-foreground">
                Tidak ada kode rekening pada level terpilih. Klik “Tampilkan Semua” untuk
                mengembalikan seluruh level.
              </p>
            ) : (
              AKUN_GROUPS.map((g) => {
                const rows = detailQuery.data.filter((r) => r.group === g.key && isVisible(r.level))
                if (rows.length === 0) return null
                return (
                  <Fragment key={g.key}>
                    <div className="overflow-hidden rounded-lg border">
                      <div className="bg-muted/60 px-4 py-2 text-xs font-bold uppercase tracking-wide text-foreground/80">
                        {g.label} ({rows.length} rekening)
                      </div>
                      <div className="nice-scrollbar max-h-[60vh] overflow-auto">
                        <Table>
                          <TableHeader className="sticky top-0 z-10 bg-muted">
                            <TableRow className="hover:bg-muted">
                              <TableHead className="w-36">Level</TableHead>
                              <TableHead className="min-w-[220px]">Kode &amp; Uraian</TableHead>
                              <TableHead className="text-right">Anggaran</TableHead>
                              <TableHead className="text-right">Realisasi</TableHead>
                              <TableHead className="text-right">%</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rows.map((item) => (
                              <TableRow key={item.code}>
                                <TableCell>
                                  <Badge
                                    variant="secondary"
                                    className={`whitespace-nowrap font-mono text-[10px] ${
                                      item.level <= 2 ? 'bg-[#17408b]/10 text-[#17408b]' : 'bg-muted'
                                    }`}
                                  >
                                    {levelBadge(item.level)}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <AkunUraian code={item.code} name={item.name} level={item.level} />
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {formatRupiah(item.anggaran)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {formatRupiah(item.realisasi)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums font-semibold text-[#17408b]">
                                  {formatPct(item.pct)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </Fragment>
                )
              })
            )
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed bg-muted/20 py-16 text-center text-muted-foreground">
              <FileWarning className="h-8 w-8" aria-hidden="true" />
              <p className="text-sm font-semibold text-foreground">
                Belum ada rincian per-akun untuk SKPD ini
              </p>
              <p className="max-w-sm text-xs">
                Rincian muncul otomatis setelah LRA SKPD/OPD ini diimpor melalui menu
                <strong> Import LRA (PDF)</strong> dan kode rekeningnya terklasifikasi.
              </p>
            </div>
          )}

          {detailQuery.isLoading && <Skeleton className="h-24 w-full" />}
        </div>
      </DialogContent>
    </Dialog>
  )
}
