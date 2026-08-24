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
import { useLevelFilter } from '@/hooks/use-level-filter'
import { LevelFilterControls } from '@/components/dashboard/level-filter-controls'
import { formatPct, formatRupiah0 } from '@/lib/format'
import type { RealisasiAkunDto } from '@/types/budget'

const AKUN_GROUPS: { key: string; label: string }[] = [
  { key: 'PENDAPATAN', label: 'Realisasi Pendapatan' },
  { key: 'BELANJA', label: 'Realisasi Belanja' },
  { key: 'PEMBIAYAAN', label: 'Realisasi Pembiayaan' },
]

/**
 * Dialog detail rincian realisasi per-akun milik satu SKPD/OPD.
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

  const detailQuery = useQuery({
    queryKey: ['skpd-detail-akun', opdId],
    queryFn: async (): Promise<RealisasiAkunDto[]> => {
      const res = await fetch(`/api/realisasi/akun?opdId=${opdId}`)
      if (!res.ok) throw new Error('Gagal memuat rincian')
      return ((await res.json()) as { data: RealisasiAkunDto[] }).data
    },
    enabled: open,
  })

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto nice-scrollbar sm:max-w-3xl lg:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-1.5 text-base">
            <ChevronRight className="h-4 w-4 text-[#17408b]" aria-hidden="true" />
            Rincian Realisasi — {skpdName}
          </DialogTitle>
          <DialogDescription>
            Rincian per kode rekening (L1 Akun … L6 Sub Rincian Obyek) sesuai LRA yang diimpor.
          </DialogDescription>
        </DialogHeader>

        <LevelFilterControls />

        {detailQuery.isLoading ? (
          <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
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
                  <div className="max-h-72 overflow-auto nice-scrollbar">
                    <Table>
                      <TableHeader>
                        <TableRow>
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
                              <div
                                className="flex items-baseline gap-2"
                                style={{ paddingLeft: `${(item.level - 1) * 14}px` }}
                              >
                                <span className="shrink-0 font-mono text-xs font-semibold">{item.code}</span>
                                <span className="text-sm">{item.name}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatRupiah0(item.anggaran)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatRupiah0(item.realisasi)}
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
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed bg-muted/20 py-10 text-center text-muted-foreground">
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
      </DialogContent>
    </Dialog>
  )
}
