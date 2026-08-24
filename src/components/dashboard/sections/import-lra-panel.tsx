'use client'

import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  CheckCircle2,
  FileUp,
  Info,
  Loader2,
  RotateCcw,
  Save,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
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
import { levelBadge } from '@/lib/kode-akun'
import { formatPct, formatRupiah0 } from '@/lib/format'
import type {
  ImportItemDto,
  ImportLogDto,
  ImportParseResultDto,
  OpdRowDto,
  OpdSelfDto,
} from '@/types/budget'

/**
 * Panel import LRA bersama untuk admin dan OPD:
 * - mode 'admin': tersedia pilih OPD/SKPD tujuan (kosong = konsolidasi)
 * - mode 'opd'  : otomatis terikat OPD yang sedang login
 * Hasil ekstraksi diklasifikasi per level kode rekening (1-5).
 */
export function ImportLraPanel({ mode }: { mode: 'admin' | 'opd' }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const base = mode === 'admin' ? '/api/admin/import' : '/api/opd/import'

  // daftar OPD (admin) / profil OPD sendiri (mode opd)
  const opdsQuery = useQuery({
    queryKey: ['admin-opd'],
    queryFn: async (): Promise<OpdRowDto[]> => {
      const res = await fetch('/api/admin/opd')
      if (!res.ok) throw new Error('Gagal memuat daftar OPD')
      return ((await res.json()) as { data: OpdRowDto[] }).data
    },
    enabled: mode === 'admin',
  })

  const selfQuery = useQuery({
    queryKey: ['opd-me'],
    queryFn: async (): Promise<OpdSelfDto> => {
      const res = await fetch('/api/opd/me')
      if (!res.ok) throw new Error('Gagal memuat data OPD')
      return ((await res.json()) as { data: OpdSelfDto }).data
    },
    enabled: mode === 'opd',
  })

  const logsQuery = useQuery({
    queryKey: ['import-logs', mode],
    queryFn: async (): Promise<ImportLogDto[]> => {
      const res = await fetch(`${base}/logs`)
      if (!res.ok) throw new Error('Gagal memuat riwayat import')
      return ((await res.json()) as { data: ImportLogDto[] }).data
    },
  })

  const [selectedOpdId, setSelectedOpdId] = useState('') // '' = konsolidasi
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ImportParseResultDto | null>(null)
  const [saveMode, setSaveMode] = useState<'replace' | 'append'>('replace')
  const [confirming, setConfirming] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  async function handleFile(file: File) {
    if (uploading) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast({
        title: 'Format tidak didukung',
        description: 'Hanya file PDF yang dapat diimpor.',
        variant: 'destructive',
      })
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
      if (mode === 'admin' && selectedOpdId) fd.append('opdId', selectedOpdId)
      const res = await fetch(`${base}/lra`, { method: 'POST', body: fd })
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
      await queryClient.invalidateQueries({ queryKey: ['import-logs', mode] })
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
      const body: Record<string, unknown> = {
        importLogId: result.importLogId,
        items: result.items,
        mode: saveMode,
      }
      if (mode === 'admin' && selectedOpdId) body.opdId = Number(selectedOpdId)
      const res = await fetch(`${base}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as { data?: { saved: number }; error?: string }
      if (!res.ok || !json.data) throw new Error(json.error ?? 'Gagal menyimpan import')
      const target =
        mode === 'opd'
          ? (selfQuery.data?.opd.name ?? 'OPD Anda')
          : selectedOpdId
            ? (opdsQuery.data?.find((o) => String(o.id) === selectedOpdId)?.name ?? 'OPD terpilih')
            : 'konsolidasi seluruh OPD'
      toast({
        title: 'Import LRA berhasil',
        description: `${json.data.saved} baris tersimpan untuk ${target}.`,
      })
      setResult(null)
      await queryClient.invalidateQueries({ queryKey: ['import-logs', mode] })
      await queryClient.invalidateQueries({ queryKey: ['admin-import-logs'] })
      await queryClient.invalidateQueries({ queryKey: ['realisasi-akun'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-realisasi-akun'] })
      await queryClient.invalidateQueries({ queryKey: ['opd-me'] })
      await queryClient.invalidateQueries({ queryKey: ['realisasi-skpd'] })
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

      {/* Info format + klasifikasi */}
      <div className="mb-4 flex items-start gap-3 rounded-lg border border-[#17408b]/20 bg-[#17408b]/5 p-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#17408b]" aria-hidden="true" />
        <div className="text-sm text-foreground/80">
          <p className="font-semibold text-foreground">Cara kerja fitur import</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5">
            <li>Pilih OPD/SKPD tujuan{mode === 'opd' ? ' (otomatis: OPD Anda)' : ''} lalu unggah file PDF LRA (maks. 10 MB, harus berisi teks).</li>
            <li>Sistem membaca teks PDF lalu mengekstrak &amp; memvalidasi kode rekening sesuai aturan Bagan Akun Standar (BAS) Permendagri 77/2020 dengan AI.</li>
            <li>Tinjau hasil ekstraksi, pilih mode penyimpanan, lalu konfirmasi.</li>
          </ol>
          <p className="mt-1.5 text-xs text-muted-foreground">
            Struktur kode rekening sesuai Permendagri: <strong>L1 Akun</strong> (4) ·{' '}
            <strong>L2 Kelompok</strong> (4.1) · <strong>L3 Jenis</strong> (4.1.01) ·{' '}
            <strong>L4 Obyek</strong> (4.1.01.01) · <strong>L5 Rincian Obyek</strong>{' '}
            (4.1.01.01.001). Kode di luar struktur BAS otomatis dibuang; nama akun &amp;
            kelompok dinormalkan ke nomenklatur baku; level induk yang tidak tercetak
            diturunkan dari penjumlahan level anaknya sesuai struktur LRA.
          </p>
        </div>
      </div>

      {/* Pemilih OPD tujuan */}
      {mode === 'admin' ? (
        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border bg-muted/30 px-4 py-3">
          <div>
            <Label htmlFor="import-opd" className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              OPD/SKPD Tujuan Import
            </Label>
            <Select value={selectedOpdId || 'konsolidasi'} onValueChange={(v) => setSelectedOpdId(v === 'konsolidasi' ? '' : v)}>
              <SelectTrigger id="import-opd" className="h-9 w-72 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="konsolidasi">Konsolidasi — seluruh OPD (global)</SelectItem>
                {opdsQuery.data?.map((opd) => (
                  <SelectItem key={opd.id} value={String(opd.id)}>
                    {opd.code} — {opd.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="max-w-xs text-[11px] leading-snug text-muted-foreground">
            Import untuk OPD tertentu akan menimpa data realisasi akun &amp; ringkasan SKPD OPD
            tersebut. Pilih “Konsolidasi” untuk data gabungan.
          </p>
        </div>
      ) : (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          <Building2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          Import ini otomatis tersimpan untuk OPD Anda:{' '}
          <strong>{selfQuery.data ? selfQuery.data.opd.name : 'memuat…'}</strong>
        </div>
      )}

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
          dragOver
            ? 'border-[#17408b] bg-[#17408b]/5'
            : 'border-muted-foreground/25 hover:border-[#17408b]/50 hover:bg-muted/40'
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
            <p className="text-xs text-muted-foreground">
              Ekstraksi teks + klasifikasi kode rekening dengan AI, mohon tunggu.
            </p>
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
            <Badge
              variant="secondary"
              className={result.opdName ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}
            >
              {result.opdName ? `OPD: ${result.opdName}` : 'Konsolidasi (seluruh OPD)'}
            </Badge>
            {result.stats && (
              <>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  {result.stats.valid} baris valid
                </Badge>
                {result.stats.derived > 0 && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                    {result.stats.derived} induk diturunkan
                  </Badge>
                )}
                {result.stats.dropped > 0 && (
                  <Badge
                    variant="secondary"
                    className="bg-red-100 text-red-800"
                    title={`Kode di luar struktur BAS dibuang: ${result.stats.droppedExamples.join(', ')}`}
                  >
                    {result.stats.dropped} ditolak (non-BAS)
                  </Badge>
                )}
              </>
            )}
          </div>

          <div className="mb-3 overflow-hidden rounded-md border">
            <div className="max-h-96 overflow-y-auto nice-scrollbar">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/60">
                    <TableHead className="w-32">Level</TableHead>
                    <TableHead className="min-w-[200px]">Kode &amp; Uraian</TableHead>
                    <TableHead className="text-right">Anggaran</TableHead>
                    <TableHead className="text-right">Realisasi</TableHead>
                    <TableHead className="text-right">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.items.map((item: ImportItemDto) => (
                    <TableRow key={item.code}>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`whitespace-nowrap text-[10px] font-mono ${
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
                          <span className="font-mono text-xs font-semibold text-foreground">
                            {item.code}
                          </span>
                          <span className="text-sm">{item.name}</span>
                        </div>
                      </TableCell>
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
              <RadioGroup
                value={saveMode}
                onValueChange={(v) => setSaveMode(v as 'replace' | 'append')}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="replace" id="mode-replace" />
                  <Label htmlFor="mode-replace" className="cursor-pointer font-normal">
                    Ganti data scope ini
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
          Riwayat Import {mode === 'opd' ? 'OPD Ini' : ''}
        </div>
        <div className="max-h-96 overflow-y-auto nice-scrollbar">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead>
                <TableHead>OPD/SKPD</TableHead>
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
                    <TableCell colSpan={7}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : logsQuery.data && logsQuery.data.length > 0 ? (
                logsQuery.data.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="max-w-[180px] truncate font-medium" title={log.filename}>
                      {log.filename}
                    </TableCell>
                    <TableCell>
                      {log.opdName ? (
                        <span className="text-xs font-semibold">{log.opdName}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Konsolidasi</span>
                      )}
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
                    <TableCell
                      className="max-w-[180px] truncate text-xs text-muted-foreground"
                      title={log.message ?? ''}
                    >
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
                  <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
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
