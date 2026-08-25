'use client'

import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bot, Eye, EyeOff, Loader2, PlugZap, RotateCcw, Save, Trash2, Upload } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { DkiEmblem, GoldEmblem } from '@/components/dashboard/emblem'
import { COPILOT_PROVIDERS, findCopilotProvider } from '@/lib/copilot-providers'
import { DEFAULT_SETTINGS } from '@/lib/default-settings'
import type { AppSettingsDto, CopilotSettingsDto } from '@/types/budget'

type TextKey =
  | 'appName'
  | 'appTitle'
  | 'appDescription'
  | 'govName'
  | 'brandText'
  | 'brandSubtext'
  | 'footerText'

/** Pilihan warna header populer untuk pemerintahan daerah */
const PRESET_HEADER_COLORS = [
  '#17408b', // biru laut (bawaan)
  '#1d4ed8', // biru cerah
  '#0f766e', // teal
  '#15803d', // hijau
  '#b45309', // oranye keemasan
  '#b91c1c', // merah marun
  '#581c87', // ungu tua
  '#374151', // abu gelap
]

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
    key: 'govName',
    label: 'Nama Pemerintah Daerah',
    placeholder: 'Pemerintah Kabupaten Seruyan',
    max: 100,
    hint: 'Tampil sebagai sub-judul di seluruh halaman dashboard.',
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
  const [uploading, setUploading] = useState<'logo' | 'sidebar-logo' | 'emblem' | 'favicon' | null>(null)

  const logoInputRef = useRef<HTMLInputElement>(null)
  const sidebarLogoInputRef = useRef<HTMLInputElement>(null)
  const emblemInputRef = useRef<HTMLInputElement>(null)
  const faviconInputRef = useRef<HTMLInputElement>(null)

  // Draf warna header (hex); null = belum diubah (ikut data server)
  const [headerColorDraft, setHeaderColorDraft] = useState<string | null>(null)
  const headerColorValue = headerColorDraft ?? (data?.headerColor ?? '')

  // ---- AI Copilot: konfigurasi provider LLM ----
  const copilotQuery = useQuery({
    queryKey: ['copilot-settings'],
    queryFn: async (): Promise<CopilotSettingsDto> => {
      const res = await fetch('/api/admin/settings/copilot')
      if (!res.ok) throw new Error('Gagal memuat konfigurasi AI Copilot')
      const json = (await res.json()) as { data: CopilotSettingsDto }
      return json.data
    },
    staleTime: 30_000,
    retry: 1,
  })
  const [cpHydrated, setCpHydrated] = useState(false)
  const [cpProvider, setCpProvider] = useState('default')
  const [cpModel, setCpModel] = useState('')
  const [cpBase, setCpBase] = useState('')
  const [cpKey, setCpKey] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [cpSaving, setCpSaving] = useState(false)
  const [cpTesting, setCpTesting] = useState(false)
  const [cpTest, setCpTest] = useState<{ ok: boolean; message: string } | null>(null)
  const [cpClearOpen, setCpClearOpen] = useState(false)

  // Isi draf dari data server saat pertama dimuat
  useEffect(() => {
    if (copilotQuery.data && !cpHydrated) {
      setCpProvider(copilotQuery.data.provider)
      setCpModel(copilotQuery.data.model ?? '')
      setCpBase(copilotQuery.data.baseUrl ?? '')
      setCpHydrated(true)
    }
  }, [copilotQuery.data, cpHydrated])

  const cpProviderDef = findCopilotProvider(cpProvider) ?? COPILOT_PROVIDERS[0]
  const cpIsDefault = cpProviderDef.id === 'default'
  const cpKeyPlaceholder = copilotQuery.data?.hasApiKey
    ? `${copilotQuery.data.apiKeyMasked} — tersimpan (biarkan kosong untuk memakainya)`
    : cpProviderDef.keyHint || 'API Key'

  /** Ganti provider: praisi Base URL & contoh model dari registry. */
  function selectCpProvider(id: string) {
    setCpProvider(id)
    const p = findCopilotProvider(id)
    setCpBase(p?.baseUrl ?? '')
    setCpModel(p?.modelPlaceholder ?? '')
    setCpKey('')
    setCpTest(null)
  }

  async function saveCopilot() {
    setCpSaving(true)
    try {
      const res = await fetch('/api/admin/settings/copilot', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: cpProvider,
          ...(cpIsDefault
            ? {}
            : { baseUrl: cpBase, model: cpModel, ...(cpKey.trim() ? { apiKey: cpKey.trim() } : {}) }),
        }),
      })
      const json = (await res.json()) as { data?: CopilotSettingsDto; error?: string }
      if (!res.ok || !json.data) throw new Error(json.error ?? 'Gagal menyimpan')
      toast({ title: 'Konfigurasi AI Copilot tersimpan' })
      setCpKey('')
      setCpTest(null)
      await queryClient.invalidateQueries({ queryKey: ['copilot-settings'] })
    } catch (err) {
      toast({ title: 'Gagal menyimpan konfigurasi', description: String(err), variant: 'destructive' })
    } finally {
      setCpSaving(false)
    }
  }

  /** Uji koneksi memakai nilai draf (key kosong → pakai key tersimpan). */
  async function testCopilot() {
    setCpTesting(true)
    setCpTest(null)
    try {
      const res = await fetch('/api/admin/settings/copilot/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: cpProvider,
          ...(cpIsDefault
            ? {}
            : { baseUrl: cpBase, model: cpModel, ...(cpKey.trim() ? { apiKey: cpKey.trim() } : {}) }),
        }),
      })
      const json = (await res.json()) as {
        data?: { engine: string; reply: string; latencyMs: number }
        error?: string
      }
      if (!res.ok || !json.data) throw new Error(json.error ?? 'Gagal menguji koneksi')
      setCpTest({
        ok: true,
        message: `Berhasil terhubung ke ${json.data.engine} dalam ${json.data.latencyMs} ms — balasan: "${json.data.reply.slice(0, 80)}"`,
      })
    } catch (err) {
      setCpTest({ ok: false, message: String(err) })
    } finally {
      setCpTesting(false)
    }
  }

  async function clearCopilot() {
    setCpClearOpen(false)
    try {
      const res = await fetch('/api/admin/settings/copilot', { method: 'DELETE' })
      const json = (await res.json()) as { data?: CopilotSettingsDto; error?: string }
      if (!res.ok || !json.data) throw new Error(json.error ?? 'Gagal menghapus')
      toast({ title: 'AI Copilot kembali ke mesin bawaan (Z.ai)' })
      // reset draf lokal agar form langsung mencerminkan kondisi bawaan
      setCpKey('')
      setCpTest(null)
      setCpProvider('default')
      setCpModel('')
      setCpBase('')
      await queryClient.invalidateQueries({ queryKey: ['copilot-settings'] })
    } catch (err) {
      toast({ title: 'Gagal menghapus konfigurasi', description: String(err), variant: 'destructive' })
    }
  }


  // Simpan warna header lewat endpoint yang sama dengan teks
  async function saveHeaderColor(value: string) {
    const color = value.trim()
    if (color !== '' && !/^#[0-9a-fA-F]{6}$/.test(color)) {
      toast({ title: 'Warna tidak valid', description: 'Gunakan kode hex #rrggbb.', variant: 'destructive' })
      return
    }
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headerColor: color }),
      })
      const json = (await res.json()) as { data?: AppSettingsDto; error?: string }
      if (!res.ok || !json.data) throw new Error(json.error ?? 'Gagal menyimpan warna')
      setHeaderColorDraft(null)
      toast({ title: color ? 'Warna header diperbarui' : 'Warna header kembali ke gradien bawaan' })
      await queryClient.invalidateQueries({ queryKey: ['settings'] })
    } catch (err) {
      toast({ title: 'Gagal menyimpan warna', description: String(err), variant: 'destructive' })
    }
  }

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

  async function uploadImage(kind: 'logo' | 'sidebar-logo' | 'emblem' | 'favicon', file: File) {
    const ref =
      kind === 'logo'
        ? logoInputRef
        : kind === 'sidebar-logo'
          ? sidebarLogoInputRef
          : kind === 'emblem'
            ? emblemInputRef
            : faviconInputRef
    if (ref) {
      // reset nilai input agar file bernama sama bisa diunggah ulang
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
      const json = (await res.json()) as {
        data?: { logoUrl?: string; sidebarLogoUrl?: string; emblemUrl?: string; faviconUrl?: string }
        error?: string
      }
      if (!res.ok || !json.data) throw new Error(json.error ?? 'Gagal mengunggah')
      toast({
        title:
          kind === 'logo'
            ? 'Logo diperbarui'
            : kind === 'sidebar-logo'
              ? 'Logo pojok kiri diperbarui'
              : kind === 'emblem'
                ? 'Lencana pojok kanan diperbarui'
                : 'Favicon diperbarui',
      })
      await queryClient.invalidateQueries({ queryKey: ['settings'] })
    } catch (err) {
      toast({ title: 'Gagal mengunggah', description: String(err), variant: 'destructive' })
    } finally {
      setUploading(null)
    }
  }

  async function removeImage(kind: 'logo' | 'sidebar-logo' | 'emblem' | 'favicon') {
    try {
      const res = await fetch(`/api/admin/settings/${kind}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Gagal menghapus')
      toast({
        title:
          kind === 'logo'
            ? 'Logo kustom dihapus'
            : kind === 'sidebar-logo'
              ? 'Logo pojok kiri kembali mengikuti Logo Aplikasi'
              : kind === 'emblem'
                ? 'Lencana pojok kanan kembali ke emblem emas bawaan'
                : 'Favicon kustom dihapus',
      })
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
      <div className="mb-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
          <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-foreground/80">
            Logo Aplikasi
          </h3>
          <p className="mb-4 text-xs text-muted-foreground">
            Tampil di pita header (dan jadi fallback logo pojok kiri sidebar).
            PNG/JPG/GIF/WebP/SVG/ICO, maks 2 MB.
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
            Logo Pojok Kiri (Sidebar)
          </h3>
          <p className="mb-4 text-xs text-muted-foreground">
            Logo kecil di pojok kiri atas aplikasi. Bila kosong, mengikuti Logo Aplikasi.
            PNG/JPG/GIF/WebP/SVG/ICO, maks 2 MB.
          </p>
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border bg-[#1b2a4a] p-2">
              {isLoading ? (
                <Skeleton className="h-12 w-12" />
              ) : data?.sidebarLogoUrl || data?.logoUrl ? (
                <img
                  src={data.sidebarLogoUrl ?? data.logoUrl ?? undefined}
                  alt="Logo pojok kiri"
                  className="h-14 w-14 rounded object-contain"
                />
              ) : (
                <DkiEmblem className="h-12 w-12" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground">
                {data?.sidebarLogoUrl
                  ? 'Logo pojok kiri kustom aktif'
                  : data?.logoUrl
                    ? 'Mengikuti Logo Aplikasi'
                    : 'Menggunakan emblem bawaan'}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  ref={sidebarLogoInputRef}
                  type="file"
                  accept="image/*,.ico,.svg"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void uploadImage('sidebar-logo', file)
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => sidebarLogoInputRef.current?.click()}
                  disabled={uploading === 'sidebar-logo'}
                >
                  {uploading === 'sidebar-logo' ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Upload className="h-4 w-4" aria-hidden="true" />
                  )}
                  Unggah Logo Pojok Kiri
                </Button>
                {data?.sidebarLogoUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeImage('sidebar-logo')}
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
            Logo Pojok Kanan (Lencana)
          </h3>
          <p className="mb-4 text-xs text-muted-foreground">
            Logo/lencana di pojok kanan pita header. Bila kosong, memakai emblem emas bawaan.
            PNG/JPG/GIF/WebP/SVG/ICO, maks 2 MB.
          </p>
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg border bg-gradient-to-r from-[#17408b] to-[#1d4ed8] p-2">
              {isLoading ? (
                <Skeleton className="h-14 w-14" />
              ) : data?.emblemUrl ? (
                <img src={data.emblemUrl} alt="Lencana aplikasi" className="h-16 w-16 object-contain" />
              ) : (
                <GoldEmblem className="h-16 w-16" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground">
                {data?.emblemUrl ? 'Lencana kustom aktif' : 'Menggunakan emblem emas bawaan'}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  ref={emblemInputRef}
                  type="file"
                  accept="image/*,.ico,.svg"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) void uploadImage('emblem', file)
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => emblemInputRef.current?.click()}
                  disabled={uploading === 'emblem'}
                >
                  {uploading === 'emblem' ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Upload className="h-4 w-4" aria-hidden="true" />
                  )}
                  Unggah Lencana
                </Button>
                {data?.emblemUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => removeImage('emblem')}
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
            Warna Header
          </h3>
          <p className="mb-4 text-xs text-muted-foreground">
            Warna latar pita header atas. Bila kosong, memakai gradien biru bawaan.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {(PRESET_HEADER_COLORS).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => void saveHeaderColor(c)}
                aria-label={`Pakai warna ${c}`}
                title={c}
                className={`h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 ${
                  headerColorValue.toLowerCase() === c ? 'border-foreground' : 'border-border'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
            <div className="ml-1 flex items-center gap-2">
              <input
                type="color"
                aria-label="Pilih warna kustom"
                value={headerColorValue || '#17408b'}
                onChange={(e) => setHeaderColorDraft(e.target.value)}
                className="h-8 w-10 cursor-pointer rounded border border-input bg-background p-0.5"
              />
              <Input
                value={headerColorValue}
                onChange={(e) => setHeaderColorDraft(e.target.value)}
                placeholder="#17408b"
                className="h-8 w-28 font-mono text-xs"
                aria-label="Kode hex warna header"
              />
              <Button
                size="sm"
                onClick={() => void saveHeaderColor(headerColorDraft ?? headerColorValue)}
                disabled={headerColorDraft === null || headerColorDraft === (data?.headerColor ?? '')}
                className="h-8 bg-[#17408b] text-white hover:bg-[#12326e]"
              >
                Terapkan
              </Button>
            </div>
          </div>
          {(data?.headerColor || headerColorDraft) && (
            <div className="mt-3 flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void saveHeaderColor('')}
                className="text-muted-foreground"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> Kembalikan Gradien Bawaan
              </Button>
              <span className="text-[11px] text-muted-foreground">
                Aktif: <span className="font-mono font-semibold">{headerColorValue}</span>
              </span>
            </div>
          )}
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

      {/* AI Copilot — Provider LLM */}
      <section className="mb-5 rounded-lg border bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wide text-foreground/80">
            AI Copilot — Provider LLM
          </h3>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#17408b]/20 bg-[#17408b]/5 px-2.5 py-0.5 text-[11px] font-semibold text-[#17408b]">
            <Bot className="h-3 w-3" aria-hidden="true" />
            {copilotQuery.data?.providerLabel ?? 'Bawaan (Z.ai)'}
          </span>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Hubungkan AI Copilot dengan penyedia LLM pilihan Anda — semua provider populer
          didukung melalui protokol OpenAI-Compatible. Tanpa konfigurasi, Copilot memakai
          mesin bawaan (Z.ai).
        </p>

        {copilotQuery.isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Provider */}
            <div className="space-y-1.5">
              <Label>Provider</Label>
              <Select value={cpProvider} onValueChange={selectCpProvider}>
                <SelectTrigger aria-label="Pilih provider LLM">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COPILOT_PROVIDERS.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">{cpProviderDef.hint}</p>
            </div>

            {/* Model */}
            <div className="space-y-1.5">
              <Label htmlFor="cp-model">Model</Label>
              <Input
                id="cp-model"
                value={cpModel}
                onChange={(e) => setCpModel(e.target.value)}
                placeholder={cpProviderDef.modelPlaceholder ?? 'mis. gpt-4o-mini'}
                disabled={cpIsDefault}
                maxLength={120}
                autoComplete="off"
              />
              <p className="text-[11px] text-muted-foreground">
                {cpIsDefault
                  ? 'Mesin bawaan memilih model otomatis.'
                  : 'Nama model persis seperti tercantum di dokumentasi provider.'}
              </p>
            </div>

            {/* API Key */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cp-key">API Key</Label>
              <div className="relative">
                <Input
                  id="cp-key"
                  type={showKey ? 'text' : 'password'}
                  value={cpKey}
                  onChange={(e) => setCpKey(e.target.value)}
                  placeholder={cpKeyPlaceholder}
                  disabled={cpIsDefault}
                  maxLength={500}
                  autoComplete="new-password"
                  className="pr-10 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  aria-label={showKey ? 'Sembunyikan API key' : 'Tampilkan API key'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {cpIsDefault
                  ? 'Mesin bawaan tidak memerlukan API key.'
                  : copilotQuery.data?.hasApiKey
                    ? 'Key tersimpan aman — biarkan kosong bila tidak ingin mengganti.'
                    : `${cpProviderDef.requiresKey ? 'Wajib diisi. ' : 'Opsional. '}${cpProviderDef.keyHint}. Disimpan di database server aplikasi.`}
              </p>
            </div>

            {/* Base URL */}
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cp-base">Base URL</Label>
              <Input
                id="cp-base"
                value={cpBase}
                onChange={(e) => setCpBase(e.target.value)}
                placeholder={cpProviderDef.baseUrl || 'https://provider-anda.example/v1'}
                disabled={cpIsDefault}
                maxLength={300}
                autoComplete="off"
                className="font-mono text-xs"
              />
              <p className="text-[11px] text-muted-foreground">
                Endpoint OpenAI-Compatible (…/chat/completions ditambahkan otomatis).
                Biarkan sesuai default provider kecuali Anda memakai proxy/kustom.
              </p>
            </div>
          </div>
        )}

        {/* Aksi */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={testCopilot}
            disabled={cpTesting || copilotQuery.isLoading || (!cpIsDefault && !cpModel.trim())}
          >
            {cpTesting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Menguji…
              </>
            ) : (
              <>
                <PlugZap className="h-4 w-4" aria-hidden="true" /> Uji Koneksi
              </>
            )}
          </Button>
          <Button
            onClick={saveCopilot}
            disabled={cpSaving || copilotQuery.isLoading || (!cpIsDefault && !cpModel.trim())}
            size="sm"
            className="bg-[#17408b] text-white hover:bg-[#12326e]"
          >
            {cpSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Menyimpan…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" aria-hidden="true" /> Simpan Konfigurasi
              </>
            )}
          </Button>
          {copilotQuery.data?.provider !== 'default' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCpClearOpen(true)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" /> Kembalikan ke Bawaan
            </Button>
          )}
        </div>

        {/* Hasil uji koneksi */}
        {cpTest && (
          <p
            role="status"
            className={`mt-3 rounded-md border p-3 text-xs ${
              cpTest.ok
                ? 'border-green-300 bg-green-50 text-green-800'
                : 'border-red-300 bg-red-50 text-red-700'
            }`}
          >
            {cpTest.message}
          </p>
        )}

        <AlertDialog open={cpClearOpen} onOpenChange={setCpClearOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Kembalikan AI Copilot ke mesin bawaan?</AlertDialogTitle>
              <AlertDialogDescription>
                Konfigurasi provider, model, dan API key akan dihapus. Copilot kembali
                memakai mesin bawaan Z.ai.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={clearCopilot} className="bg-destructive text-white hover:bg-destructive/90">
                Ya, Kembalikan
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>

      {/* Reset */}
      <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:p-5">
        <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-foreground/80">
          Kembalikan Semua ke Bawaan
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Menghapus seluruh pengaturan tampilan kustom (teks, logo, dan favicon) dan
          mengembalikan nilai bawaan aplikasi. Konfigurasi AI Copilot (provider &amp; API key)
          tidak ikut ter-reset.
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
              Seluruh kustomisasi tampilan (nama, judul, teks brand, footer, logo, dan favicon)
              akan dikembalikan ke nilai bawaan. Konfigurasi AI Copilot dipertahankan.
              Tindakan ini tidak dapat dibatalkan.
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
