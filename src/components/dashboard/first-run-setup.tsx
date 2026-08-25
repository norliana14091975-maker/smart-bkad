'use client'

import { useMemo, useState } from 'react'
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
  UserPlus,
  Wand2,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useSettings } from '@/hooks/use-settings'
import { Button } from '@/components/ui/button'
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
import { DEFAULT_SETTINGS } from '@/lib/default-settings'
import { IDENTITY_FIELDS, StatusRow } from '@/components/dashboard/setup-wizard'
import type { AuthUserDto } from '@/types/budget'

/**
 * Setup Wizard first-run — layar penuh yang WAJIB dijalankan saat aplikasi
 * pertama kali dinyalakan dan belum memiliki akun admin.
 * Langkah: Pengantar → Akun Admin → Identitas → AI Copilot → Selesai.
 * Akun admin pertama dibuat di langkah terakhir (tidak ada akun bawaan).
 */

const STEPS = [
  { id: 'welcome', label: 'Pengantar', icon: Wand2 },
  { id: 'account', label: 'Akun Admin', icon: UserPlus },
  { id: 'identity', label: 'Identitas', icon: Building2 },
  { id: 'copilot', label: 'AI Copilot', icon: Bot },
  { id: 'finish', label: 'Selesai', icon: Flag },
] as const

const USERNAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{2,39}$/

interface FirstRunSetupProps {
  /** Judul aplikasi saat ini (dari /api/setup/status) untuk header wizard. */
  appTitle: string
  /** Dipanggil setelah setup sukses — pengguna langsung login sebagai admin. */
  onFinished: (user: AuthUserDto) => void
}

