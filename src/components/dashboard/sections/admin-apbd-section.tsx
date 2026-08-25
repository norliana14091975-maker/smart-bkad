'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatRupiah0 } from '@/lib/format'
import { SyncLraButton } from '@/components/dashboard/sync-lra-button'
import type { ApbdSummaryDto } from '@/types/budget'

async function fetchApbdAdmin(): Promise<ApbdSummaryDto[]> {
  const res = await fetch('/api/admin/apbd')
  if (!res.ok) throw new Error('Gagal memuat data APBD')
  const json = (await res.json()) as { data: ApbdSummaryDto[] }
  return json.data
}

interface FormState {
  year: string
  pendApbd: string
  pendApbdp: string
  belApbd: string
  belApbdp: string
  terApbd: string
  terApbdp: string
  kelApbd: string
  kelApbdp: string
}

const EMPTY_FORM: FormState = {
  year: '',
  pendApbd: '',
  pendApbdp: '',
  belApbd: '',
  belApbdp: '',
  terApbd: '',
  terApbdp: '',
  kelApbd: '',
  kelApbdp: '',
}

const FORM_FIELDS: { key: keyof Omit<FormState, 'year'>; label: string }[] = [
  { key: 'pendApbd', label: 'Pendapatan APBD' },
  { key: 'pendApbdp', label: 'Pendapatan APBDP' },
  { key: 'belApbd', label: 'Belanja APBD' },
  { key: 'belApbdp', label: 'Belanja APBDP' },
  { key: 'terApbd', label: 'Penerimaan Pembiayaan APBD' },
  { key: 'terApbdp', label: 'Penerimaan Pembiayaan APBDP' },
  { key: 'kelApbd', label: 'Pengeluaran Pembiayaan APBD' },
  { key: 'kelApbdp', label: 'Pengeluaran Pembiayaan APBDP' },
]

