'use client'

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BadgeCheck,
  Building2,
  Check,
  Copy,
  Crown,
  KeyRound,
  Pencil,
  Power,
  Search,
  ShieldCheck,
  ShieldAlert,
  Trash2,
  UserCog,
  UserPlus,
  Users,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { AkunUraian } from '@/components/dashboard/akun-uraian'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { AuthUserDto, UserCredentialsDto, UserRowDto } from '@/types/budget'

interface UsersResponse {
  users: UserRowDto[]
  availableOpds: { id: number; name: string }[]
}

async function fetchUsers(): Promise<UsersResponse> {
  const res = await fetch('/api/admin/users')
  if (!res.ok) throw new Error('Gagal memuat data pengguna')
  const json = (await res.json()) as { data: UsersResponse }
  return json.data
}

const ROLE_OPTIONS: { value: UserRowDto['role']; label: string; hint: string }[] = [
  { value: 'admin', label: 'Admin', hint: 'Akses penuh seluruh menu' },
  { value: 'kepala_daerah', label: 'Kepala Daerah', hint: 'Ringkasan Eksekutif, Analisis Risiko, AI Copilot' },
  { value: 'opd', label: 'OPD/SKPD', hint: 'Area OPD + import LRA' },
]

function roleBadgeClass(role: UserRowDto['role']) {
  if (role === 'admin') return 'bg-[#17408b]/10 text-[#17408b] border-[#17408b]/20'
  if (role === 'kepala_daerah') return 'bg-amber-100 text-amber-800 border-amber-200'
  return 'bg-green-100 text-green-800 border-green-200'
}

function roleLabel(role: UserRowDto['role']) {
  return ROLE_OPTIONS.find((o) => o.value === role)?.label ?? role
}

