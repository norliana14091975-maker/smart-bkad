'use client'

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Bot,
  Building2,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Flag,
  Loader2,
  PlugZap,
  Save,
  ShieldAlert,
  ShieldCheck,
  Wand2,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useSettings } from '@/hooks/use-settings'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Textarea } from '@/components/ui/textarea'
import { COPILOT_PROVIDERS, findCopilotProvider } from '@/lib/copilot-providers'
import { formatDateID } from '@/lib/format'
import type { AppSettingsDto, CopilotSettingsDto, SetupWizardStatusDto } from '@/types/budget'

/**
 * Setup Wizard — dialog panduan konfigurasi awal aplikasi (khusus admin).
 * 5 langkah: Pengantar → Identitas → Keamanan Akun → AI Copilot → Selesai.
 * Setiap langkah bersifat opsional; admin dapat melanjutkan tanpa menyimpan.
 */

const STEPS = [
  { id: 'welcome', label: 'Pengantar', icon: Wand2 },
  { id: 'identity', label: 'Identitas', icon: Building2 },
  { id: 'security', label: 'Keamanan', icon: ShieldCheck },
  { id: 'copilot', label: 'AI Copilot', icon: Bot },
  { id: 'finish', label: 'Selesai', icon: Flag },
] as const

/** Kolom identitas yang dapat diubah lewat wizard (subset Pengaturan Aplikasi). */
const IDENTITY_FIELDS = [
  {
    key: 'appTitle' as const,
    label: 'Judul Dashboard',
    placeholder: 'Dashboard Keuangan Kab. …',
    max: 100,
  },
  {
    key: 'govName' as const,
    label: 'Nama Pemerintah Daerah',
    placeholder: 'Pemerintah Kabupaten …',
    max: 100,
  },
  {
    key: 'brandText' as const,
    label: 'Teks Brand Header',
    placeholder: 'PEMDA',
    max: 30,
  },
  {
    key: 'brandSubtext' as const,
    label: 'Sub-teks Brand',
    placeholder: 'Kabupaten …',
    max: 60,
  },
  {
    key: 'footerText' as const,
    label: 'Teks Footer',
    placeholder: 'Dashboard Monitoring Pengelolaan Keuangan Daerah — …',
    max: 200,
    textarea: true,
  },
]

/** Hook status Setup Wizard (dipakai bersama oleh wizard & kartu di Pengaturan). */
export function useSetupWizardStatus(enabled = true) {
  return useQuery({
    queryKey: ['setup-wizard-status'],
    enabled,
    queryFn: async (): Promise<SetupWizardStatusDto> => {
      const res = await fetch('/api/admin/setup-wizard')
      if (!res.ok) throw new Error('Gagal memuat status Setup Wizard')
      const json = (await res.json()) as { data: SetupWizardStatusDto }
      return json.data
    },
    retry: 1,
  })
}

