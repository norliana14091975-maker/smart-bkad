'use client'

import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2, RotateCcw, Save, Trash2, Upload } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useSettings } from '@/hooks/use-settings'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { DkiEmblem } from '@/components/dashboard/emblem'
import { DEFAULT_SETTINGS } from '@/lib/default-settings'
import type { AppSettingsDto } from '@/types/budget'

type TextKey =
  | 'appName'
  | 'appTitle'
  | 'appDescription'
  | 'brandText'
  | 'brandSubtext'
  | 'footerText'

const TEXT_FIELDS: {
  key: TextKey
  label: string
  placeholder: string
  max: number
  textarea?: boolean
  hint?: string
}[] = [
  {
    key: 'appName',
    label: 'Nama Aplikasi',
    placeholder: 'DASHBOARD',
    max: 40,
    hint: 'Tampil sebagai teks brand di sidebar.',
  },
  {
    key: 'appTitle',
    label: 'Judul Halaman',
    placeholder: 'Dashboard Keuangan DKI',
    max: 100,
    hint: 'Tampil pada tab/judul browser.',
  },
  {
    key: 'appDescription',
    label: 'Deskripsi Aplikasi',
    placeholder: 'Dashboard monitoring pengelolaan keuangan daerah…',
    max: 300,
    textarea: true,
    hint: 'Meta description untuk mesin pencari.',
  },
  {
    key: 'brandText',
    label: 'Teks Brand Header',
    placeholder: 'BPKD',
    max: 30,
    hint: 'Teks utama di pita biru bagian atas.',
  },
  {
    key: 'brandSubtext',
    label: 'Sub-teks Brand Header',
    placeholder: 'Provinsi DKI Jakarta',
    max: 60,
  },
  {
    key: 'footerText',
    label: 'Teks Footer',
    placeholder: 'Dashboard Monitoring Pengelolaan Keuangan Daerah — …',
    max: 200,
    textarea: true,
  },
]

