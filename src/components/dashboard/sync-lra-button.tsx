'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
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
import { Skeleton } from '@/components/ui/skeleton'
import { formatRupiah0 } from '@/lib/format'

interface SyncPlanDto {
  year: number
  itemCounts: { pendapatan: number; belanja: number; pembiayaan: number }
  totals: { pendapatan: number; belanja: number; terima: number; keluar: number }
}

interface SyncPreviewDto {
  available: boolean
  mode: 'aggregate' | 'global'
  opdCount: number
  opdNames: string[]
  /** Tahun anggaran LRA terbaru (dibaca dari dokumen saat import) */
  year: number | null
  periode: number | null
  periodeLabel: string | null
  plan: SyncPlanDto | null
  existingYearItems: number
}

async function fetchPreview(): Promise<SyncPreviewDto> {
  const res = await fetch('/api/admin/sync-lra')
  if (!res.ok) throw new Error('Gagal memuat pratinjau sinkronisasi')
  const json = (await res.json()) as { data: SyncPreviewDto }
  return json.data
}

/**
 * Tombol sinkronisasi anggaran dari LRA yang telah diimport:
 * mengambil anggaran LRA (level jenis) → item anggaran + ringkasan APBD
 * tahun anggaran berjalan. Dipakai di Kelola Data APBD & Kelola Item Anggaran.
 */
export function SyncLraButton({ size = 'sm' }: { size?: 'sm' | 'default' }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [preview, setPreview] = useState<SyncPreviewDto | null>(null)

  async function openDialog() {
    setLoading(true)
    setOpen(true)
    try {
      const data = await fetchPreview()
      setPreview(data)
    } catch (err) {
      toast({ title: 'Gagal memuat pratinjau', description: String(err), variant: 'destructive' })
      setOpen(false)
    } finally {
      setLoading(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await fetch('/api/admin/sync-lra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: preview?.plan?.year }),
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
              ringkasan APBD. Tahun anggaran target mengikuti tahun yang terbaca
              dari dokumen LRA (bukan tahun kalender), sehingga data pembanding
              jatuh pada tahun anggaran yang benar.
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
              Belum ada data LRA yang dapat disinkronkan. Import LRA terlebih dahulu
              melalui menu <strong>Import LRA (PDF)</strong>.
            </p>
          ) : (
            <div className="space-y-4">
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
                      TA {preview.plan?.year ?? preview.year ?? '-'}
                    </span>
                    {preview.plan && preview.year && preview.plan.year === preview.year && (
                      <span className="ml-1">(terbaca dari dokumen LRA)</span>
                    )}
                  </li>
                  <li>Periode realisasi: {preview.periodeLabel ?? '-'}</li>
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
              disabled={loading || syncing || !preview?.available || !plan}
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