export function AdminUsersSection({ currentUser }: { currentUser: AuthUserDto | null }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-users'],
    queryFn: fetchUsers,
  })

  // Filter tabel
  const [roleFilter, setRoleFilter] = useState<'all' | UserRowDto['role']>('all')
  const [search, setSearch] = useState('')

  // Dialog tambah
  const [addOpen, setAddOpen] = useState(false)
  const [addUsername, setAddUsername] = useState('')
  const [addRole, setAddRole] = useState<UserRowDto['role']>('kepala_daerah')
  const [addOpdId, setAddOpdId] = useState<string>('')
  const [addCustomPwd, setAddCustomPwd] = useState(false)
  const [addPassword, setAddPassword] = useState('')
  const [saving, setSaving] = useState(false)

  // Dialog kredensial (tampil sekali)
  const [credentials, setCredentials] = useState<UserCredentialsDto | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  // Dialog ubah
  const [editRow, setEditRow] = useState<UserRowDto | null>(null)
  const [editUsername, setEditUsername] = useState('')
  const [editRole, setEditRole] = useState<'admin' | 'kepala_daerah'>('admin')
  const [editSaving, setEditSaving] = useState(false)

  // Dialog reset password
  const [resetRow, setResetRow] = useState<UserRowDto | null>(null)
  const [resetCustomPwd, setResetCustomPwd] = useState(false)
  const [resetPassword, setResetPassword] = useState('')
  const [resetting, setResetting] = useState(false)

  // Konfirmasi toggle & hapus
  const [toggleRow, setToggleRow] = useState<UserRowDto | null>(null)
  const [toggling, setToggling] = useState(false)
  const [deleteRow, setDeleteRow] = useState<UserRowDto | null>(null)
  const [deleting, setDeleting] = useState(false)

  const users = data?.users ?? []
  const availableOpds = data?.availableOpds ?? []

  const stats = useMemo(
    () => ({
      total: users.length,
      admin: users.filter((u) => u.role === 'admin').length,
      kepala: users.filter((u) => u.role === 'kepala_daerah').length,
      opd: users.filter((u) => u.role === 'opd').length,
      nonaktif: users.filter((u) => !u.active).length,
    }),
    [users]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false
      if (q && !u.username.toLowerCase().includes(q) && !(u.opdName ?? '').toLowerCase().includes(q)) {
        return false
      }
      return true
    })
  }, [users, roleFilter, search])

  const isSelf = (row: UserRowDto) => currentUser != null && row.username === currentUser.username

  function closeAdd() {
    setAddOpen(false)
    setAddUsername('')
    setAddRole('kepala_daerah')
    setAddOpdId('')
    setAddCustomPwd(false)
    setAddPassword('')
  }

  async function handleAdd() {
    if (!addUsername.trim()) {
      toast({ title: 'Username wajib diisi', variant: 'destructive' })
      return
    }
    if (addCustomPwd && addPassword.length < 8) {
      toast({ title: 'Password minimal 8 karakter', variant: 'destructive' })
      return
    }
    if (addRole === 'opd' && !addOpdId) {
      toast({ title: 'Pilih OPD/SKPD tujuan akun', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: addUsername.trim(),
          role: addRole,
          ...(addRole === 'opd' && addOpdId ? { opdId: Number(addOpdId) } : {}),
          ...(addCustomPwd ? { password: addPassword } : {}),
        }),
      })
      const json = (await res.json()) as {
        data?: { user: { username: string }; credentials: UserCredentialsDto }
        error?: string
      }
      if (!res.ok || !json.data) throw new Error(json.error ?? 'Gagal menambah pengguna')
      toast({ title: `Pengguna "${json.data.user.username}" dibuat` })
      closeAdd()
      setCredentials(json.data.credentials)
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-overview'] })
    } catch (err) {
      toast({ title: 'Gagal menambah pengguna', description: String(err), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  function openEdit(row: UserRowDto) {
    setEditRow(row)
    setEditUsername(row.username)
    setEditRole(row.role === 'admin' ? 'admin' : 'kepala_daerah')
  }

  async function handleEditSave() {
    if (!editRow || !editUsername.trim()) return
    setEditSaving(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editRow.id,
          username: editUsername.trim(),
          ...(editRow.role !== 'opd' && !isSelf(editRow) ? { role: editRole } : {}),
        }),
      })
      const json = (await res.json()) as { data?: { username: string }; error?: string }
      if (!res.ok || !json.data) throw new Error(json.error ?? 'Gagal memperbarui')
      toast({ title: 'Data pengguna diperbarui' })
      setEditRow(null)
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    } catch (err) {
      toast({ title: 'Gagal memperbarui', description: String(err), variant: 'destructive' })
    } finally {
      setEditSaving(false)
    }
  }

  async function handleResetPassword() {
    if (!resetRow) return
    if (resetCustomPwd && resetPassword.length < 8) {
      toast({ title: 'Password minimal 8 karakter', variant: 'destructive' })
      return
    }
    setResetting(true)
    try {
      const res = await fetch('/api/admin/users/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: resetRow.id,
          ...(resetCustomPwd ? { password: resetPassword } : {}),
        }),
      })
      const json = (await res.json()) as { data?: { credentials: UserCredentialsDto }; error?: string }
      if (!res.ok || !json.data) throw new Error(json.error ?? 'Gagal reset password')
      toast({
        title: `Password "${resetRow.username}" direset`,
        description: isSelf(resetRow)
          ? 'Sesi Anda tetap aktif; sesi lain telah dihapus.'
          : 'Semua sesi login pengguna tersebut dihapus.',
      })
      setResetRow(null)
      setResetCustomPwd(false)
      setResetPassword('')
      setCredentials(json.data.credentials)
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    } catch (err) {
      toast({ title: 'Gagal reset password', description: String(err), variant: 'destructive' })
    } finally {
      setResetting(false)
    }
  }

  async function handleToggle() {
    if (!toggleRow) return
    setToggling(true)
    try {
      const res = await fetch(`/api/admin/users/toggle?id=${toggleRow.id}`, { method: 'POST' })
      const json = (await res.json()) as { data?: { active: boolean }; error?: string }
      if (!res.ok || !json.data) throw new Error(json.error ?? 'Gagal mengubah status')
      toast({
        title: json.data.active
          ? `Akun "${toggleRow.username}" diaktifkan`
          : `Akun "${toggleRow.username}" dinonaktifkan (sesi dihapus)`,
      })
      setToggleRow(null)
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
    } catch (err) {
      toast({ title: 'Gagal mengubah status', description: String(err), variant: 'destructive' })
    } finally {
      setToggling(false)
    }
  }

  async function handleDelete() {
    if (!deleteRow) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/users?id=${deleteRow.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = (await res.json()) as { error?: string }
        throw new Error(json.error ?? 'Gagal menghapus')
      }
      toast({ title: `Pengguna "${deleteRow.username}" dihapus` })
      setDeleteRow(null)
      await queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-overview'] })
    } catch (err) {
      toast({ title: 'Gagal menghapus', description: String(err), variant: 'destructive' })
    } finally {
      setDeleting(false)
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

  const addOpdBlocked = addRole === 'opd' && availableOpds.length === 0

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold uppercase tracking-wide text-foreground">
            Manajemen Pengguna
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Kelola akun admin, Kepala Daerah, dan OPD/SKPD — password, status, dan peran.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} size="sm" className="bg-[#17408b] text-white hover:bg-[#12326e]">
          <UserPlus className="h-4 w-4" aria-hidden="true" /> Tambah Pengguna
        </Button>
      </div>

      {/* Ringkasan jumlah */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="py-3">
          <CardContent className="flex items-center gap-3 px-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
              <Users className="h-4 w-4 text-[#17408b]" aria-hidden="true" />
            </div>
            <div>
              <p className="text-lg font-bold leading-tight tabular-nums">{stats.total}</p>
              <p className="text-[11px] text-muted-foreground">Total Pengguna</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="flex items-center gap-3 px-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
              <ShieldCheck className="h-4 w-4 text-[#17408b]" aria-hidden="true" />
            </div>
            <div>
              <p className="text-lg font-bold leading-tight tabular-nums">{stats.admin}</p>
              <p className="text-[11px] text-muted-foreground">Admin</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="flex items-center gap-3 px-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
              <Crown className="h-4 w-4 text-amber-600" aria-hidden="true" />
            </div>
            <div>
              <p className="text-lg font-bold leading-tight tabular-nums">{stats.kepala}</p>
              <p className="text-[11px] text-muted-foreground">Kepala Daerah</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="flex items-center gap-3 px-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
              <Building2 className="h-4 w-4 text-green-700" aria-hidden="true" />
            </div>
            <div>
              <p className="text-lg font-bold leading-tight tabular-nums">{stats.opd}</p>
              <p className="text-[11px] text-muted-foreground">
                OPD/SKPD{stats.nonaktif > 0 ? ` · ${stats.nonaktif} nonaktif` : ''}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari username atau OPD…"
            className="pl-8"
            aria-label="Cari pengguna"
          />
        </div>
        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as 'all' | UserRowDto['role'])}>
          <SelectTrigger className="w-[170px]" aria-label="Filter peran">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Peran</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="kepala_daerah">Kepala Daerah</SelectItem>
            <SelectItem value="opd">OPD/SKPD</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isError && (
        <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          Gagal memuat data pengguna.
        </p>
      )}

      <div className="overflow-hidden rounded-lg border">
        <div className="max-h-[28rem] overflow-auto nice-scrollbar">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead className="min-w-[150px]">Username</TableHead>
                <TableHead>Peran</TableHead>
                <TableHead className="min-w-[180px]">OPD/SKPD</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Sesi</TableHead>
                <TableHead>Dibuat</TableHead>
                <TableHead className="w-40 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [1, 2, 3, 4].map((i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-5 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filtered.length > 0 ? (
                filtered.map((row) => {
                  const self = isSelf(row)
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs font-semibold">
                        {row.username}
                        {self && (
                          <Badge variant="outline" className="ml-2 border-[#17408b]/30 bg-[#17408b]/5 text-[10px] text-[#17408b]">
                            Anda
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={roleBadgeClass(row.role)}>
                          {row.role === 'admin' && <ShieldCheck className="mr-1 h-3 w-3" aria-hidden="true" />}
                          {row.role === 'kepala_daerah' && <Crown className="mr-1 h-3 w-3" aria-hidden="true" />}
                          {row.role === 'opd' && <Building2 className="mr-1 h-3 w-3" aria-hidden="true" />}
                          {roleLabel(row.role)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {row.opdName ? <AkunUraian name={row.opdName} /> : <span className="text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        {!row.active ? (
                          <Badge variant="secondary" className="bg-red-100 text-red-800">Nonaktif</Badge>
                        ) : row.role === 'opd' && row.opdActive === false ? (
                          <Badge variant="secondary" className="bg-amber-100 text-amber-800">OPD Nonaktif</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-green-100 text-green-800">Aktif</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.sessionCount > 0 ? (
                          <span className="inline-flex items-center gap-1.5 text-xs tabular-nums">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                            {row.sessionCount}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
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
                            aria-label={`Ubah ${row.username}`}
                            className="h-8 w-8"
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setResetRow(row)
                              setResetCustomPwd(false)
                              setResetPassword('')
                            }}
                            aria-label={`Reset password ${row.username}`}
                            className="h-8 w-8 text-[#17408b] hover:text-[#17408b]"
                          >
                            <KeyRound className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setToggleRow(row)}
                            disabled={self}
                            aria-label={row.active ? `Nonaktifkan ${row.username}` : `Aktifkan ${row.username}`}
                            title={self ? 'Tidak dapat menonaktifkan akun sendiri' : undefined}
                            className={`h-8 w-8 ${row.active ? 'text-amber-600 hover:text-amber-600' : 'text-green-700 hover:text-green-700'}`}
                          >
                            <Power className="h-4 w-4" aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteRow(row)}
                            disabled={self}
                            aria-label={`Hapus ${row.username}`}
                            title={self ? 'Tidak dapat menghapus akun sendiri' : undefined}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                    Tidak ada pengguna yang cocok dengan filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Dialog tambah pengguna */}
      <Dialog open={addOpen} onOpenChange={(open) => (open ? setAddOpen(true) : closeAdd())}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-[#17408b]" aria-hidden="true" />
              Tambah Pengguna
            </DialogTitle>
            <DialogDescription>
              Buat akun baru dan tentukan perannya. Password ditampilkan sekali setelah akun dibuat.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="user-username">Username</Label>
              <Input
                id="user-username"
                value={addUsername}
                onChange={(e) => setAddUsername(e.target.value)}
                placeholder="mis. admin-keuangan"
                autoComplete="off"
              />
              <p className="text-[11px] text-muted-foreground">
                3-40 karakter: huruf, angka, titik, garisbawah, garispisah.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label>Peran</Label>
              <Select value={addRole} onValueChange={(v) => setAddRole(v as UserRowDto['role'])}>
                <SelectTrigger aria-label="Pilih peran">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label} — {o.hint}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {addRole === 'opd' && (
              <div className="space-y-1.5">
                <Label>OPD/SKPD Tujuan</Label>
                {availableOpds.length > 0 ? (
                  <Select value={addOpdId} onValueChange={setAddOpdId}>
                    <SelectTrigger aria-label="Pilih OPD/SKPD">
                      <SelectValue placeholder="Pilih OPD/SKPD…" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableOpds.map((o) => (
                        <SelectItem key={o.id} value={String(o.id)}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-800">
                    Semua OPD terdaftar sudah memiliki akun. Tambahkan OPD baru lewat menu
                    <strong> Data OPD/SKPD</strong> — akunnya dibuat otomatis di sana.
                  </p>
                )}
              </div>
            )}
            <div className="space-y-2 rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="custom-pwd" className="text-sm">Atur password sendiri</Label>
                <Switch id="custom-pwd" checked={addCustomPwd} onCheckedChange={setAddCustomPwd} />
              </div>
              {addCustomPwd ? (
                <Input
                  type="text"
                  value={addPassword}
                  onChange={(e) => setAddPassword(e.target.value)}
                  placeholder="Minimal 8 karakter"
                  autoComplete="new-password"
                  aria-label="Password kustom"
                />
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Password dibuat sistem (format Akun-xxxxxxxxxx) dan hanya ditampilkan sekali.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeAdd}>Batal</Button>
            <Button onClick={handleAdd} disabled={saving || addOpdBlocked} className="bg-[#17408b] text-white hover:bg-[#12326e]">
              {saving ? 'Menyimpan…' : 'Buat Pengguna'}
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
              Kredensial Pengguna
            </DialogTitle>
            <DialogDescription>
              Simpan kredensial berikut — password hanya ditampilkan sekali ini.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/40 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Username</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <code className="text-sm font-bold">{credentials?.username}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => credentials && copy(credentials.username, 'u')}
                  aria-label="Salin username"
                >
                  {copied === 'u' ? <Check className="h-4 w-4 text-green-700" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                </Button>
              </div>
            </div>
            <div className="rounded-md border bg-muted/40 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Password</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <code className="text-sm font-bold">{credentials?.password}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => credentials && copy(credentials.password, 'p')}
                  aria-label="Salin password"
                >
                  {copied === 'p' ? <Check className="h-4 w-4 text-green-700" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                </Button>
              </div>
            </div>
            <p className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Bila password hilang, gunakan tombol reset password pada tabel pengguna.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setCredentials(null)} className="bg-[#17408b] text-white hover:bg-[#12326e]">
              Mengerti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog ubah pengguna */}
      <Dialog open={editRow !== null} onOpenChange={(open) => !open && setEditRow(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5 text-[#17408b]" aria-hidden="true" />
              Ubah Pengguna
            </DialogTitle>
            <DialogDescription>
              Ubah username dan peran. Peran akun OPD dikelola lewat menu Data OPD/SKPD.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-username">Username</Label>
              <Input
                id="edit-username"
                value={editUsername}
                onChange={(e) => setEditUsername(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Peran</Label>
              <Select
                value={editRole}
                onValueChange={(v) => setEditRole(v as 'admin' | 'kepala_daerah')}
                disabled={editRow?.role === 'opd' || (editRow != null && isSelf(editRow))}
              >
                <SelectTrigger aria-label="Pilih peran">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin — akses penuh</SelectItem>
                  <SelectItem value="kepala_daerah">Kepala Daerah — Analisis &amp; AI</SelectItem>
                </SelectContent>
              </Select>
              {editRow?.role === 'opd' && (
                <p className="text-[11px] text-muted-foreground">
                  Akun OPD tertaut ke {editRow.opdName} — perannya tetap OPD/SKPD.
                </p>
              )}
              {editRow != null && isSelf(editRow) && (
                <p className="text-[11px] text-muted-foreground">
                  Peran akun sendiri tidak dapat diubah.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>Batal</Button>
            <Button onClick={handleEditSave} disabled={editSaving} className="bg-[#17408b] text-white hover:bg-[#12326e]">
              {editSaving ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog reset password */}
      <Dialog open={resetRow !== null} onOpenChange={(open) => !open && setResetRow(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset password “{resetRow?.username}”?</DialogTitle>
            <DialogDescription>
              {resetRow != null && isSelf(resetRow)
                ? 'Sesi Anda saat ini tetap aktif, tetapi sesi login lain akan dihapus.'
                : 'Semua sesi login pengguna ini akan dihapus sehingga harus login ulang.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="reset-custom-pwd" className="text-sm">Atur password sendiri</Label>
              <Switch id="reset-custom-pwd" checked={resetCustomPwd} onCheckedChange={setResetCustomPwd} />
            </div>
            {resetCustomPwd ? (
              <Input
                type="text"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="Minimal 8 karakter"
                autoComplete="new-password"
                aria-label="Password kustom baru"
              />
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Password baru dibuat sistem (format Akun-xxxxxxxxxx) dan ditampilkan sekali.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetRow(null)}>Batal</Button>
            <Button onClick={handleResetPassword} disabled={resetting} className="bg-[#17408b] text-white hover:bg-[#12326e]">
              {resetting ? 'Meriset…' : 'Ya, Reset'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Konfirmasi toggle */}
      <AlertDialog open={toggleRow !== null} onOpenChange={(open) => !open && setToggleRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleRow?.active ? 'Nonaktifkan' : 'Aktifkan'} akun “{toggleRow?.username}”?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleRow?.active
                ? 'Akun tidak bisa login dan semua sesi aktifnya dihapus (logout paksa).'
                : 'Akun dapat login kembali dengan username dan password yang sama.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggle}
              disabled={toggling}
              className={toggleRow?.active ? 'bg-amber-600 text-white hover:bg-amber-700' : 'bg-[#17408b] text-white hover:bg-[#12326e]'}
            >
              {toggling ? 'Memproses…' : toggleRow?.active ? 'Ya, Nonaktifkan' : 'Ya, Aktifkan'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Konfirmasi hapus */}
      <AlertDialog open={deleteRow !== null} onOpenChange={(open) => !open && setDeleteRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus pengguna “{deleteRow?.username}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Akun dihapus permanen beserta seluruh sesi loginnya.
              {deleteRow?.role === 'opd'
                ? ' Data OPD dan realisasi SKPD terkait tidak ikut terhapus (hanya akun loginnya).'
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-white hover:bg-destructive/90">
              {deleting ? 'Menghapus…' : 'Hapus'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