export function AdminApbdSection() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-apbd'],
    queryFn: fetchApbdAdmin,
  })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteYear, setDeleteYear] = useState<number | null>(null)
  const [deleteAllOpen, setDeleteAllOpen] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)

  function openAdd() {
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(row: ApbdSummaryDto) {
    setForm({
      year: String(row.year),
      pendApbd: String(row.pendapatan.apbd),
      pendApbdp: String(row.pendapatan.apbdp),
      belApbd: String(row.belanja.apbd),
      belApbdp: String(row.belanja.apbdp),
      terApbd: String(row.penerimaanPembiayaan.apbd),
      terApbdp: String(row.penerimaanPembiayaan.apbdp),
      kelApbd: String(row.pengeluaranPembiayaan.apbd),
      kelApbdp: String(row.pengeluaranPembiayaan.apbdp),
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    const year = Number(form.year)
    if (!year || year < 2000 || year > 2100) {
      toast({ title: 'Tahun tidak valid', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/apbd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year,
          pendapatan: { apbd: Number(form.pendApbd) || 0, apbdp: Number(form.pendApbdp) || 0 },
          belanja: { apbd: Number(form.belApbd) || 0, apbdp: Number(form.belApbdp) || 0 },
          penerimaanPembiayaan: { apbd: Number(form.terApbd) || 0, apbdp: Number(form.terApbdp) || 0 },
          pengeluaranPembiayaan: { apbd: Number(form.kelApbd) || 0, apbdp: Number(form.kelApbdp) || 0 },
        }),
      })
      if (!res.ok) {
        const json = (await res.json()) as { error?: string }
        throw new Error(json.error ?? 'Gagal menyimpan')
      }
      toast({ title: `Data APBD ${year} tersimpan` })
      setDialogOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['admin-apbd'] })
      await queryClient.invalidateQueries({ queryKey: ['apbd'] })
    } catch (err) {
      toast({ title: 'Gagal menyimpan', description: String(err), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (deleteYear === null) return
    try {
      const res = await fetch(`/api/admin/apbd?year=${deleteYear}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Gagal menghapus')
      toast({ title: `Data APBD ${deleteYear} dihapus` })
      await queryClient.invalidateQueries({ queryKey: ['admin-apbd'] })
      await queryClient.invalidateQueries({ queryKey: ['apbd'] })
    } catch (err) {
      toast({ title: 'Gagal menghapus', description: String(err), variant: 'destructive' })
    } finally {
      setDeleteYear(null)
    }
  }

  async function handleDeleteAll() {
    setDeletingAll(true)
    try {
      const res = await fetch('/api/admin/apbd?all=1', { method: 'DELETE' })
      const json = (await res.json()) as { data?: { deleted?: number }; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Gagal menghapus')
      toast({
        title: 'Seluruh ringkasan APBD dihapus',
        description: `${json.data?.deleted ?? 0} baris ringkasan tahunan dihapus permanen.`,
      })
      await queryClient.invalidateQueries({ queryKey: ['admin-apbd'] })
      await queryClient.invalidateQueries({ queryKey: ['apbd'] })
    } catch (err) {
      toast({ title: 'Gagal menghapus semua', description: String(err), variant: 'destructive' })
    } finally {
      setDeletingAll(false)
      setDeleteAllOpen(false)
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold uppercase tracking-wide text-foreground">
          Kelola Ringkasan APBD Tahunan
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <SyncLraButton />
          <Button
            onClick={() => setDeleteAllOpen(true)}
            size="sm"
            variant="outline"
            disabled={!data || data.length === 0}
            className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Hapus Semua
          </Button>
          <Button onClick={openAdd} size="sm" className="bg-[#17408b] text-white hover:bg-[#12326e]">
            <Plus className="h-4 w-4" aria-hidden="true" /> Tambah Tahun
          </Button>
        </div>
      </div>

      {isError && (
        <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Gagal memuat data APBD.
        </p>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/60">
              <TableHead>Tahun</TableHead>
              <TableHead className="text-right">Pendapatan APBD</TableHead>
              <TableHead className="text-right">Pendapatan APBDP</TableHead>
              <TableHead className="text-right">Belanja APBD</TableHead>
              <TableHead className="text-right">Belanja APBDP</TableHead>
              <TableHead className="text-right">Terima Pembiayaan APBD</TableHead>
              <TableHead className="text-right">Keluar Pembiayaan APBD</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [1, 2, 3].map((i) => (
                <TableRow key={i}>
                  <TableCell colSpan={8}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              data?.map((row) => (
                <TableRow key={row.year}>
                  <TableCell className="font-bold">{row.year}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatRupiah0(row.pendapatan.apbd)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatRupiah0(row.pendapatan.apbdp)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatRupiah0(row.belanja.apbd)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatRupiah0(row.belanja.apbdp)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatRupiah0(row.penerimaanPembiayaan.apbd)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatRupiah0(row.pengeluaranPembiayaan.apbd)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(row)}
                        aria-label={`Ubah data ${row.year}`}
                        className="h-8 w-8"
                      >
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteYear(row.year)}
                        aria-label={`Hapus data ${row.year}`}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Dialog tambah/ubah */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto nice-scrollbar sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.year && data?.some((d) => d.year === Number(form.year)) ? `Ubah APBD ${form.year}` : 'Tambah APBD'}</DialogTitle>
            <DialogDescription>
              Isi angka dalam Rupiah tanpa pemisah ribuan (contoh: 71450673065697).
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="apbd-year">Tahun</Label>
              <Input
                id="apbd-year"
                type="number"
                value={form.year}
                onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
                placeholder="2026"
              />
            </div>
            {FORM_FIELDS.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={`apbd-${f.key}`}>{f.label}</Label>
                <Input
                  id={`apbd-${f.key}`}
                  type="number"
                  value={form[f.key]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder="0"
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#17408b] text-white hover:bg-[#12326e]">
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Konfirmasi hapus */}
      <AlertDialog open={deleteYear !== null} onOpenChange={(open) => !open && setDeleteYear(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus data APBD {deleteYear}?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Data ringkasan tahun {deleteYear} akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Konfirmasi hapus semua */}
      <AlertDialog open={deleteAllOpen} onOpenChange={setDeleteAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus SEMUA ringkasan APBD tahunan?</AlertDialogTitle>
            <AlertDialogDescription>
              Seluruh {data?.length ?? 0} baris ringkasan APBD (semua tahun) akan dihapus
              permanen. Halaman APBD publik akan kembali menampilkan baris tahun berjalan
              dari data LRA/sintesis. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAll}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDeleteAll()
              }}
              disabled={deletingAll}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {deletingAll ? 'Menghapus…' : 'Ya, Hapus Semua'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