interface SetupWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SetupWizard({ open, onOpenChange }: SetupWizardProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const settingsQuery = useSettings()
  const statusQuery = useSetupWizardStatus(open)

  const [step, setStep] = useState(0)

  // ---- Langkah identitas: draf > nilai server ----
  const [idDraft, setIdDraft] = useState<Partial<Record<(typeof IDENTITY_FIELDS)[number]['key'], string>>>({})
  const [idSaving, setIdSaving] = useState(false)

  const identityValue = (key: (typeof IDENTITY_FIELDS)[number]['key']): string => {
    if (idDraft[key] !== undefined) return idDraft[key]
    const current = settingsQuery.data?.[key]
    return typeof current === 'string' ? current : ''
  }

  // ---- Langkah keamanan: ganti password akun sendiri ----
  const [pwCurrent, setPwCurrent] = useState('')
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const [pwDone, setPwDone] = useState(false)
  const [pwError, setPwError] = useState<string | null>(null)

  // ---- Langkah AI Copilot: draf konfigurasi provider ----
  const copilotQuery = useQuery({
    queryKey: ['copilot-settings'],
    enabled: open,
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
  const [cpSaving, setCpSaving] = useState(false)
  const [cpTesting, setCpTesting] = useState(false)
  const [cpTest, setCpTest] = useState<{ ok: boolean; message: string } | null>(null)

  const [finishing, setFinishing] = useState(false)

  // Reset wizard saat dibuka ulang; bersihkan data sensitif saat ditutup
  useEffect(() => {
    if (open) {
      setStep(0)
    } else {
      setPwCurrent('')
      setPwNew('')
      setPwConfirm('')
      setPwDone(false)
      setPwError(null)
      setCpTest(null)
      setFinishing(false)
    }
  }, [open])

  // Isi draf copilot dari data server saat pertama dimuat
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

  const status = statusQuery.data
  const checks = status?.checks

  /** Perbarui status wizard (checklist langkah pengantar & selesai). */
  async function refreshStatus() {
    await queryClient.invalidateQueries({ queryKey: ['setup-wizard-status'] })
  }

  /** Ganti provider: praisi Base URL & contoh model dari registry. */
  function selectCpProvider(id: string) {
    setCpProvider(id)
    const p = findCopilotProvider(id)
    setCpBase(p?.baseUrl ?? '')
    setCpModel(p?.modelPlaceholder ?? '')
    setCpKey('')
    setCpTest(null)
  }

  /** Simpan identitas dashboard, lalu lanjut ke langkah berikutnya. */
  async function saveIdentity() {
    if (idSaving) return
    if (!identityValue('appTitle').trim() || !identityValue('govName').trim()) {
      toast({
        title: 'Lengkapi identitas',
        description: 'Judul Dashboard dan Nama Pemerintah Daerah wajib diisi.',
        variant: 'destructive',
      })
      return
    }
    setIdSaving(true)
    try {
      const body: Record<string, string> = {}
      for (const f of IDENTITY_FIELDS) body[f.key] = identityValue(f.key)
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as { data?: AppSettingsDto; error?: string }
      if (!res.ok || !json.data) throw new Error(json.error ?? 'Gagal menyimpan')
      toast({ title: 'Identitas dashboard tersimpan' })
      setIdDraft({})
      await queryClient.invalidateQueries({ queryKey: ['settings'] })
      await refreshStatus()
      setStep(2)
    } catch (err) {
      toast({ title: 'Gagal menyimpan identitas', description: String(err), variant: 'destructive' })
    } finally {
      setIdSaving(false)
    }
  }

  /** Ganti password akun sendiri, lalu lanjut ke langkah berikutnya. */
  async function changePassword() {
    if (pwSaving) return
    setPwError(null)
    if (!pwCurrent || !pwNew || !pwConfirm) {
      setPwError('Semua kolom password wajib diisi (atau kosongkan semua untuk melewati).')
      return
    }
    if (pwNew.length < 8) {
      setPwError('Password baru minimal 8 karakter.')
      return
    }
    if (pwNew !== pwConfirm) {
      setPwError('Konfirmasi password tidak sama dengan password baru.')
      return
    }
    if (pwNew === pwCurrent) {
      setPwError('Password baru harus berbeda dari password saat ini.')
      return
    }
    setPwSaving(true)
    try {
      const res = await fetch('/api/admin/users/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
      })
      const json = (await res.json()) as { data?: { username: string }; error?: string }
      if (!res.ok || !json.data) throw new Error(json.error ?? 'Gagal mengganti password')
      toast({ title: 'Password berhasil diganti' })
      setPwDone(true)
      setPwCurrent('')
      setPwNew('')
      setPwConfirm('')
      await refreshStatus()
      setStep(3)
    } catch (err) {
      setPwError(String(err))
    } finally {
      setPwSaving(false)
    }
  }

  /** Simpan konfigurasi AI Copilot, lalu lanjut ke langkah selesai. */
  async function saveCopilot() {
    if (cpSaving) return
    if (cpIsDefault) {
      setStep(4)
      return
    }
    if (!cpModel.trim()) {
      toast({ title: 'Nama model wajib diisi', variant: 'destructive' })
      return
    }
    setCpSaving(true)
    try {
      const res = await fetch('/api/admin/settings/copilot', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: cpProvider,
          baseUrl: cpBase,
          model: cpModel,
          ...(cpKey.trim() ? { apiKey: cpKey.trim() } : {}),
        }),
      })
      const json = (await res.json()) as { data?: CopilotSettingsDto; error?: string }
      if (!res.ok || !json.data) throw new Error(json.error ?? 'Gagal menyimpan')
      toast({ title: 'Konfigurasi AI Copilot tersimpan' })
      setCpKey('')
      setCpTest(null)
      await queryClient.invalidateQueries({ queryKey: ['copilot-settings'] })
      await refreshStatus()
      setStep(4)
    } catch (err) {
      toast({ title: 'Gagal menyimpan konfigurasi', description: String(err), variant: 'destructive' })
    } finally {
      setCpSaving(false)
    }
  }

  /** Uji koneksi AI Copilot memakai nilai draf (key kosong → pakai tersimpan). */
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

  /** Tandai setup selesai dan tutup wizard. */
  async function finishSetup() {
    if (finishing) return
    setFinishing(true)
    try {
      const res = await fetch('/api/admin/setup-wizard', { method: 'POST' })
      const json = (await res.json()) as { data?: SetupWizardStatusDto; error?: string }
      if (!res.ok || !json.data) throw new Error(json.error ?? 'Gagal menandai setup selesai')
      toast({ title: 'Setup selesai — dashboard siap digunakan' })
      await refreshStatus()
      onOpenChange(false)
    } catch (err) {
      toast({ title: 'Gagal menandai setup selesai', description: String(err), variant: 'destructive' })
    } finally {
      setFinishing(false)
    }
  }

  /** Pergi ke langkah tertentu; refresh status saat memasuki langkah Selesai. */
  async function goTo(next: number) {
    setStep(next)
    if (next === 4) await refreshStatus()
  }

  const pwFormActive = !!(pwCurrent || pwNew || pwConfirm)

  // ---- Aksi utama per langkah ----
  let primaryAction: { label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean; loading?: boolean }
  let secondaryAction: { label: string; onClick: () => void } | null = null

  if (step === 0) {
    primaryAction = { label: 'Mulai Konfigurasi', icon: <Wand2 className="h-4 w-4" aria-hidden="true" />, onClick: () => goTo(1) }
  } else if (step === 1) {
    primaryAction = {
      label: 'Simpan & Lanjut',
      icon: idSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />,
      onClick: saveIdentity,
      disabled: idSaving || settingsQuery.isLoading,
    }
    secondaryAction = { label: 'Lewati', onClick: () => goTo(2) }
  } else if (step === 2) {
    primaryAction = {
      label: pwFormActive ? 'Ganti Password & Lanjut' : 'Lanjut',
      icon: pwSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4" aria-hidden="true" />,
      onClick: pwFormActive ? changePassword : () => goTo(3),
      disabled: pwSaving,
    }
  } else if (step === 3) {
    primaryAction = {
      label: cpIsDefault ? 'Lanjut' : 'Simpan & Lanjut',
      icon: cpSaving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Bot className="h-4 w-4" aria-hidden="true" />,
      onClick: saveCopilot,
      disabled: cpSaving || (!cpIsDefault && !cpModel.trim()),
    }
    if (!cpIsDefault) secondaryAction = { label: 'Lewati', onClick: () => goTo(4) }
  } else {
    primaryAction = {
      label: 'Selesaikan Setup',
      icon: finishing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
      onClick: finishSetup,
      disabled: finishing,
    }
    secondaryAction = { label: 'Tutup tanpa menandai selesai', onClick: () => onOpenChange(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] w-full max-w-[min(42rem,calc(100%-2rem))] flex-col gap-0 overflow-hidden p-0 [&_[data-slot=dialog-close]]:rounded-md [&_[data-slot=dialog-close]]:text-white/80 [&_[data-slot=dialog-close]]:transition-colors [&_[data-slot=dialog-close]]:hover:bg-white/10 [&_[data-slot=dialog-close]]:hover:text-white">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#17408b] to-[#12326e] px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-white">
            <Wand2 className="h-5 w-5" aria-hidden="true" />
            Setup Wizard — Konfigurasi Dashboard
          </DialogTitle>
          <DialogDescription className="mt-1 text-xs text-white/80">
            Panduan berlangkah untuk menyiapkan identitas, keamanan, dan AI Copilot
            dashboard keuangan daerah Anda.
          </DialogDescription>
        </div>

        {/* Stepper */}
        <nav aria-label="Progres langkah setup" className="border-b bg-muted/30 px-5 py-3">
          <ol className="flex w-full items-start">
            {STEPS.map((s, i) => {
              const done = i < step
              const current = i === step
              return (
                <li key={s.id} className="flex min-w-0 flex-1 flex-col items-center">
                  <div className="flex w-full items-center">
                    <span
                      aria-hidden="true"
                      className={`h-0.5 flex-1 rounded-full ${i === 0 ? 'invisible' : done || current ? 'bg-[#17408b]' : 'bg-border'}`}
                    />
                    <span
                      aria-current={current ? 'step' : undefined}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                        done
                          ? 'border-emerald-600 bg-emerald-600 text-white'
                          : current
                            ? 'border-[#17408b] bg-[#17408b] text-white'
                            : 'border-border bg-background text-muted-foreground'
                      }`}
                    >
                      {done ? (
                        <Check className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <s.icon className="h-4 w-4" aria-hidden="true" />
                      )}
                    </span>
                    <span
                      aria-hidden="true"
                      className={`h-0.5 flex-1 rounded-full ${i === STEPS.length - 1 ? 'invisible' : done ? 'bg-[#17408b]' : 'bg-border'}`}
                    />
                  </div>
                  <span
                    className={`mt-1 hidden whitespace-nowrap text-[10px] font-semibold sm:block ${
                      current ? 'text-[#17408b]' : done ? 'text-emerald-700' : 'text-muted-foreground'
                    }`}
                  >
                    {s.label}
                  </span>
                </li>
              )
            })}
          </ol>
        </nav>

        {/* Isi langkah */}
        <div className="nice-scrollbar min-h-[16rem] flex-1 overflow-y-auto px-5 py-5">
          {/* ===== Langkah 0: Pengantar ===== */}
          {step === 0 && (
            <div>
              <div className="mb-4 flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#17408b]/10 text-[#17408b]">
                  <Wand2 className="h-6 w-6" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Selamat datang di Setup Wizard</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Wizard ini membantu menyiapkan hal-hal penting sebelum dashboard
                    dipakai sepenuhnya. Semua langkah bersifat opsional dan dapat
                    diubah lagi nanti lewat menu Pengaturan.
                  </p>
                </div>
              </div>

              {statusQuery.isLoading ? (
                <div className="space-y-2" aria-label="Memuat status">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : (
                <ul className="space-y-2" aria-label="Status konfigurasi saat ini">
                  <StatusRow
                    icon={checks?.identityConfigured ? <CheckCircle2 className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
                    tone={checks?.identityConfigured ? 'ok' : 'muted'}
                    label="Identitas Dashboard"
                    desc={
                      checks?.identityConfigured
                        ? `Judul & nama pemda sudah dikustomisasi: “${settingsQuery.data?.appTitle ?? '—'}”`
                        : 'Masih memakai nilai bawaan — akan diatur pada langkah berikutnya.'
                    }
                  />
                  <StatusRow
                    icon={checks?.passwordDefault ? <ShieldAlert className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                    tone={checks?.passwordDefault ? 'warn' : 'ok'}
                    label="Keamanan Akun Admin"
                    desc={
                      checks?.passwordDefault
                        ? `Akun ${status?.username ?? 'admin'} masih memakai password bawaan (admin123) — sangat disarankan diganti.`
                        : `Password akun ${status?.username ?? 'admin'} sudah diganti dari bawaan.`
                    }
                  />
                  <StatusRow
                    icon={<Bot className="h-5 w-5" />}
                    tone={checks?.copilotConfigured ? 'ok' : 'muted'}
                    label="AI Copilot"
                    badge="Opsional"
                    desc={
                      checks?.copilotConfigured
                        ? 'Provider kustom aktif — Copilot memakai penyedia LLM pilihan Anda.'
                        : 'Mesin bawaan Z.ai aktif tanpa konfigurasi — dapat diganti ke provider mana pun.'
                    }
                  />
                </ul>
              )}

              {status?.completed && status.completedAt && (
                <p className="mt-4 rounded-md border border-[#17408b]/20 bg-[#17408b]/5 p-3 text-xs text-[#17408b]">
                  Setup sebelumnya ditandai selesai pada {formatDateID(new Date(status.completedAt))}.
                  Anda dapat menjalankan wizard ini kembali kapan saja.
                </p>
              )}
            </div>
          )}

          {/* ===== Langkah 1: Identitas ===== */}
          {step === 1 && (
            <div>
              <h3 className="text-sm font-bold text-foreground">Identitas Dashboard</h3>
              <p className="mb-4 mt-0.5 text-xs text-muted-foreground">
                Atur identitas dasar yang tampil di seluruh halaman. Logo, favicon, dan
                warna header dapat diatur kemudian lewat menu Pengaturan Aplikasi.
              </p>
              {settingsQuery.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {IDENTITY_FIELDS.map((f) => (
                    <div key={f.key} className={f.textarea ? 'sm:col-span-2' : ''}>
                      <Label htmlFor={`wiz-${f.key}`} className="mb-1.5 flex items-center justify-between">
                        <span>{f.label}</span>
                        <span className="text-[10px] font-normal text-muted-foreground">
                          {identityValue(f.key).length}/{f.max}
                        </span>
                      </Label>
                      {f.textarea ? (
                        <Textarea
                          id={`wiz-${f.key}`}
                          value={identityValue(f.key)}
                          placeholder={f.placeholder}
                          maxLength={f.max}
                          rows={2}
                          onChange={(e) => setIdDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                        />
                      ) : (
                        <Input
                          id={`wiz-${f.key}`}
                          value={identityValue(f.key)}
                          placeholder={f.placeholder}
                          maxLength={f.max}
                          onChange={(e) => setIdDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===== Langkah 2: Keamanan ===== */}
          {step === 2 && (
            <div>
              <h3 className="text-sm font-bold text-foreground">Keamanan Akun Admin</h3>
              <p className="mb-4 mt-0.5 text-xs text-muted-foreground">
                Password bawaan bersifat publik dan tidak aman untuk penggunaan nyata.
                Ganti password akun <span className="font-semibold">{status?.username ?? 'admin'}</span> sekarang,
                atau kosongkan semua kolom untuk melanjutkan tanpa mengganti.
              </p>

              {checks?.passwordDefault ? (
                <p role="alert" className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                  <ShieldAlert className="mr-1 inline h-4 w-4 align-text-bottom" aria-hidden="true" />
                  Akun ini masih memakai password bawaan <span className="font-mono font-bold">admin123</span> —
                  sangat disarankan diganti sekarang.
                </p>
              ) : (
                <p className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-800">
                  <ShieldCheck className="mr-1 inline h-4 w-4 align-text-bottom" aria-hidden="true" />
                  Password akun ini sudah diganti dari bawaan. Anda tetap dapat menggantinya lagi bila perlu.
                </p>
              )}

              {pwDone && (
                <p role="status" className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-800">
                  <CheckCircle2 className="mr-1 inline h-4 w-4 align-text-bottom" aria-hidden="true" />
                  Password berhasil diganti. Sesi lain (bila ada) telah dikeluarkan.
                </p>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="wiz-pw-current" className="mb-1.5">
                    Password Saat Ini
                  </Label>
                  <Input
                    id="wiz-pw-current"
                    type={showPw ? 'text' : 'password'}
                    value={pwCurrent}
                    onChange={(e) => setPwCurrent(e.target.value)}
                    placeholder="Password saat ini"
                    autoComplete="current-password"
                  />
                </div>
                <div>
                  <Label htmlFor="wiz-pw-new" className="mb-1.5">
                    Password Baru
                  </Label>
                  <Input
                    id="wiz-pw-new"
                    type={showPw ? 'text' : 'password'}
                    value={pwNew}
                    onChange={(e) => setPwNew(e.target.value)}
                    placeholder="Minimal 8 karakter"
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <Label htmlFor="wiz-pw-confirm" className="mb-1.5">
                    Konfirmasi Password Baru
                  </Label>
                  <Input
                    id="wiz-pw-confirm"
                    type={showPw ? 'text' : 'password'}
                    value={pwConfirm}
                    onChange={(e) => setPwConfirm(e.target.value)}
                    placeholder="Ulangi password baru"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowPw((v) => !v)}
                className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
              >
                {showPw ? (
                  <>
                    <EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> Sembunyikan password
                  </>
                ) : (
                  <>
                    <Eye className="h-3.5 w-3.5" aria-hidden="true" /> Tampilkan password
                  </>
                )}
              </button>

              {pwError && (
                <p role="alert" className="mt-3 rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-700">
                  {pwError}
                </p>
              )}
            </div>
          )}

          {/* ===== Langkah 3: AI Copilot ===== */}
          {step === 3 && (
            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-foreground">AI Copilot — Provider LLM</h3>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#17408b]/20 bg-[#17408b]/5 px-2.5 py-0.5 text-[11px] font-semibold text-[#17408b]">
                  <Bot className="h-3 w-3" aria-hidden="true" />
                  {copilotQuery.data?.providerLabel ?? 'Bawaan (Z.ai)'}
                </span>
              </div>
              <p className="mb-4 mt-0.5 text-xs text-muted-foreground">
                AI Copilot sudah siap dipakai dengan mesin bawaan Z.ai. Untuk memakai
                provider sendiri (OpenAI, Claude, Gemini, Groq, DeepSeek, dll.), pilih
                provider dan isi kredensial — semua provider didukung lewat protokol
                OpenAI-Compatible.
              </p>

              {copilotQuery.isLoading ? (
                <Skeleton className="h-32 w-full" />
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

                  <div className="space-y-1.5">
                    <Label htmlFor="wiz-cp-model">Model</Label>
                    <Input
                      id="wiz-cp-model"
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
                        : 'Nama model persis seperti di dokumentasi provider.'}
                    </p>
                  </div>

                  <div className="relative space-y-1.5 sm:col-span-2">
                    <Label htmlFor="wiz-cp-key">API Key</Label>
                    <Input
                      id="wiz-cp-key"
                      type="password"
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
                      onClick={() => setShowPw((v) => !v)}
                      aria-label={showPw ? 'Sembunyikan API key' : 'Tampilkan API key'}
                      className="absolute right-2 top-[30px] rounded p-1 text-muted-foreground hover:text-foreground"
                    >
                      {showPw ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                    <p className="text-[11px] text-muted-foreground">
                      {cpIsDefault
                        ? 'Mesin bawaan tidak memerlukan API key.'
                        : copilotQuery.data?.hasApiKey
                          ? 'Key tersimpan aman — biarkan kosong bila tidak ingin mengganti.'
                          : `${cpProviderDef.requiresKey ? 'Wajib diisi. ' : 'Opsional. '}${cpProviderDef.keyHint}.`}
                    </p>
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="wiz-cp-base">Base URL</Label>
                    <Input
                      id="wiz-cp-base"
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
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
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
              </div>

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
            </div>
          )}

          {/* ===== Langkah 4: Selesai ===== */}
          {step === 4 && (
            <div>
              <div className="mb-4 flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Konfigurasi Selesai</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Berikut ringkasan konfigurasi dashboard Anda. Anda tetap dapat
                    mengubah semuanya nanti lewat menu Pengaturan Aplikasi.
                  </p>
                </div>
              </div>

              {statusQuery.isFetching && !status ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : (
                <ul className="space-y-2" aria-label="Ringkasan konfigurasi">
                  <StatusRow
                    icon={checks?.identityConfigured ? <CheckCircle2 className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
                    tone={checks?.identityConfigured ? 'ok' : 'warn'}
                    label="Identitas Dashboard"
                    desc={
                      checks?.identityConfigured
                        ? `${settingsQuery.data?.appTitle ?? '—'} · ${settingsQuery.data?.govName ?? '—'}`
                        : 'Masih nilai bawaan — ubah lewat Pengaturan Aplikasi.'
                    }
                  />
                  <StatusRow
                    icon={checks?.passwordDefault ? <ShieldAlert className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
                    tone={checks?.passwordDefault ? 'warn' : 'ok'}
                    label="Keamanan Akun Admin"
                    desc={
                      checks?.passwordDefault
                        ? 'Masih memakai password bawaan admin123 — segera ganti lewat langkah Keamanan.'
                        : `Password akun ${status?.username ?? 'admin'} sudah diganti dari bawaan.`
                    }
                  />
                  <StatusRow
                    icon={<Bot className="h-5 w-5" />}
                    tone={checks?.copilotConfigured ? 'ok' : 'muted'}
                    label="AI Copilot"
                    badge="Opsional"
                    desc={
                      checks?.copilotConfigured
                        ? `Provider kustom: ${copilotQuery.data?.providerLabel ?? '—'}`
                        : 'Mesin bawaan Z.ai aktif — berfungsi penuh tanpa konfigurasi.'
                    }
                  />
                </ul>
              )}

              <p className="mt-4 rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground">
                Langkah lanjutan yang bisa dilakukan kapan saja: impor LRA dari PDF
                (menu <span className="font-semibold">Import LRA</span>), kelola data
                OPD/SKPD dan akun pengguna (menu <span className="font-semibold">Admin</span>),
                atau unggah logo &amp; favicon (menu <span className="font-semibold">Pengaturan</span>).
              </p>

              {status?.completed && status.completedAt && (
                <p className="mt-3 text-[11px] text-muted-foreground">
                  Catatan: setup sebelumnya sudah ditandai selesai pada{' '}
                  {formatDateID(new Date(status.completedAt))}.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Navigasi */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/30 px-5 py-3">
          <p className="order-2 w-full text-center text-xs text-muted-foreground sm:order-1 sm:w-auto sm:text-left">
            Langkah {step + 1} dari {STEPS.length} — {STEPS[step].label}
          </p>
          <div className="order-1 flex w-full flex-col-reverse gap-2 sm:order-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Kembali
              </Button>
            )}
            {secondaryAction && (
              <Button variant="ghost" size="sm" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </Button>
            )}
            <Button
              size="sm"
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              className="bg-[#17408b] text-white hover:bg-[#12326e]"
            >
              {primaryAction.icon} {primaryAction.label}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Baris status dengan ikon + label + deskripsi (dipakai langkah Pengantar & Selesai). */
function StatusRow({
  icon,
  tone,
  label,
  desc,
  badge,
}: {
  icon: React.ReactNode
  tone: 'ok' | 'warn' | 'muted'
  label: string
  desc: string
  badge?: string
}) {
  const toneClass =
    tone === 'ok'
      ? 'border-emerald-200 bg-emerald-50'
      : tone === 'warn'
        ? 'border-amber-200 bg-amber-50'
        : 'border-border bg-muted/40'
  const iconClass =
    tone === 'ok' ? 'text-emerald-700' : tone === 'warn' ? 'text-amber-600' : 'text-muted-foreground'

  return (
    <li className={`flex items-start gap-3 rounded-md border p-3 ${toneClass}`}>
      <span className={`mt-0.5 shrink-0 ${iconClass}`}>{icon}</span>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-xs font-bold text-foreground">
          {label}
          {badge && (
            <span className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
              {badge}
            </span>
          )}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
      </div>
    </li>
  )
}
