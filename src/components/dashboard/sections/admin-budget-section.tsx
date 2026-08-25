'use client'

import { useMemo, useState } from 'react'
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
import { formatRupiah } from '@/lib/format'
import { SyncLraButton } from '@/components/dashboard/sync-lra-button'
import type { BudgetItemRowDto } from '@/types/budget'

const SECTION_TABS: Record<string, { value: string; label: string }[]> = {
  pendapatan: [{ value: 'utama', label: 'Pendapatan' }],
  belanja: [
    { value: 'ops', label: 'Operasi' },
    { value: 'mdl', label: 'Modal' },
    { value: 'ttdg', label: 'Tidak Terduga' },
    { value: 'tf', label: 'Transfer' },
    { value: 'urusan', label: 'Per-Urusan' },
  ],
  pembiayaan: [
    { value: 'terima', label: 'Penerimaan' },
    { value: 'keluar', label: 'Pengeluaran' },
  ],
}

const YEARS = [2026, 2025]

interface FormState {
  id: number | null
  section: string
  tab: string
  code: string
  name: string
  year: string
  amount: string
}

const EMPTY_FORM: FormState = {
  id: null,
  section: 'pendapatan',
  tab: 'utama',
  code: '',
  name: '',
  year: '2026',
  amount: '',
}

async function fetchItems(section: string, tab: string, year: string): Promise<BudgetItemRowDto[]> {
  const params = new URLSearchParams({ section, tab, year })
  const res = await fetch(`/api/admin/budget-items?${params}`)
  if (!res.ok) throw new Error('Gagal memuat item anggaran')
  const json = (await res.json()) as { data: BudgetItemRowDto[] }
  return json.data
}

async function fetchAllItems(): Promise<BudgetItemRowDto[]> {
  const res = await fetch('/api/admin/budget-items')
  if (!res.ok) throw new Error('Gagal memuat item anggaran')
  const json = (await res.json()) as { data: BudgetItemRowDto[] }
  return json.data
}

