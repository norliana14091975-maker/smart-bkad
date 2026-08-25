'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { CalendarRange, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { formatRupiah0 } from '@/lib/format'

interface SyncPlanDto {
  year: number
  itemCounts: { pendapatan: number; belanja: number; pembiayaan: number }
  totals: { pendapatan: number; belanja: number; terima: number; keluar: number }
}

/** Opsi tahun anggaran LRA yang tersedia sebagai sumber sinkronisasi. */
interface LraYearOptionDto {
  year: number
  mode: 'aggregate' | 'global'
  opdCount: number
  opdNames: string[]
  periode: number | null
  periodeLabel: string | null
  rowCount: number
}

interface SyncPreviewDto {
  available: boolean
  mode: 'aggregate' | 'global'
  opdCount: number
  opdNames: string[]
  /** Tahun anggaran LRA yang sedang dipratinjau */
  year: number | null
  periode: number | null
  periodeLabel: string | null
  plan: SyncPlanDto | null
  existingYearItems: number
  /** Daftar tahun LRA tersedia (terbaru dulu) untuk pemilih tahun */
  years: LraYearOptionDto[]
  /** Tahun default = tahun import LRA terakhir */
  defaultYear: number | null
  /** Tahun yang sedang dipilih pada pratinjau ini */
  selectedYear: number | null
}

async function fetchPreview(year?: number | null): Promise<SyncPreviewDto> {
  const qs = year ? `?year=${year}` : ''
  const res = await fetch(`/api/admin/sync-lra${qs}`)
  if (!res.ok) throw new Error('Gagal memuat pratinjau sinkronisasi')
  const json = (await res.json()) as { data: SyncPreviewDto }
  return json.data
}

/** Label ringkas satu opsi tahun: "TA 2025 — Konsolidasi · s.d. Desember". */
function yearOptionLabel(o: LraYearOptionDto): string {
  const sumber = o.mode === 'aggregate' ? `${o.opdCount} OPD` : 'Konsolidasi'
  const periode = o.periodeLabel ?? '-'
  return `TA ${o.year} — ${sumber} · ${periode}`
}

/**
 * Tombol sinkronisasi anggaran dari LRA yang telah diimport:
 * mengambil anggaran LRA (level jenis) → item anggaran + ringkasan APBD
 * tahun anggaran terpilih. Tahun sumber dapat dipilih (mis. TA 2025 data
 * pembanding); default mengikuti tahun import LRA terakhir.
 * Dipakai di Kelola Data APBD & Kelola Item Anggaran.
 */
