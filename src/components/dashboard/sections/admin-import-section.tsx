'use client'

import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, FileUp, Info, Loader2, RotateCcw, Save } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatPct, formatRupiah0 } from '@/lib/format'
import type { ImportItemDto, ImportLogDto, ImportParseResultDto } from '@/types/budget'

async function fetchLogs(): Promise<ImportLogDto[]> {
  const res = await fetch('/api/admin/import/logs')
  if (!res.ok) throw new Error('Gagal memuat riwayat import')
  const json = (await res.json()) as { data: ImportLogDto[] }
  return json.data
}

export function AdminImportSection() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ImportParseResultDto | null>(null)
  const [mode, setMode] = useState<'replace' | 'append'>('replace')
  const [confirming, setConfirming] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const logsQuery = useQuery({
    queryKey: ['admin-import-logs'],
    queryFn: fetchLogs,
  })

  async function handleFile(file: File) {
    if (uploading) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast({ title: 'Format tidak didukung', description: 'Hanya file PDF yang dapat diimpor.', variant: 'destructive' })
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'File terlalu besar', description: 'Ukuran maksimum 10 MB.', variant: 'destructive' })
      return
    }
    setUploading(true)
    setResult(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/import/lra', { method: 'POST', body: fd })
      const json = (await res.json()) as { data?: ImportParseResultDto; error?: string }
      if (!res.ok || !json.data) {
        throw new Error(json.error ?? 'Gagal menganalisis PDF')
      }
      if (json.data.items.length === 0) {
        toast({
          title: 'Tidak ada baris terdeteksi',
          description: 'Pastikan PDF berisi tabel LRA dengan kode rekening.',
          variant: 'destructive',
        })
      }
      setResult(json.data)
      await queryClient.invalidateQueries({ queryKey: ['admin-import-logs'] })
    } catch (err) {
      toast({ title: 'Import gagal', description: String(err), variant: 'destructive' })
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleConfirm() {
    if (!result || confirming) return
    setConfirming(true)
    try {
      const res = await fetch('/api/admin/import/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          importLogId: result.importLogId,
          items: result.items,
          mode,
        }),
      })
      const json = (await res.json()) as { data?: { saved: number }; error?: string }
      if (!res.ok || !json.data) throw new Error(json.error ?? 'Gagal menyimpan import')
      toast({
        title: 'Import LRA berhasil',
        description: `${json.data.saved} baris realisasi tersimpan (${
          mode === 'replace' ? 'ganti seluruh data' : 'tambahkan ke data'
        }).`,
      })
      setResult(null)
      await queryClient.invalidateQueries({ queryKey: ['admin-import-logs'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-realisasi-akun'] })
      await queryClient.invalidateQueries({ queryKey: ['realisasi-akun'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-overview'] })
    } catch (err) {
      toast({ title: 'Gagal menyimpan', description: String(err), variant: 'destructive' })
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div>
      <h2 className="mb-4 text-base font-bold uppercase tracking-wide text-foreground">
        Import Laporan Realisasi Anggaran (LRA) dari PDF
      </h2>

      {/* Info format */}
      <div className="mb-4 flex items-start gap-3 rounded-lg border border-[#17408b]/20 bg-[#17408b]/5 p-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#17408b]" aria-hidden="true" />
        <div className="text-sm text-foreground/80">
          <p className="font-semibold text-foreground">Cara kerja fitur import</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5">
            <li>Unggah file PDF LRA (maks. 10 MB, harus berisi teks — bukan hasil pindai).</li>
            <li>Sistem membaca teks PDF lalu mengekstrak baris rekening (kode, uraian, anggaran, realisasi) secara otomatis dengan AI.</li>
            <li>Tinjau hasil ekstraksi, pilih mode penyimpanan, lalu konfirmasi.</li>
          </ol>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Kode rekening diawali 4.x (Pendapatan), 5.x (Belanja), atau 6.x (Pembiayaan) akan
            dikelompokkan otomatis.
          </p>
        </div>
      </div>

      {/* Dropzone / upload */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Unggah file PDF LRA"
        onClick={() => fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
        }}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          const file = e.dataTransfer.files?.[0]
          if (file) void handleFile(file)
        }}
        className={`mb-5 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          dragOver ? 'border-[#17408b] bg-[#17408b]/5' : 'border-muted-foreground/25 hover:border-[#17408b]/50 hover:bg-muted/40'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void handleFile(file)
          }}
        />
        {uploading ? (
          <>
            <Loader2 className="mb-2 h-10 w-10 animate-spin text-[#17408b]" aria-hidden="true" />
            <p className="text-sm font-semibold text-foreground">Menganalisis PDF…</p>
            <p className="text-xs text-muted-foreground">Ekstraksi teks + AI sedang berjalan, mohon tunggu.</p>
          </>
        ) : (
          <>
            <FileUp className="mb-2 h-10 w-10 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-semibold text-foreground">
              Klik untuk memilih file, atau tarik &amp; letakkan PDF di sini
            </p>
            <p className="text-xs text-muted-foreground">Format: PDF LRA — maksimal 10 MB</p>
          </>
        )}
      </div>

      {/* Hasil ekstraksi */}
      {result && (
        <div className="mb-6 rounded-lg border bg-card p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-700" aria-hidden="true" />
            <p className="text-sm font-bold text-foreground">
              Ekstraksi berhasil — {result.items.length} baris terdeteksi
            </p>
            <Badge variant="secondary" className="bg-muted">
              {result.filename}
            </Badge>
            <Badge variant="secondary" className="bg-muted">
              {result.pages} halaman
            </Badge>
          </div>

          <div className="mb-3 overflow-hidden rounded-md border">
            <div className="max-h-96 overflow-y-auto nice-scrollbar">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/60">
                    <TableHead className="w-28">Kode</TableHead>
                    <TableHead className="min-w-[220px]">Uraian</TableHead>
                    <TableHead className="text-right">Anggaran</TableHead>
                    <TableHead className="text-right">Realisasi</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.items.map((item: ImportItemDto) => (
                    <TableRow key={item.code}>
                      <TableCell className="font-mono text-xs">{item.code}</TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatRupiah0(item.anggaran)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatRupiah0(item.realisasi)}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-[#17408b]">
                        {formatPct(item.pct)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Mode penyimpanan
              </Label>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'replace' | 'append')} className="flex gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="replace" id="mode-replace" />
                  <Label htmlFor="mode-replace" className="cursor-pointer font-normal">
                    Ganti seluruh data realisasi
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="append" id="mode-append" />
                  <Label htmlFor="mode-append" className="cursor-pointer font-normal">
                    Tambah/perbarui (upsert)
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setResult(null)}>
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> Batal
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={confirming || result.items.length === 0}
                className="bg-green-700 text-white hover:bg-green-800"
              >
                {confirming ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Menyimpan…
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" aria-hidden="true" /> Konfirmasi Import
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Riwayat import */}
      <div className="overflow-hidden rounded-lg border">
        <div className="bg-muted/60 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-foreground/80">
          Riwayat Import
        </div>
        <div className="max-h-96 overflow-y-auto nice-scrollbar">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead className="text-right">Halaman</TableHead>
                <TableHead className="text-right">Baris</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Pesan</TableHead>
                <TableHead>Waktu</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logsQuery.isLoading ? (
                [1, 2, 3].map((i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : logsQuery.data && logsQuery.data.length > 0 ? (
                logsQuery.data.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="max-w-[200px] truncate font-medium" title={log.filename}>
                      {log.filename}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{log.pages}</TableCell>
                    <TableCell className="text-right tabular-nums">{log.records}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          log.status === 'confirmed'
                            ? 'bg-green-100 text-green-800'
                            : log.status === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                        }
                      >
                        {log.status === 'confirmed' ? 'Tersimpan' : log.status === 'failed' ? 'Gagal' : 'Terurai'}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground" title={log.message ?? ''}>
                      {log.message ?? '—'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    Belum ada riwayat import.
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