export function AdminSettingsSection() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data, isLoading } = useSettings()

  // draf perubahan teks; nilai efektif = draf > data > bawaan
  const [draft, setDraft] = useState<Partial<Record<TextKey, string>>>({})
  const [saving, setSaving] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [uploading, setUploading] = useState<'logo' | 'favicon' | null>(null)

  const logoInputRef = useRef<HTMLInputElement>(null)
  const faviconInputRef = useRef<HTMLInputElement>(null)

  const value = (key: TextKey): string => {
    if (draft[key] !== undefined) return draft[key]
    const current = data?.[key]
    if (typeof current === 'string') return current
    return DEFAULT_SETTINGS[key]
  }

  const dirty = TEXT_FIELDS.some((f) => draft[f.key] !== undefined)

  async function handleSave() {
    if (saving) return
    setSaving(true)
    try {
      const body: Record<string, string> = {}
      for (const f of TEXT_FIELDS) body[f.key] = value(f.key)
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as { data?: AppSettingsDto; error?: string }
      if (!res.ok || !json.data) throw new Error(json.error ?? 'Gagal menyimpan')
      toast({ title: 'Pengaturan tersimpan' })
      setDraft({})
      await queryClient.invalidateQueries({ queryKey: ['settings'] })
    } catch (err) {
      toast({ title: 'Gagal menyimpan', description: String(err), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  async function uploadImage(kind: 'logo' | 'favicon', file: File) {
    if (kind === 'logo' ? logoInputRef : faviconInputRef) {
      // reset nilai input agar file bernama sama bisa diunggah ulang
      const ref = kind === 'logo' ? logoInputRef : faviconInputRef
      if (ref.current) ref.current.value = ''
    }
    if (!file.type.startsWith('image/')) {
      toast({ title: 'File bukan gambar', description: 'Pilih file PNG/JPG/GIF/WebP/SVG/ICO.', variant: 'destructive' })
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: 'File terlalu besar', description: 'Ukuran maksimum 2 MB.', variant: 'destructive' })
      return
    }
    setUploading(kind)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/admin/settings/${kind}`, { method: 'POST', body: fd })
      const json = (await res.json()) as { data?: { logoUrl?: string; faviconUrl?: string }; error?: string }
      if (!res.ok || !json.data) throw new Error(json.error ?? 'Gagal mengunggah')
      toast({ title: kind === 'logo' ? 'Logo diperbarui' : 'Favicon diperbarui' })
      await queryClient.invalidateQueries({ queryKey: ['settings'] })
    } catch (err) {
      toast({ title: 'Gagal mengunggah', description: String(err), variant: 'destructive' })
    } finally {
      setUploading(null)
    }
  }

  async function removeImage(kind: 'logo' | 'favicon') {
    try {
      const res = await fetch(`/api/admin/settings/${kind}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Gagal menghapus')
      toast({ title: kind === 'logo' ? 'Logo kustom dihapus' : 'Favicon kustom dihapus' })
      await queryClient.invalidateQueries({ queryKey: ['settings'] })
    } catch (err) {
      toast({ title: 'Gagal menghapus', description: String(err), variant: 'destructive' })
    }
  }

  async function handleReset() {
    try {
      const res = await fetch('/api/admin/settings/reset', { method: 'POST' })
      if (!res.ok) throw new Error('Gagal mereset')
      toast({ title: 'Semua pengaturan dikembalikan ke bawaan' })
      setDraft({})
      await queryClient.invalidateQueries({ queryKey: ['settings'] })
    } catch (err) {
      toast({ title: 'Gagal mereset', description: String(err), variant: 'destructive' })
    }
  }

  return (
    <div>
      <h2 className="mb-4 text-base font-bold uppercase tracking-wide text-foreground">
        Pengaturan Aplikasi
      </h2>

      {/* Identitas aplikasi */}
      <section className="mb-5 rounded-lg border bg-card p-4 shadow-sm sm:p-5">
        <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-foreground/80">
          Identitas Aplikasi
        </h3>
        <p className="mb-4 text-xs text-muted-foreground">
          Ubah nama aplikasi, judul halaman, dan teks brand yang tampil di seluruh dashboard.
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {TEXT_FIELDS.map((f) => (
            <div key={f.key} className={f.textarea ? 'sm:col-span-2' : ''}>
              <Label htmlFor={`set-${f.key}`} className="mb-1.5 flex items-center justify-between">
                <span>{f.label}</span>
                <span className="text-[10px] font-normal text-muted-foreground">
                  {value(f.key).length}/{f.max}
                </span>
              </Label>
              {f.textarea ? (
                <Textarea
                  id={`set-${f.key}`}
                  value={value(f.key)}
                  placeholder={f.placeholder}
                  maxLength={f.max}
                  rows={2}
                  onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                />
              ) : (
                <Input
                  id={`set-${f.key}`}
                  value={value(f.key)}
                  placeholder={f.placeholder}
                  maxLength={f.max}
                  onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                />
              )}
              {f.hint && <p className="mt-1 text-[11px] text-muted-foreground">{f.hint}</p>}
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          {dirty && (
            <Button variant="ghost" size="sm" onClick={() => setDraft({})}>
              <RotateCcw className="h-4 w-4" aria-hidden="true" /> Batalkan Perubahan
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={saving || isLoading}
            size="sm"
            className="bg-[#17408b] text-white hover:bg-[#12326e]"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Menyimpan…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" aria-hidden="true" /> Simpan Pengaturan
              </>
            )}
          </Button>
        </div>
      </section>

      {/* Logo & Favicon */}
      <div className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
          <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-foreground/80">
            Logo Aplikasi
          </h3>
          <p className="mb-4 text-xs text-muted-foreground">
            Tampil di sidebar dan pita header. PNG/JPG/GIF/WebP/SVG/ICO, maks 2 MB.
          </p>
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border bg-muted/30 p-2">
              {isLoading ? (
                <Skeleton className="h-14 w-14" />
              ) : data?.logoUrl ? (
                <img src={data.logoUrl} alt="Logo aplikasi" className="h-16 w-16 object-contain" />
              ) : (
                <DkiEmblem className="h-14 w-14" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground">
                {data?.logoUrl ? 'Logo kustom aktif' : 'Menggunakan emblem bawaan'}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/*,.ico,.svg"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void uploadImage('logo', file)
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploading === 'logo'}
                >
                  {uploading === 'logo' ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Upload className="h-4 w-4" aria-hidden="true" />
                  )}
                  Unggah Logo
                </Button>
                {data?.logoUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeImage('logo')}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" /> Hapus
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
          <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-foreground/80">
            Favicon
          </h3>
          <p className="mb-4 text-xs text-muted-foreground">
            Ikon pada tab browser. Disarankan persegi (32×32 atau lebih), maks 2 MB.
          </p>
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border bg-muted/30 p-2">
              {isLoading ? (
                <Skeleton className="h-10 w-10" />
              ) : data?.faviconUrl ? (
                <img src={data.faviconUrl} alt="Favicon" className="h-10 w-10 object-contain" />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">
                  n/a
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground">
                {data?.faviconUrl ? 'Favicon kustom aktif' : 'Menggunakan favicon bawaan'}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  ref={faviconInputRef}
                  type="file"
                  accept="image/*,.ico,.svg"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void uploadImage('favicon', file)
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => faviconInputRef.current?.click()}
                  disabled={uploading === 'favicon'}
                >
                  {uploading === 'favicon' ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Upload className="h-4 w-4" aria-hidden="true" />
                  )}
                  Unggah Favicon
                </Button>
                {data?.faviconUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeImage('favicon')}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" /> Hapus
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Reset */}
      <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:p-5">
        <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-foreground/80">
          Kembalikan Semua ke Bawaan
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Menghapus seluruh pengaturan kustom (teks, logo, dan favicon) dan mengembalikan
          nilai bawaan aplikasi.
        </p>
        <Button variant="destructive" size="sm" onClick={() => setResetOpen(true)}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" /> Reset Semua Pengaturan
        </Button>
      </section>

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset semua pengaturan?</AlertDialogTitle>
            <AlertDialogDescription>
              Seluruh kustomisasi (nama, judul, teks brand, footer, logo, dan favicon) akan
              dikembalikan ke nilai bawaan. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset} className="bg-destructive text-white hover:bg-destructive/90">
              Ya, Reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
