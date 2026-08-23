'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2 } from 'lucide-react'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatPct, formatRupiah0 } from '@/lib/format'
import type { RealisasiAkunRowDto, RealisasiSkpdRowDto } from '@/types/budget'

async function fetchAkun(): Promise<RealisasiAkunRowDto[]> {
  const res = await fetch('/api/admin/realisasi-akun')
  if (!res.ok) throw new Error('Gagal memuat realisasi akun')
  const json = (await res.json()) as { data: RealisasiAkunRowDto[] }
  return json.data
}

async function fetchSkpd(): Promise<RealisasiSkpdRowDto[]> {
  const res = await fetch('/api/admin/realisasi-skpd')
  if (!res.ok) throw new Error('Gagal memuat realisasi SKPD')
  const json = (await res.json()) as { data: RealisasiSkpdRowDto[] }
  return json.data
}

export function AdminRealisasiSection() {
  const [tab, setTab] = useState<'akun' | 'skpd'>('akun')
  return (
    <div>
      <h2 className="mb-4 text-base font-bold uppercase tracking-wide text-foreground">
        Kelola Data Realisasi
      </h2>
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'akun' | 'skpd')} className="w-full">
        <div className="overflow-x-auto pb-1">
          <TabsList className="h-auto w-max gap-1 bg-muted p-1">
            <TabsTrigger
              value="akun"
              className="px-4 py-1.5 text-xs font-semibold uppercase data-[state=active]:bg-[#17408b] data-[state=active]:text-white sm:text-sm"
            >
              Per-Akun
            </TabsTrigger>
            <TabsTrigger
              value="skpd"
              className="px-4 py-1.5 text-xs font-semibold uppercase data-[state=active]:bg-[#17408b] data-[state=active]:text-white sm:text-sm"
            >
              Per-SKPD
            </TabsTrigger>
          </TabsList>
        </div>
        {tab === 'akun' ? <AkunTable /> : <SkpdTable />}
      </Tabs>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Per-Akun
// ---------------------------------------------------------------------------

const GROUP_LABELS: Record<string, string> = {
  PENDAPATAN: 'Pendapatan',
  BELANJA: 'Belanja',
  PEMBIAYAAN: 'Pembiayaan',
}

