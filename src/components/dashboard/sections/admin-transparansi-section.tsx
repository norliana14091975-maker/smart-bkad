'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Plus, Trash2 } from 'lucide-react'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { TransparansiRowDto } from '@/types/budget'

async function fetchDocs(type: string): Promise<TransparansiRowDto[]> {
  const res = await fetch(`/api/admin/transparansi?type=${type}`)
  if (!res.ok) throw new Error('Gagal memuat dokumen')
  const json = (await res.json()) as { data: TransparansiRowDto[] }
  return json.data
}

export function AdminTransparansiSection() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [type, setType] = useState<'APBD' | 'Realisasi'>('APBD')
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-transparansi', type],
    queryFn: () => fetchDocs(type),
  })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('#')
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  async function handleAdd() {
    if (!title.trim()) {
      toast({ title: 'Judul dokumen wajib diisi', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/transparansi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, title: title.trim(), url: url.trim() || '#' }),
      })
      if (!res.ok) {
        const json = (await res.json()) as { error?: string }
        throw new Error(json.error ?? 'Gagal menyimpan')
      }
      toast({ title: 'Dokumen transparansi ditambahkan' })
      setDialogOpen(false)
      setTitle('')
      setUrl('#')
      await queryClient.invalidateQueries({ queryKey: ['admin-transparansi'] })
      await queryClient.invalidateQueries({ queryKey: ['transparansi'] })
    } catch (err) {
      toast({ title: 'Gagal menyimpan', description: String(err), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (deleteId === null) return
    try {
      const res = await fetch(`/api/admin/transparansi?id=${deleteId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Gagal menghapus')
      toast({ title: 'Dokumen dihapus' })
      await queryClient.invalidateQueries({ queryKey: ['admin-transparansi'] })
      await queryClient.invalidateQueries({ queryKey: ['transparansi'] })
    } catch (err) {
      toast({ title: 'Gagal menghapus', description: String(err), variant: 'destructive' })
    } finally {
      setDeleteId(null)
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold uppercase tracking-wide text-foreground">
          Kelola Dokumen Transparansi
        </h2>
        <Button onClick={() => setDialogOpen(true)} size="sm" className="bg-[#17408b] text-white hover:bg-[#12326e]">
          <Plus className="h-4 w-4" aria-hidden="true" /> Tambah Dokumen
        </Button>
      </div>

      <Tabs value={type} onValueChange={(v) => setType(v as 'APBD' | 'Realisasi')} className="w-full">
        <div className="flex justify-center pb-4">
          <TabsList className="h-auto w-max gap-1 bg-muted p-1">
            <TabsTrigger
              value="APBD"
              className="px-5 py-1.5 text-xs font-semibold uppercase data-[state=active]:bg-[#17408b] data-[state=active]:text-white sm:text-sm"
            >
              APBD
            </TabsTrigger>
            <TabsTrigger
              value="Realisasi"
              className="px-5 py-1.5 text-xs font-semibold uppercase data-[state=active]:bg-[#17408b] data-[state=active]:text-white sm:text-sm"
            >
              Realisasi
            </TabsTrigger>
          </TabsList>
        </div>
      </Tabs>

      {isError && (
        <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Gagal memuat dokumen transparansi.
        </p>
      )}

      <div className="overflow-hidden rounded-lg border">
        <div className="max-h-[28rem] overflow-y-auto nice-scrollbar">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/60">
                <TableHead className="w-14 text-center">#</TableHead>
                <TableHead className="min-w-[240px]">Judul Dokumen</TableHead>
                <TableHead>URL</TableHead>
                <TableHead className="w-20 text-right">Aksi</TableHead>
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
              ) : data && data.length > 0 ? (
                data.map((doc, idx) => (
                  <TableRow key={doc.id}>
                    <TableCell className="text-center text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{doc.title}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs">
                      {doc.url && doc.url !== '#' ? (
                        <a
                          href={doc.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[#17408b] hover:underline"
                          aria-label={`Buka URL dokumen ${doc.title} pada tab baru`}
                        >
                          <span className="truncate">{doc.url}</span>
                          <ExternalLink className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">— belum diisi —</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(doc.id)}
                        aria-label={`Hapus ${doc.title}`}
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    Belum ada dokumen pada kategori ini.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Dialog tambah */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Dokumen Transparansi</DialogTitle>
            <DialogDescription>
              Dokumen akan ditambahkan pada kategori <strong>{type}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Kategori</Label>
              <Select value={type} onValueChange={(v) => setType(v as 'APBD' | 'Realisasi')}>
                <SelectTrigger aria-label="Kategori dokumen">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="APBD">APBD</SelectItem>
                  <SelectItem value="Realisasi">Realisasi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-title">Judul</Label>
              <Input
                id="doc-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Laporan Realisasi APBD"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="doc-url">URL</Label>
              <Input
                id="doc-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button>
            <Button onClick={handleAdd} disabled={saving} className="bg-[#17408b] text-white hover:bg-[#12326e]">
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Konfirmasi hapus */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus dokumen ini?</AlertDialogTitle>
            <AlertDialogDescription>Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
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