export function AdminBudgetSection() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [section, setSection] = useState('belanja')
  const [tab, setTab] = useState('ops')
  const [year, setYear] = useState('2026')

  const tabs = SECTION_TABS[section] ?? []
  const activeTab = tabs.some((t) => t.value === tab) ? tab : (tabs[0]?.value ?? '')

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-budget', section, activeTab, year],
    queryFn: () => fetchItems(section, activeTab, year),
  })

  // Seluruh item (semua bagian/tab/tahun) — untuk jumlah pada konfirmasi hapus semua
  const { data: allItems } = useQuery({
    queryKey: ['admin-budget', 'all'],
    queryFn: fetchAllItems,
  })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleteAllOpen, setDeleteAllOpen] = useState(false)
  const [deletingAll, setDeletingAll] = useState(false)

  function handleSectionChange(value: string) {
    setSection(value)
    const first = SECTION_TABS[value]?.[0]?.value ?? ''
    setTab(first)
  }

  function openAdd() {
    setForm({ ...EMPTY_FORM, section, tab: activeTab, year })
    setDialogOpen(true)
  }

  function openEdit(row: BudgetItemRowDto) {
    setForm({
      id: row.id,
      section: row.section,
      tab: row.tab,
      code: row.code,
      name: row.name,
      year: String(row.year),
      amount: String(row.amount),
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.code.trim() || !form.name.trim()) {
      toast({ title: 'Kode dan nama akun wajib diisi', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const payload = {
        id: form.id ?? undefined,
        section: form.section,
        tab: form.tab,
        code: form.code.trim(),
        name: form.name.trim(),
        year: Number(form.year),
        amount: Number(form.amount) || 0,
      }
      const res = await fetch('/api/admin/budget-items', {
        method: form.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const json = (await res.json()) as { error?: string }
        throw new Error(json.error ?? 'Gagal menyimpan')
      }
      toast({ title: form.id ? 'Item anggaran diperbarui' : 'Item anggaran ditambahkan' })
      setDialogOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['admin-budget'] })
      await queryClient.invalidateQueries({ queryKey: ['pendapatan'] })
      await queryClient.invalidateQueries({ queryKey: ['belanja'] })
      await queryClient.invalidateQueries({ queryKey: ['pembiayaan'] })
    } catch (err) {
      toast({ title: 'Gagal menyimpan', description: String(err), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (deleteId === null) return
    try {
      const res = await fetch(`/api/admin/budget-items?id=${deleteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Gagal menghapus')
      toast({ title: 'Item anggaran dihapus' })
      await queryClient.invalidateQueries({ queryKey: ['admin-budget'] })
      await queryClient.invalidateQueries({ queryKey: ['pendapatan'] })
      await queryClient.invalidateQueries({ queryKey: ['belanja'] })
      await queryClient.invalidateQueries({ queryKey: ['pembiayaan'] })
    } catch (err) {
      toast({ title: 'Gagal menghapus', description: String(err), variant: 'destructive' })
    } finally {
      setDeleteId(null)
    }
  }

  async function handleDeleteAll() {
    setDeletingAll(true)
    try {
      const res = await fetch('/api/admin/budget-items?all=1', { method: 'DELETE' })
      const json = (await res.json()) as { data?: { deleted?: number }; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Gagal menghapus')
      toast({
        title: 'Seluruh item anggaran dihapus',
        description: `${json.data?.deleted ?? 0} item pada semua bagian, tab, dan tahun dihapus permanen.`,
      })
      await queryClient.invalidateQueries({ queryKey: ['admin-budget'] })
      await queryClient.invalidateQueries({ queryKey: ['apbd'] })
      await queryClient.invalidateQueries({ queryKey: ['pendapatan'] })
      await queryClient.invalidateQueries({ queryKey: ['belanja'] })
      await queryClient.invalidateQueries({ queryKey: ['pembiayaan'] })
    } catch (err) {
      toast({ title: 'Gagal menghapus semua', description: String(err), variant: 'destructive' })
    } finally {
      setDeletingAll(false)
      setDeleteAllOpen(false)
    }
  }

  const rows = useMemo(() => data ?? [], [data])

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <h2 className="mr-auto text-base font-bold uppercase tracking-wide text-foreground">
          Kelola Item Anggaran
        </h2>
        <div>
          <Label className="mb-1 block text-xs text-muted-foreground">Bagian</Label>
          <Select value={section} onValueChange={handleSectionChange}>
            <SelectTrigger className="h-9 w-40" aria-label="Bagian">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pendapatan">Pendapatan</SelectItem>
              <SelectItem value="belanja">Belanja</SelectItem>
              <SelectItem value="pembiayaan">Pembiayaan</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1 block text-xs text-muted-foreground">Tab</Label>
          <Select value={activeTab} onValueChange={setTab}>
            <SelectTrigger className="h-9 w-40" aria-label="Tab">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {tabs.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1 block text-xs text-muted-foreground">Tahun</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="h-9 w-28" aria-label="Tahun">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <SyncLraButton />
        <Button
          onClick={() => setDeleteAllOpen(true)}
          size="sm"
          variant="outline"
          disabled={!allItems || allItems.length === 0}
          className="h-9 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" /> Hapus Semua
        </Button>
        <Button onClick={openAdd} size="sm" className="h-9 bg-[#17408b] text-white hover:bg-[#12326e]">
          <Plus className="h-4 w-4" aria-hidden="true" /> Tambah
        </Button>
      </div>

      {isError && (
        <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Gagal memuat item anggaran.
        </p>
      )}

      <div className="overflow-hidden rounded-lg border">
        <div className="max-h-[28rem] overflow-auto nice-scrollbar">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead className="w-28">Kode</TableHead>
                <TableHead className="min-w-[260px]">Nama Akun</TableHead>
                <TableHead className="text-right">Jumlah</TableHead>
                <TableHead className="w-24 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [1, 2, 3].map((i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={4}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length > 0 ? (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">{row.code}</TableCell>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatRupiah(row.amount)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(row)}
                          aria-label={`Ubah ${row.code}`}
                          className="h-8 w-8"
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(row.id)}
                          aria-label={`Hapus ${row.code}`}
                          className="h-8 w-8 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    Tidak ada data pada filter ini.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Dialog tambah/ubah */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Ubah Item Anggaran' : 'Tambah Item Anggaran'}</DialogTitle>
            <DialogDescription>
              Isi jumlah dalam Rupiah tanpa pemisah ribuan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Bagian</Label>
                <Select
                  value={form.section}
                  onValueChange={(v) => {
                    const first = SECTION_TABS[v]?.[0]?.value ?? ''
                    setForm((f) => ({ ...f, section: v, tab: first }))
                  }}
                >
                  <SelectTrigger aria-label="Bagian item">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pendapatan">Pendapatan</SelectItem>
                    <SelectItem value="belanja">Belanja</SelectItem>
                    <SelectItem value="pembiayaan">Pembiayaan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Tab</Label>
                <Select value={form.tab} onValueChange={(v) => setForm((f) => ({ ...f, tab: v }))}>
                  <SelectTrigger aria-label="Tab item">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(SECTION_TABS[form.section] ?? []).map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bi-code">Kode</Label>
                <Input
                  id="bi-code"
                  value={form.code}
                  onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                  placeholder="5.1.01"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Tahun</Label>
                <Select value={form.year} onValueChange={(v) => setForm((f) => ({ ...f, year: v }))}>
                  <SelectTrigger aria-label="Tahun item">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bi-amount">Jumlah</Label>
                <Input
                  id="bi-amount"
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bi-name">Nama Akun</Label>
              <Input
                id="bi-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Belanja Pegawai"
              />
            </div>
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
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus item anggaran ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan.
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
            <AlertDialogTitle>Hapus SEMUA item anggaran?</AlertDialogTitle>
            <AlertDialogDescription>
              Seluruh {allItems?.length ?? 0} item anggaran pada semua bagian, tab, dan tahun
              akan dihapus permanen. Gunakan tombol <strong>Sinkron dari LRA</strong> untuk
              mengisi ulang dari data LRA yang telah diimport. Tindakan ini tidak dapat
              dibatalkan.
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