function AkunTable() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-realisasi-akun'],
    queryFn: fetchAkun,
  })

  const [editing, setEditing] = useState<RealisasiAkunRowDto | null>(null)
  const [anggaran, setAnggaran] = useState('')
  const [realisasi, setRealisasi] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [clearAll, setClearAll] = useState(false)

  function openEdit(row: RealisasiAkunRowDto) {
    setEditing(row)
    setAnggaran(String(row.anggaran))
    setRealisasi(String(row.realisasi))
  }

  async function handleSave() {
    if (!editing) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/realisasi-akun', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editing.id,
          anggaran: Number(anggaran) || 0,
          realisasi: Number(realisasi) || 0,
        }),
      })
      if (!res.ok) throw new Error('Gagal menyimpan')
      toast({ title: `Realisasi ${editing.code} diperbarui` })
      setEditing(null)
      await queryClient.invalidateQueries({ queryKey: ['admin-realisasi-akun'] })
      await queryClient.invalidateQueries({ queryKey: ['realisasi-akun'] })
    } catch (err) {
      toast({ title: 'Gagal menyimpan', description: String(err), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(url: string, successTitle: string) {
    try {
      const res = await fetch(url, { method: 'DELETE' })
      if (!res.ok) throw new Error('Gagal menghapus')
      toast({ title: successTitle })
      await queryClient.invalidateQueries({ queryKey: ['admin-realisasi-akun'] })
      await queryClient.invalidateQueries({ queryKey: ['realisasi-akun'] })
    } catch (err) {
      toast({ title: 'Gagal menghapus', description: String(err), variant: 'destructive' })
    }
  }

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setClearAll(true)}
          disabled={!data?.length}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" /> Hapus Semua
        </Button>
      </div>

      {isError && (
        <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Gagal memuat realisasi akun.
        </p>
      )}

      <div className="overflow-hidden rounded-lg border">
        <div className="max-h-[28rem] overflow-auto nice-scrollbar">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead className="w-24">Kode</TableHead>
                <TableHead className="min-w-[220px]">Uraian</TableHead>
                <TableHead>Grup</TableHead>
                <TableHead className="text-right">Anggaran</TableHead>
                <TableHead className="text-right">Realisasi</TableHead>
                <TableHead className="w-24 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [1, 2, 3].map((i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : data && data.length > 0 ? (
                data.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">{row.code}</TableCell>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {GROUP_LABELS[row.group] ?? row.group}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatRupiah0(row.anggaran)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatRupiah0(row.realisasi)}
                      <span className="block text-[11px] font-semibold text-[#17408b]">
                        {row.anggaran > 0 ? formatPct((row.realisasi / row.anggaran) * 100) : '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(row)}
                          aria-label={`Ubah realisasi ${row.code}`}
                          className="h-8 w-8"
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(row.id)}
                          aria-label={`Hapus realisasi ${row.code}`}
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
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    Belum ada data realisasi. Gunakan fitur Import LRA (PDF).
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Dialog ubah */}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Ubah Realisasi {editing?.code}</DialogTitle>
            <DialogDescription>
              {editing?.name} — isi angka dalam Rupiah tanpa pemisah ribuan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ra-anggaran">Anggaran</Label>
              <Input id="ra-anggaran" type="number" value={anggaran} onChange={(e) => setAnggaran(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ra-realisasi">Realisasi</Label>
              <Input id="ra-realisasi" type="number" value={realisasi} onChange={(e) => setRealisasi(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#17408b] text-white hover:bg-[#12326e]">
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus baris realisasi ini?</AlertDialogTitle>
            <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const id = deleteId
                setDeleteId(null)
                if (id !== null) void handleDelete(`/api/admin/realisasi-akun?id=${id}`, 'Baris realisasi dihapus')
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={clearAll} onOpenChange={setClearAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus SEMUA data realisasi akun?</AlertDialogTitle>
            <AlertDialogDescription>
              Seluruh baris realisasi per-akun akan dihapus permanen. Pertimbangkan export
              cadangan terlebih dahulu.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setClearAll(false)
                void handleDelete('/api/admin/realisasi-akun?all=1', 'Semua data realisasi akun dihapus')
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Hapus Semua
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ---------------------------------------------------------------------------
// Per-SKPD
// ---------------------------------------------------------------------------

function SkpdTable() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-realisasi-skpd'],
    queryFn: fetchSkpd,
  })

  const [editing, setEditing] = useState<RealisasiSkpdRowDto | null>(null)
  const [form, setForm] = useState({
    pendAng: '0',
    pendReal: '0',
    belAng: '0',
    belReal: '0',
    pemAng: '0',
    pemReal: '0',
  })
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [clearAll, setClearAll] = useState(false)

  function openEdit(row: RealisasiSkpdRowDto) {
    setEditing(row)
    setForm({
      pendAng: String(row.pendapatan.anggaran),
      pendReal: String(row.pendapatan.realisasi),
      belAng: String(row.belanja.anggaran),
      belReal: String(row.belanja.realisasi),
      pemAng: String(row.pembiayaan.anggaran),
      pemReal: String(row.pembiayaan.realisasi),
    })
  }

  async function handleSave() {
    if (!editing) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/realisasi-skpd', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editing.id,
          pendapatan: { anggaran: Number(form.pendAng) || 0, realisasi: Number(form.pendReal) || 0 },
          belanja: { anggaran: Number(form.belAng) || 0, realisasi: Number(form.belReal) || 0 },
          pembiayaan: { anggaran: Number(form.pemAng) || 0, realisasi: Number(form.pemReal) || 0 },
        }),
      })
      if (!res.ok) throw new Error('Gagal menyimpan')
      toast({ title: `Data ${editing.name} diperbarui` })
      setEditing(null)
      await queryClient.invalidateQueries({ queryKey: ['admin-realisasi-skpd'] })
      await queryClient.invalidateQueries({ queryKey: ['realisasi-skpd'] })
    } catch (err) {
      toast({ title: 'Gagal menyimpan', description: String(err), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(url: string, successTitle: string) {
    try {
      const res = await fetch(url, { method: 'DELETE' })
      if (!res.ok) throw new Error('Gagal menghapus')
      toast({ title: successTitle })
      await queryClient.invalidateQueries({ queryKey: ['admin-realisasi-skpd'] })
      await queryClient.invalidateQueries({ queryKey: ['realisasi-skpd'] })
    } catch (err) {
      toast({ title: 'Gagal menghapus', description: String(err), variant: 'destructive' })
    }
  }

  const fields: { key: keyof typeof form; label: string }[] = [
    { key: 'pendAng', label: 'Pendapatan — Anggaran' },
    { key: 'pendReal', label: 'Pendapatan — Realisasi' },
    { key: 'belAng', label: 'Belanja — Anggaran' },
    { key: 'belReal', label: 'Belanja — Realisasi' },
    { key: 'pemAng', label: 'Pembiayaan — Anggaran' },
    { key: 'pemReal', label: 'Pembiayaan — Realisasi' },
  ]

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setClearAll(true)}
          disabled={!data?.length}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" /> Hapus Semua
        </Button>
      </div>

      {isError && (
        <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Gagal memuat realisasi SKPD.
        </p>
      )}

      <div className="overflow-hidden rounded-lg border">
        <div className="max-h-[28rem] overflow-auto nice-scrollbar">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead className="min-w-[220px]">Nama SKPD</TableHead>
                <TableHead className="text-right">Pend. Anggaran</TableHead>
                <TableHead className="text-right">Pend. Realisasi</TableHead>
                <TableHead className="text-right">Belanja Anggaran</TableHead>
                <TableHead className="text-right">Belanja Realisasi</TableHead>
                <TableHead className="w-24 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [1, 2, 3].map((i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : data && data.length > 0 ? (
                data.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatRupiah0(row.pendapatan.anggaran)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatRupiah0(row.pendapatan.realisasi)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatRupiah0(row.belanja.anggaran)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatRupiah0(row.belanja.realisasi)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(row)}
                          aria-label={`Ubah data ${row.name}`}
                          className="h-8 w-8"
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(row.id)}
                          aria-label={`Hapus data ${row.name}`}
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
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    Belum ada data realisasi SKPD.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Dialog ubah */}
      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto nice-scrollbar sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ubah Data SKPD</DialogTitle>
            <DialogDescription>
              {editing?.name} — isi angka dalam Rupiah tanpa pemisah ribuan.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {fields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={`skpd-${f.key}`}>{f.label}</Label>
                <Input
                  id={`skpd-${f.key}`}
                  type="number"
                  value={form[f.key]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Batal</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-[#17408b] text-white hover:bg-[#12326e]">
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus data SKPD ini?</AlertDialogTitle>
            <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const id = deleteId
                setDeleteId(null)
                if (id !== null) void handleDelete(`/api/admin/realisasi-skpd?id=${id}`, 'Data SKPD dihapus')
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={clearAll} onOpenChange={setClearAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus SEMUA data realisasi SKPD?</AlertDialogTitle>
            <AlertDialogDescription>
              Seluruh baris realisasi per-SKPD akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setClearAll(false)
                void handleDelete('/api/admin/realisasi-skpd?all=1', 'Semua data SKPD dihapus')
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Hapus Semua
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
