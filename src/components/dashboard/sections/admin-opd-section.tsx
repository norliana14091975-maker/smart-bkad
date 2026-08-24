'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BadgeCheck,
  Check,
  Copy,
  KeyRound,
  Pencil,
  Plus,
  Power,
  ShieldAlert,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import type { OpdCredentialsDto, OpdRowDto } from '@/types/budget'

async function fetchOpds(): Promise<OpdRowDto[]> {
  const res = await fetch('/api/admin/opd')
  if (!res.ok) throw new Error('Gagal memuat data OPD')
  const json = (await res.json()) as { data: OpdRowDto[] }
  return json.data
}

export function AdminOpdSection() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-opd'],
    queryFn: fetchOpds,
  })

  const [addOpen, setAddOpen] = useState(false)
  const [addCode, setAddCode] = useState('')
  const [addName, setAddName] = useState('')
  const [saving, setSaving] = useState(false)

  const [credentials, setCredentials] = useState<OpdCredentialsDto | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const [editRow, setEditRow] = useState<OpdRowDto | null>(null)
  const [editCode, setEditCode] = useState('')
  const [editName, setEditName] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  const [resetRow, setResetRow] = useState<OpdRowDto | null>(null)
  const [resetting, setResetting] = useState(false)
  const [deleteRow, setDeleteRow] = useState<OpdRowDto | null>(null)

  async function handleAdd() {
    if (!addName.trim()) {
      toast({ title: 'Nama OPD/SKPD wajib diisi', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/opd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: addCode.trim() || undefined, name: addName.trim() }),
      })
      const json = (await res.json()) as {
        data?: { opd: OpdRowDto; credentials: OpdCredentialsDto }
        error?: string
      }
      if (!res.ok || !json.data) throw new Error(json.error ?? 'Gagal menambah OPD')
      toast({ title: `OPD "${json.data.opd.name}" ditambahkan` })
      setAddOpen(false)
      setAddCode('')
      setAddName('')
      setCredentials(json.data.credentials) // tampilkan kredensial sekali
      await queryClient.invalidateQueries({ queryKey: ['admin-opd'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-overview'] })
    } catch (err) {
      toast({ title: 'Gagal menambah OPD', description: String(err), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  function openEdit(row: OpdRowDto) {
    setEditRow(row)
    setEditCode(row.code)
    setEditName(row.name)
  }

  async function handleEditSave() {
    if (!editRow || !editName.trim()) return
    setEditSaving(true)
    try {
      const res = await fetch('/api/admin/opd', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editRow.id, code: editCode.trim(), name: editName.trim() }),
      })
      const json = (await res.json()) as { data?: OpdRowDto; error?: string }
      if (!res.ok || !json.data) throw new Error(json.error ?? 'Gagal memperbarui')
      toast({ title: 'Data OPD diperbarui' })
      setEditRow(null)
      await queryClient.invalidateQueries({ queryKey: ['admin-opd'] })
      await queryClient.invalidateQueries({ queryKey: ['realisasi-skpd'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-realisasi-skpd'] })
    } catch (err) {
      toast({ title: 'Gagal memperbarui', description: String(err), variant: 'destructive' })
    } finally {
      setEditSaving(false)
    }
  }

  async function handleResetPassword() {
    if (!resetRow) return
    setResetting(true)
    try {
      const res = await fetch(`/api/admin/opd/reset-password?id=${resetRow.id}`, { method: 'POST' })
      const json = (await res.json()) as { data?: { credentials: OpdCredentialsDto }; error?: string }
      if (!res.ok || !json.data) throw new Error(json.error ?? 'Gagal reset password')
      toast({ title: 'Password akun OPD direset' })
      setResetRow(null)
      setCredentials(json.data.credentials)
    } catch (err) {
      toast({ title: 'Gagal reset password', description: String(err), variant: 'destructive' })
    } finally {
      setResetting(false)
    }
  }

  async function handleToggle(row: OpdRowDto) {
    try {
      const res = await fetch(`/api/admin/opd/toggle?id=${row.id}`, { method: 'POST' })
      const json = (await res.json()) as { data?: { active: boolean }; error?: string }
      if (!res.ok || !json.data) throw new Error(json.error ?? 'Gagal mengubah status')
      toast({
        title: json.data.active
          ? `Akun "${row.username}" diaktifkan`
          : `Akun "${row.username}" dinonaktifkan (sesi dihapus)`,
      })
      await queryClient.invalidateQueries({ queryKey: ['admin-opd'] })
    } catch (err) {
      toast({ title: 'Gagal mengubah status', description: String(err), variant: 'destructive' })
    }
  }

  async function handleDelete() {
    if (!deleteRow) return
    try {
      const res = await fetch(`/api/admin/opd?id=${deleteRow.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = (await res.json()) as { error?: string }
        throw new Error(json.error ?? 'Gagal menghapus')
      }
      toast({ title: `OPD "${deleteRow.name}" dan akunnya dihapus` })
      await queryClient.invalidateQueries({ queryKey: ['admin-opd'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-overview'] })
    } catch (err) {
      toast({ title: 'Gagal menghapus', description: String(err), variant: 'destructive' })
    } finally {
      setDeleteRow(null)
    }
  }

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 1600)
    } catch {
      toast({ title: 'Gagal menyalin', variant: 'destructive' })
    }
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold uppercase tracking-wide text-foreground">
            Kelola Data OPD/SKPD
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Setiap OPD yang ditambahkan otomatis mendapat akun login sendiri.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} size="sm" className="bg-[#17408b] text-white hover:bg-[#12326e]">
          <Plus className="h-4 w-4" aria-hidden="true" /> Tambah OPD
        </Button>
      </div>

      {isError && (
        <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Gagal memuat data OPD.
        </p>
      )}

      <div className="overflow-hidden rounded-lg border">
        <div className="max-h-[28rem] overflow-auto nice-scrollbar">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead className="w-28">Kode</TableHead>
                <TableHead className="min-w-[220px]">Nama OPD/SKPD</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Dibuat</TableHead>
                <TableHead className="w-40 text-right">Aksi</TableHead>
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
                    <TableCell>
                      <span className="font-mono text-xs">{row.username ?? '—'}</span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={row.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                      >
                        {row.active ? 'Aktif' : 'Nonaktif'}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(row.createdAt).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(row)}
                          aria-label={`Ubah ${row.name}`}
                          className="h-8 w-8"
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setResetRow(row)}
                          aria-label={`Reset password ${row.name}`}
                          className="h-8 w-8 text-[#17408b] hover:text-[#17408b]"
                        >
                          <KeyRound className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggle(row)}
                          aria-label={row.active ? `Nonaktifkan ${row.name}` : `Aktifkan ${row.name}`}
                          className={`h-8 w-8 ${row.active ? 'text-amber-600 hover:text-amber-600' : 'text-green-700 hover:text-green-700'}`}
                        >
                          <Power className="h-4 w-4" aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteRow(row)}
                          aria-label={`Hapus ${row.name}`}
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
                    Belum ada OPD terdaftar. Klik “Tambah OPD” untuk membuat akun OPD pertama.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Dialog tambah OPD */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-[#17408b]" aria-hidden="true" />
              Tambah OPD/SKPD
            </DialogTitle>
            <DialogDescription>
              Akun login akan dibuat otomatis — username dari nama OPD, password dibuat sistem.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="opd-code">Kode OPD (opsional)</Label>
              <Input
                id="opd-code"
                value={addCode}
                onChange={(e) => setAddCode(e.target.value)}
                placeholder="Otomatis: OPD-001"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="opd-name">Nama OPD/SKPD</Label>
              <Input
                id="opd-name"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="DINAS KESEHATAN"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Batal</Button>
            <Button onClick={handleAdd} disabled={saving} className="bg-[#17408b] text-white hover:bg-[#12326e]">
              {saving ? 'Menyimpan…' : 'Buat OPD + Akun'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog kredensial (tampil sekali) */}
      <Dialog open={credentials !== null} onOpenChange={(open) => !open && setCredentials(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BadgeCheck className="h-5 w-5 text-green-700" aria-hidden="true" />
              Akun OPD Dibuat
            </DialogTitle>
            <DialogDescription>
              OPD <strong>{credentials?.opdName}</strong> dapat login dengan kredensial berikut.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/40 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Username
              </p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <code className="text-sm font-bold">{credentials?.username}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => credentials && copy(credentials.username, 'u')}
                  aria-label="Salin username"
                >
                  {copied === 'u' ? (
                    <Check className="h-4 w-4 text-green-700" aria-hidden="true" />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  )}
                </Button>
              </div>
            </div>
            <div className="rounded-md border bg-muted/40 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Password
              </p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <code className="text-sm font-bold">{credentials?.password}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => credentials && copy(credentials.password, 'p')}
                  aria-label="Salin password"
                >
                  {copied === 'p' ? (
                    <Check className="h-4 w-4 text-green-700" aria-hidden="true" />
                  ) : (
                    <Copy className="h-4 w-4" aria-hidden="true" />
                  )}
                </Button>
              </div>
            </div>
            <p className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Password hanya ditampilkan sekali ini. Salin dan simpan dengan aman — bila hilang,
              gunakan tombol reset password pada tabel.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setCredentials(null)} className="bg-[#17408b] text-white hover:bg-[#12326e]">
              Mengerti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog ubah */}
      <Dialog open={editRow !== null} onOpenChange={(open) => !open && setEditRow(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ubah Data OPD</DialogTitle>
            <DialogDescription>
              Bila nama berubah, data realisasi SKPD terkait ikut diperbarui. Username tidak berubah.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-opd-code">Kode OPD</Label>
              <Input id="edit-opd-code" value={editCode} onChange={(e) => setEditCode(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-opd-name">Nama OPD/SKPD</Label>
              <Input id="edit-opd-name" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>Batal</Button>
            <Button onClick={handleEditSave} disabled={editSaving} className="bg-[#17408b] text-white hover:bg-[#12326e]">
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Konfirmasi reset password */}
      <AlertDialog open={resetRow !== null} onOpenChange={(open) => !open && setResetRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset password akun OPD ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Password baru akan dibuat sistem dan ditampilkan sekali. Semua sesi login OPD
              “{resetRow?.name}” akan dihapus sehingga harus login ulang.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetPassword}
              disabled={resetting}
              className="bg-[#17408b] text-white hover:bg-[#12326e]"
            >
              {resetting ? 'Mereload…' : 'Ya, Reset'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Konfirmasi hapus */}
      <AlertDialog open={deleteRow !== null} onOpenChange={(open) => !open && setDeleteRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus OPD “{deleteRow?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Akun login OPD ini (username {deleteRow?.username}) juga akan dihapus permanen.
              Data realisasi SKPD tidak ikut terhapus.
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
    </div>
  )
}