export function SyncLraButton({ size = 'sm' }: { size?: 'sm' | 'default' }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [yearLoading, setYearLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [preview, setPreview] = useState<SyncPreviewDto | null>(null)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)

  async function openDialog() {
    setLoading(true)
    setOpen(true)
    try {
      const data = await fetchPreview()
      setPreview(data)
      setSelectedYear(data.selectedYear ?? data.defaultYear ?? data.year)
    } catch (err) {
      toast({ title: 'Gagal memuat pratinjau', description: String(err), variant: 'destructive' })
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  /** Ganti tahun sumber LRA lalu muat ulang pratinjau tahun tersebut. */
  async function changeYear(year: number) {
    if (year === selectedYear) return
    setSelectedYear(year)
    setYearLoading(true)
    try {
      const data = await fetchPreview(year)
      setPreview(data)
    } catch (err) {
      toast({ title: 'Gagal memuat pratinjau', description: String(err), variant: 'destructive' })
    } finally {
      setYearLoading(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await fetch('/api/admin/sync-lra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: selectedYear ?? preview?.plan?.year }),
      })
      const json = (await res.json()) as {
        data?: { year: number; createdItems: number }
        error?: string
      }
      if (!res.ok) throw new Error(json.error ?? 'Gagal menjalankan sinkronisasi')

      toast({
        title: `Sinkronisasi LRA ${json.data?.year} selesai`,
        description: `${json.data?.createdItems ?? 0} item anggaran dibuat & ringkasan APBD ${json.data?.year} diperbarui.`,
      })
      setOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['admin-apbd'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-budget'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-overview'] })
      await queryClient.invalidateQueries({ queryKey: ['apbd'] })
      await queryClient.invalidateQueries({ queryKey: ['pendapatan'] })
      await queryClient.invalidateQueries({ queryKey: ['belanja'] })
      await queryClient.invalidateQueries({ queryKey: ['pembiayaan'] })
    } catch (err) {
      toast({ title: 'Gagal sinkronisasi', description: String(err), variant: 'destructive' })
    } finally {
      setSyncing(false)
    }
  }

  const plan = preview?.plan ?? null
  const years = preview?.years ?? []
  // Catatan bila tahun terpilih lebih lama dari data LRA terbaru
  const isOlderYear =
    years.length > 0 && selectedYear != null && selectedYear < years[0].year

  return (
    <>
      <Button
        onClick={openDialog}
        size={size}
        variant="outline"
        className="border-[#17408b]/40 text-[#17408b] hover:bg-[#17408b]/10 hover:text-[#12326e]"
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" /> Sinkron dari LRA
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto nice-scrollbar sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Sinkronisasi Data dari LRA</DialogTitle>
            <DialogDescription>
              Mengambil anggaran dari LRA yang telah diimport ke item anggaran dan
              ringkasan APBD. Pilih tahun anggaran LRA sebagai sumber — default
              mengikuti tahun import terakhir, dan tahun lain tetap terbaca
              sebagai data pembanding.
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-2/3" />
            </div>
          ) : !preview?.available || !plan ? (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              Belum ada data LRA yang dapat disinkronkan
              {selectedYear ? ` untuk tahun anggaran ${selectedYear}` : ''}. Import
              LRA terlebih dahulu melalui menu <strong>Import LRA (PDF)</strong>.
            </p>
          ) : (
            <div className="space-y-4">
              {/* Pemilih tahun anggaran sumber LRA */}
              <div className="space-y-1.5">
                <label
                  htmlFor="sync-lra-year"
                  className="text-sm font-medium text-foreground"
                >
                  Tahun Anggaran Sumber LRA
                </label>
                <Select
                  value={selectedYear != null ? String(selectedYear) : undefined}
                  onValueChange={(v) => changeYear(Number(v))}
                  disabled={yearLoading || syncing || years.length === 0}
                >
                  <SelectTrigger id="sync-lra-year" className="w-full">
                    <CalendarRange
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <SelectValue placeholder="Pilih tahun anggaran LRA" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((o) => (
                      <SelectItem key={o.year} value={String(o.year)}>
                        {yearOptionLabel(o)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {yearLoading ? (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
                    Memuat pratinjau TA {selectedYear}…
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {years.length > 1
                      ? 'Data LRA tahun lain tersimpan sebagai pembanding dan tidak tercampur.'
                      : 'Hanya ada satu tahun anggaran LRA yang terimport.'}
                  </p>
                )}
              </div>

              {/* Sumber data */}
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <p className="font-semibold text-foreground">Sumber data LRA</p>
                <ul className="mt-1 space-y-0.5 text-muted-foreground">
                  <li>
                    {preview.opdCount > 0
                      ? `${preview.opdCount} OPD/SKPD: ${preview.opdNames.join(', ')}`
                      : 'Data konsolidasi (global)'}
                  </li>
                  <li>
                    Tahun anggaran:{' '}
                    <span className="font-semibold text-foreground">
                      TA {plan.year}
                    </span>
                    <span className="ml-1">(terbaca dari dokumen LRA)</span>
                  </li>
                  <li>Periode realisasi: {preview.periodeLabel ?? '-'}</li>
                  {isOlderYear && (
                    <li className="text-amber-700">
                      TA {selectedYear} lebih lama dari data LRA terbaru (TA{' '}
                      {years[0].year}) — pastikan tahun target sudah benar.
                    </li>
                  )}
                </ul>
              </div>

              {/* Ringkasan yang akan ditulis */}
              <div className="overflow-hidden rounded-md border">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b bg-muted/40">
                      <td className="p-2 font-semibold" colSpan={2}>
                        Target: Tahun Anggaran {plan.year}
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2 text-muted-foreground">Pendapatan</td>
                      <td className="p-2 text-right tabular-nums">
                        {formatRupiah0(plan.totals.pendapatan)}
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({plan.itemCounts.pendapatan} akun)
                        </span>
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2 text-muted-foreground">Belanja</td>
                      <td className="p-2 text-right tabular-nums">
                        {formatRupiah0(plan.totals.belanja)}
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({plan.itemCounts.belanja} akun)
                        </span>
                      </td>
                    </tr>
                    <tr className="border-b">
                      <td className="p-2 text-muted-foreground">Penerimaan Pembiayaan</td>
                      <td className="p-2 text-right tabular-nums">
                        {formatRupiah0(plan.totals.terima)}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 text-muted-foreground">Pengeluaran Pembiayaan</td>
                      <td className="p-2 text-right tabular-nums">
                        {formatRupiah0(plan.totals.keluar)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                Seluruh item anggaran tahun {plan.year} yang ada saat ini
                {preview.existingYearItems > 0
                  ? ` (${preview.existingYearItems} item)`
                  : ''}{' '}
                akan <strong>diganti</strong> dengan {plan.itemCounts.pendapatan + plan.itemCounts.belanja + plan.itemCounts.pembiayaan} item hasil LRA, dan
                ringkasan APBD {plan.year} akan diperbarui. Tindakan ini tidak dapat
                dibatalkan.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={syncing}>
              Batal
            </Button>
            <Button
              onClick={handleSync}
              disabled={loading || yearLoading || syncing || !preview?.available || !plan}
              className="bg-[#17408b] text-white hover:bg-[#12326e]"
            >
              {syncing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> Menyinkronkan…
                </>
              ) : (
                'Sinkronkan Sekarang'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
