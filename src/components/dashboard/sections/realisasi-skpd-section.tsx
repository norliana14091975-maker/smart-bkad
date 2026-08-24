'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { useToday } from '@/hooks/use-today'
import { SkpdDetailDialog } from '@/components/dashboard/sections/skpd-detail-dialog'
import { formatDateFromISO, formatRupiah0 } from '@/lib/format'
import type { RealisasiSkpdDto } from '@/types/budget'

async function fetchSkpd(q: string): Promise<RealisasiSkpdDto[]> {
  const res = await fetch(`/api/realisasi/skpd${q ? `?q=${encodeURIComponent(q)}` : ''}`)
  if (!res.ok) throw new Error('Gagal memuat realisasi SKPD')
  const json = (await res.json()) as { data: RealisasiSkpdDto[] }
  return json.data
}

export function RealisasiSkpdSection() {
  const [search, setSearch] = useState('')
  const [applied, setApplied] = useState('')

  // Tanggal hari ini hanya tersedia setelah hidrasi (aman dari mismatch
  // zona waktu server vs browser); pengguna dapat mengubahnya lewat input.
  const today = useToday()
  const [dateOverride, setDateOverride] = useState<string | null>(null)
  const date = dateOverride ?? today

  const { data, isLoading, isError } = useQuery({
    queryKey: ['realisasi-skpd', applied],
    queryFn: () => fetchSkpd(applied),
  })

  // SKPD yang sedang dibuka dialog rinciannya (drill-down per-akun)
  const [detail, setDetail] = useState<{ name: string; opdId: number | null } | null>(null)

  const totals = useMemo(() => {
    const t = { pendAng: 0, pendReal: 0, belAng: 0, belReal: 0, pemAng: 0, pemReal: 0 }
    for (const d of data ?? []) {
      t.pendAng += d.pendapatan.anggaran
      t.pendReal += d.pendapatan.realisasi
      t.belAng += d.belanja.anggaran
      t.belReal += d.belanja.realisasi
      t.pemAng += d.pembiayaan.anggaran
      t.pemReal += d.pembiayaan.realisasi
    }
    return t
  }, [data])

  return (
    <div>
      {/* Filter bar */}
      <div className="mb-5 flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 px-4 py-3">
        <div>
          <label htmlFor="tanggal-skpd" className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
            <CalendarDays className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Tanggal
          </label>
          <Input
            id="tanggal-skpd"
            type="date"
            value={date}
            onChange={(e) => setDateOverride(e.target.value)}
            className="h-9 w-40"
          />
        </div>
        <div>
          <label htmlFor="filter-skpd" className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Search className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            Cari SKPD
          </label>
          <Input
            id="filter-skpd"
            placeholder="Nama SKPD…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setApplied(search)
            }}
            className="h-9 w-56"
          />
        </div>
        <div>
          <label htmlFor="kelompok-skpd" className="mb-1 block text-sm font-semibold text-foreground">
            Filter
          </label>
          <Select defaultValue="semua">
            <SelectTrigger id="kelompok-skpd" className="h-9 w-36">
              <SelectValue placeholder="Semua" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua</SelectItem>
              <SelectItem value="komisi">Komisi</SelectItem>
              <SelectItem value="asisten">Asisten</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          onClick={() => setApplied(search)}
          className="h-9 bg-[#17408b] px-5 text-white hover:bg-[#12326e]"
        >
          Tampilkan
        </Button>
      </div>

      <SectionHeading
        title="Realisasi Anggaran"
        subtitle="Pemerintah Provinsi DKI Jakarta"
        extra={
          date
            ? `Tahun Anggaran ${date.slice(0, 4)} — sampai dengan: ${formatDateFromISO(date)}`
            : undefined
        }
      />
      {isError && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Gagal memuat data realisasi SKPD.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60">
              <TableHead rowSpan={2} className="w-12 align-middle text-center">
                No
              </TableHead>
              <TableHead rowSpan={2} className="min-w-[260px] align-middle">
                Nama SKPD Gabungan
              </TableHead>
              <TableHead colSpan={2} className="text-center">
                Pendapatan
              </TableHead>
              <TableHead colSpan={2} className="text-center">
                Belanja
              </TableHead>
              <TableHead colSpan={2} className="text-center">
                Pembiayaan
              </TableHead>
            </TableRow>
            <TableRow className="bg-muted/40">
              <TableHead className="text-right whitespace-nowrap">Anggaran</TableHead>
              <TableHead className="text-right whitespace-nowrap">Realisasi</TableHead>
              <TableHead className="text-right whitespace-nowrap">Anggaran</TableHead>
              <TableHead className="text-right whitespace-nowrap">Realisasi</TableHead>
              <TableHead className="text-right whitespace-nowrap">Anggaran</TableHead>
              <TableHead className="text-right whitespace-nowrap">Realisasi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [1, 2, 3, 4, 5].map((i) => (
                <TableRow key={i}>
                  <TableCell colSpan={8}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : data && data.length > 0 ? (
              data.map((d, idx) => (
                <TableRow
                  key={d.name}
                  className={`text-xs transition-colors sm:text-[13px] ${
                    d.opdId ? 'cursor-pointer hover:bg-muted/60' : ''
                  }`}
                  onClick={() => d.opdId && setDetail({ name: d.name, opdId: d.opdId })}
                  title={d.opdId ? 'Klik untuk melihat rincian realisasi per-akun' : undefined}
                >
                  <TableCell className="text-center text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      {d.name}
                      {d.opdId && (
                        <span
                          className="rounded bg-[#17408b]/10 px-1 py-0.5 font-mono text-[9px] font-bold text-[#17408b]"
                          title="Rincian tersedia"
                        >
                          RINCIAN
                        </span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatRupiah0(d.pendapatan.anggaran)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatRupiah0(d.pendapatan.realisasi)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatRupiah0(d.belanja.anggaran)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatRupiah0(d.belanja.realisasi)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatRupiah0(d.pembiayaan.anggaran)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatRupiah0(d.pembiayaan.realisasi)}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  Tidak ada SKPD yang cocok dengan pencarian.
                </TableCell>
              </TableRow>
            )}
            {!isLoading && data && data.length > 0 && (
              <TableRow className="bg-muted/70 font-bold text-xs sm:text-[13px]">
                <TableCell colSpan={2}>JUMLAH</TableCell>
                <TableCell className="text-right tabular-nums">{formatRupiah0(totals.pendAng)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatRupiah0(totals.pendReal)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatRupiah0(totals.belAng)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatRupiah0(totals.belReal)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatRupiah0(totals.pemAng)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatRupiah0(totals.pemReal)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog rincian per-akun (drill-down) */}
      {detail && (
        <SkpdDetailDialog
          skpdName={detail.name}
          opdId={detail.opdId}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  )
}