export function FirstRunSetup({ appTitle, onFinished }: FirstRunSetupProps) {
  const { toast } = useToast()
  const settingsQuery = useSettings()

  const [step, setStep] = useState(0)

  // ---- Langkah 1: akun admin pertama ----
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [accountError, setAccountError] = useState<string | null>(null)

  // ---- Langkah 2: identitas (draf > nilai tersimpan/bawaan Seruyan) ----
  const [idDraft, setIdDraft] = useState<Partial<Record<(typeof IDENTITY_FIELDS)[number]['key'], string>>>({})
  const [idError, setIdError] = useState<string | null>(null)

  const identityValue = (key: (typeof IDENTITY_FIELDS)[number]['key']): string => {
    if (idDraft[key] !== undefined) return idDraft[key]
    const current = settingsQuery.data?.[key] ?? DEFAULT_SETTINGS[key]
    return typeof current === 'string' ? current : ''
  }

  // ---- Langkah 3: AI Copilot (opsional) ----
  const [cpProvider, setCpProvider] = useState('default')
  const [cpModel, setCpModel] = useState('')
  const [cpBase, setCpBase] = useState('')
  const [cpKey, setCpKey] = useState('')
  const [cpTesting, setCpTesting] = useState(false)
  const [cpTest, setCpTest] = useState<{ ok: boolean; message: string } | null>(null)

  // ---- Langkah 4: submit ----
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const cpProviderDef = findCopilotProvider(cpProvider) ?? COPILOT_PROVIDERS[0]
  const cpIsDefault = cpProviderDef.id === 'default'

  const accountFilled = !!(username && password && passwordConfirm)
  const accountValid = useMemo(() => {
    if (!accountFilled) return false
    if (!USERNAME_RE.test(username)) return false
    if (password.length < 8 || password.length > 72 || /\s/.test(password)) return false
    return password === passwordConfirm
  }, [accountFilled, username, password, passwordConfirm])

  function selectCpProvider(id: string) {
    setCpProvider(id)
    const p = findCopilotProvider(id)
    setCpBase(p?.baseUrl ?? '')
    setCpModel(p?.modelPlaceholder ?? '')
    setCpKey('')
    setCpTest(null)
  }

  /** Validasi langkah akun, lalu lanjut. */
  function goFromAccount() {
    setAccountError(null)
    if (!USERNAME_RE.test(username.trim())) {
      setAccountError('Username harus 3-40 karakter (huruf, angka, titik, garis bawah, garis pisah) dan diawali huruf/angka.')
      return
    }
    if (password.length < 8 || password.length > 72) {
      setAccountError('Password harus 8-72 karakter.')
      return
    }
    if (/\s/.test(password)) {
      setAccountError('Password tidak boleh mengandung spasi.')
      return
    }
    if (password !== passwordConfirm) {
      setAccountError('Konfirmasi password tidak sama dengan password.')
      return
    }
    setStep(2)
  }

  /** Validasi langkah identitas, lalu lanjut. */
  function goFromIdentity() {
    setIdError(null)
    if (!identityValue('appTitle').trim() || !identityValue('govName').trim()) {
      setIdError('Judul Dashboard dan Nama Pemerintah Daerah wajib diisi.')
      return
    }
    setStep(3)
  }

  /** Uji koneksi AI Copilot memakai draf (endpoint khusus first-run). */
  async function testCopilot() {
    if (cpTesting) return
    setCpTesting(true)
    setCpTest(null)
    try {
      const res = await fetch('/api/setup/test-copilot', {
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

  /** Kirim seluruh konfigurasi: buat akun admin + simpan pengaturan + auto-login. */
  async function submitSetup() {
    if (submitting) return
    setSubmitError(null)
    if (!accountValid) {
      setSubmitError('Data akun admin belum valid — kembali ke langkah Akun Admin.')
      return
    }
    setSubmitting(true)
    try {
      const identity: Record<string, string> = {}
      for (const f of IDENTITY_FIELDS) identity[f.key] = identityValue(f.key)

      const res = await fetch('/api/setup/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
          identity,
          copilot: cpIsDefault
            ? null
            : {
                provider: cpProvider,
                baseUrl: cpBase,
                model: cpModel,
                ...(cpKey.trim() ? { apiKey: cpKey.trim() } : {}),
              },
        }),
      })
      const json = (await res.json()) as { data?: AuthUserDto; error?: string }
      if (!res.ok || !json.data) throw new Error(json.error ?? 'Gagal menyelesaikan setup')

      toast({
        title: 'Setup selesai — selamat datang!',
        description: `Akun admin "${json.data.username}" berhasil dibuat dan Anda otomatis masuk.`,
      })
      // Bersihkan password dari memori komponen sebelum menutup wizard
      setPassword('')
      setPasswordConfirm('')
      setCpKey('')
      onFinished(json.data)
    } catch (err) {
      setSubmitError(String(err))
      toast({ title: 'Gagal menyelesaikan setup', description: String(err), variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  // ---- Aksi utama per langkah ----
  let primaryAction: { label: string; icon: React.ReactNode; onClick: () => void; disabled?: boolean }
  if (step === 0) {
    primaryAction = {
      label: 'Mulai Setup',
      icon: <Wand2 className="h-4 w-4" aria-hidden="true" />,
      onClick: () => setStep(1),
    }
  } else if (step === 1) {
    primaryAction = {
      label: 'Lanjut',
      icon: <UserPlus className="h-4 w-4" aria-hidden="true" />,
      onClick: goFromAccount,
      disabled: !accountFilled,
    }
  } else if (step === 2) {
    primaryAction = {
      label: 'Lanjut',
      icon: <Building2 className="h-4 w-4" aria-hidden="true" />,
      onClick: goFromIdentity,
    }
  } else if (step === 3) {
    primaryAction = {
      label: cpIsDefault ? 'Lanjut' : 'Lanjut',
      icon: <Bot className="h-4 w-4" aria-hidden="true" />,
      onClick: () => setStep(4),
      disabled: !cpIsDefault && !cpModel.trim(),
    }
  } else {
    primaryAction = {
      label: 'Selesaikan Setup & Masuk',
      icon: submitting ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
      ),
      onClick: submitSetup,
      disabled: submitting,
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Setup Wizard — inisialisasi aplikasi"
      className="fixed inset-0 z-[100] overflow-y-auto bg-[#0d1b33]/97 px-4 py-6 backdrop-blur-sm"
    >
      <div className="mx-auto flex min-h-full w-full max-w-[46rem] items-center">
        <div className="w-full overflow-hidden rounded-xl border border-white/10 bg-white shadow-2xl">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#17408b] to-[#12326e] px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
              Inisialisasi Aplikasi
            </p>
            <h1 className="mt-0.5 flex items-center gap-2 text-base font-bold text-white">
              <Wand2 className="h-5 w-5 shrink-0" aria-hidden="true" />
              Setup Wizard — {appTitle}
            </h1>
            <p className="mt-1 text-xs text-white/80">
              Aplikasi terdeteksi berjalan untuk pertama kalinya. Wizard ini akan
              membuat akun admin pertama dan konfigurasi dasar dashboard.
            </p>
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
          <div className="nice-scrollbar min-h-[17rem] px-5 py-5">
            {/* ===== Langkah 0: Pengantar ===== */}
            {step === 0 && (
              <div>
                <div className="mb-4 flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#17408b]/10 text-[#17408b]">
                    <Wand2 className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-foreground">Selamat datang di {appTitle}</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Demi keamanan, aplikasi ini tidak lagi menyediakan akun bawaan.
                      Wizard ini akan memandu Anda membuat akun admin pertama,
                      mengatur identitas daerah, dan (opsional) menghubungkan AI Copilot.
                    </p>
                  </div>
                </div>

                <ul className="space-y-2" aria-label="Yang akan disiapkan">
                  <StatusRow
                    icon={<UserPlus className="h-5 w-5" />}
                    tone="ok"
                    label="Akun Admin Pertama"
                    desc="Buat username dan password admin Anda sendiri — kredensial ini mengelola seluruh dashboard."
                  />
                  <StatusRow
                    icon={<Building2 className="h-5 w-5" />}
                    tone="ok"
                    label="Identitas Dashboard"
                    desc="Judul, nama pemerintah daerah, dan teks brand — sudah terisi bawaan Kabupaten Seruyan dan dapat disesuaikan."
                  />
                  <StatusRow
                    icon={<Bot className="h-5 w-5" />}
                    tone="muted"
                    label="AI Copilot"
                    badge="Opsional"
                    desc="Berfungsi penuh dengan mesin bawaan Z.ai — dapat dihubungkan ke provider lain (OpenAI, Claude, Gemini, dll.)."
                  />
                </ul>

                <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
                  Wizard ini hanya muncul sekali. Simpan kredensial admin yang Anda buat
                  dengan aman — tanpa itu, dashboard tidak dapat dikelola.
                </p>
              </div>
            )}

            {/* ===== Langkah 1: Akun Admin ===== */}
            {step === 1 && (
              <div>
                <h2 className="text-sm font-bold text-foreground">Buat Akun Admin Pertama</h2>
                <p className="mb-4 mt-0.5 text-xs text-muted-foreground">
                  Akun ini memiliki akses penuh: kelola data APBD &amp; realisasi, impor LRA,
                  pengguna, dan pengaturan aplikasi.
                </p>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label htmlFor="fr-username" className="mb-1.5">Username</Label>
                    <Input
                      id="fr-username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="mis. admin-seruyan"
                      autoComplete="username"
                      maxLength={40}
                      required
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      3-40 karakter: huruf, angka, titik, garis bawah, garis pisah.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="fr-password" className="mb-1.5">Password</Label>
                    <Input
                      id="fr-password"
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimal 8 karakter"
                      autoComplete="new-password"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="fr-password-confirm" className="mb-1.5">Konfirmasi Password</Label>
                    <Input
                      id="fr-password-confirm"
                      type={showPw ? 'text' : 'password'}
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      placeholder="Ulangi password"
                      autoComplete="new-password"
                      required
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

                {accountError && (
                  <p role="alert" className="mt-3 rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-700">
                    {accountError}
                  </p>
                )}
              </div>
            )}

            {/* ===== Langkah 2: Identitas ===== */}
            {step === 2 && (
              <div>
                <h2 className="text-sm font-bold text-foreground">Identitas Dashboard</h2>
                <p className="mb-4 mt-0.5 text-xs text-muted-foreground">
                  Atur identitas dasar yang tampil di seluruh halaman. Nilai bawaan sudah
                  mengikuti Kabupaten Seruyan. Logo, favicon, dan warna header dapat
                  diatur kemudian lewat menu Pengaturan.
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
                        <Label htmlFor={`fr-${f.key}`} className="mb-1.5 flex items-center justify-between">
                          <span>{f.label}</span>
                          <span className="text-[10px] font-normal text-muted-foreground">
                            {identityValue(f.key).length}/{f.max}
                          </span>
                        </Label>
                        {f.textarea ? (
                          <Textarea
                            id={`fr-${f.key}`}
                            value={identityValue(f.key)}
                            placeholder={f.placeholder}
                            maxLength={f.max}
                            rows={2}
                            onChange={(e) => setIdDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                          />
                        ) : (
                          <Input
                            id={`fr-${f.key}`}
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

                {idError && (
                  <p role="alert" className="mt-3 rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-700">
                    {idError}
                  </p>
                )}
              </div>
            )}

            {/* ===== Langkah 3: AI Copilot ===== */}
            {step === 3 && (
              <div>
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-foreground">AI Copilot — Provider LLM</h2>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#17408b]/20 bg-[#17408b]/5 px-2.5 py-0.5 text-[11px] font-semibold text-[#17408b]">
                    <Bot className="h-3 w-3" aria-hidden="true" />
                    {cpProviderDef.label}
                  </span>
                </div>
                <p className="mb-4 mt-0.5 text-xs text-muted-foreground">
                  AI Copilot siap dipakai dengan mesin bawaan Z.ai — cukup lanjut tanpa
                  konfigurasi. Untuk memakai provider sendiri (OpenAI, Claude, Gemini,
                  Groq, DeepSeek, dll.), pilih provider dan isi kredensial.
                </p>

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
                    <Label htmlFor="fr-cp-model">Model</Label>
                    <Input
                      id="fr-cp-model"
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
                    <Label htmlFor="fr-cp-key">API Key</Label>
                    <Input
                      id="fr-cp-key"
                      type={showPw ? 'text' : 'password'}
                      value={cpKey}
                      onChange={(e) => setCpKey(e.target.value)}
                      placeholder={cpProviderDef.keyHint || 'API Key'}
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
                        : `${cpProviderDef.requiresKey ? 'Wajib diisi. ' : 'Opsional. '}${cpProviderDef.keyHint}.`}
                    </p>
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="fr-cp-base">Base URL</Label>
                    <Input
                      id="fr-cp-base"
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

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={testCopilot}
                    disabled={cpTesting || (!cpIsDefault && !cpModel.trim())}
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
                    <h2 className="text-sm font-bold text-foreground">Siap Menyelesaikan Setup</h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Akun admin akan dibuat dan Anda langsung masuk ke dashboard.
                      Semua konfigurasi masih dapat diubah nanti lewat menu Pengaturan.
                    </p>
                  </div>
                </div>

                <ul className="space-y-2" aria-label="Ringkasan konfigurasi">
                  <StatusRow
                    icon={<UserPlus className="h-5 w-5" />}
                    tone="ok"
                    label="Akun Admin"
                    desc={`Username: ${username.trim() || '—'}`}
                  />
                  <StatusRow
                    icon={<Building2 className="h-5 w-5" />}
                    tone="ok"
                    label="Identitas Dashboard"
                    desc={`${identityValue('appTitle') || '—'} · ${identityValue('govName') || '—'}`}
                  />
                  <StatusRow
                    icon={<Bot className="h-5 w-5" />}
                    tone={cpIsDefault ? 'muted' : 'ok'}
                    label="AI Copilot"
                    badge="Opsional"
                    desc={
                      cpIsDefault
                        ? 'Mesin bawaan Z.ai aktif — berfungsi penuh tanpa konfigurasi.'
                        : `Provider kustom: ${cpProviderDef.label} · ${cpModel || '—'}`
                    }
                  />
                </ul>

                {submitError && (
                  <p role="alert" className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-700">
                    {submitError}
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  disabled={step === 0 || submitting}
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Kembali
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
        </div>
      </div>
    </div>
  )
}
