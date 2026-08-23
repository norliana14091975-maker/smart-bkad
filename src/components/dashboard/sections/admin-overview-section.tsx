'use client'

import { useQuery } from '@tanstack/react-query'
import {
  BarChart3,
  Database,
  FileSpreadsheet,
  FileText,
  Landmark,
  Table2,
  Users,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatRupiah0 } from '@/lib/format'
import type { AdminOverviewDto, ImportLogDto } from '@/types/budget'

async function fetchOverview(): Promise<AdminOverviewDto> {
  const res = await fetch('/api/admin/overview')
  if (!res.ok) throw new Error('Gagal memuat ringkasan admin')
  const json = (await res.json()) as { data: AdminOverviewDto }
  return json.data
}

export function AdminOverviewSection() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-overview'],
    queryFn: fetchOverview,
    refetchInterval: 60_000,
  })

  if (isError) {
    return (
      <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        Gagal memuat ringkasan admin.
      </p>
    )
  }

  const counts = data?.counts
  const cards = [
    { label: 'Tahun APBD', value: counts?.apbdYears, icon: <Landmark className="h-5 w-5" /> },
    { label: 'Item Anggaran', value: counts?.budgetItems, icon: <BarChart3 className="h-5 w-5" /> },
    { label: 'Realisasi Akun', value: counts?.realisasiAkun, icon: <Table2 className="h-5 w-5" /> },
    { label: 'Realisasi SKPD', value: counts?.realisasiSkpd, icon: <FileSpreadsheet className="h-5 w-5" /> },
    { label: 'Dokumen Transparansi', value: counts?.transparansiDocs, icon: <FileText className="h-5 w-5" /> },
    { label: 'Log Import', value: counts?.importLogs, icon: <Database className="h-5 w-5" /> },
    {
      label: 'Pengunjung Bulan Ini',
      value: data ? data.visitorThisMonth : undefined,
      icon: <Users className="h-5 w-5" />,
      format: true,
    },
  ]

  return (
    <div>
      <h2 className="mb-4 text-base font-bold uppercase tracking-wide text-foreground">
        Ringkasan Sistem
      </h2>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-[#17408b]">{c.icon}</div>
            <div className="mt-2 text-2xl font-extrabold tabular-nums text-foreground">
              {c.value === undefined ? (
                <Skeleton className="h-8 w-16" />
              ) : c.format ? (
                formatRupiah0(c.value)
              ) : (
                c.value
              )}
            </div>
            <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {c.label}
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border">
        <div className="bg-muted/60 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-foreground/80">
          Riwayat Import LRA Terbaru
        </div>
        <div className="max-h-96 overflow-y-auto nice-scrollbar">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead className="text-right">Halaman</TableHead>
                <TableHead className="text-right">Baris</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Waktu</TableHead>
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
              ) : data && data.recentImports.length > 0 ? (
                data.recentImports.map((log) => <ImportRow key={log.id} log={log} />)
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                    Belum ada riwayat import. Gunakan menu “Import LRA (PDF)”.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}

function ImportRow({ log }: { log: ImportLogDto }) {
  const statusTone =
    log.status === 'confirmed'
      ? 'bg-green-100 text-green-800'
      : log.status === 'failed'
        ? 'bg-red-100 text-red-800'
        : 'bg-amber-100 text-amber-800'
  const statusLabel =
    log.status === 'confirmed' ? 'Tersimpan' : log.status === 'failed' ? 'Gagal' : 'Terurai'
  return (
    <TableRow>
      <TableCell className="max-w-[220px] truncate font-medium" title={log.filename}>
        {log.filename}
      </TableCell>
      <TableCell className="text-right tabular-nums">{log.pages}</TableCell>
      <TableCell className="text-right tabular-nums">{log.records}</TableCell>
      <TableCell>
        <Badge variant="secondary" className={statusTone}>
          {statusLabel}
        </Badge>
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">
        {new Date(log.createdAt).toLocaleString('id-ID', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </TableCell>
    </TableRow>
  )
}
