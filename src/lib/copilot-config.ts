import { db } from '@/lib/db'
import { findCopilotProvider, maskApiKey } from '@/lib/copilot-providers'

/**
 * Konfigurasi AI Copilot (server-side): penyimpanan di tabel app_setting
 * dan klien LLM. Semua provider non-bawaan memakai protokol
 * OpenAI-Compatible (POST {baseUrl}/chat/completions) melalui fetch,
 * sehingga kompatibel dengan hampir semua penyedia LLM.
 */

export const COPILOT_SETTING_KEYS = [
  'copilotProvider',
  'copilotApiKey',
  'copilotBaseUrl',
  'copilotModel',
] as const

const KEY_PROVIDER = 'copilotProvider'
const KEY_API_KEY = 'copilotApiKey'
const KEY_BASE_URL = 'copilotBaseUrl'
const KEY_MODEL = 'copilotModel'

/** Pesan riwayat percakapan untuk klien LLM. */
export interface CopilotChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/** Konfigurasi copilot lengkap — HANYA untuk kode server (berisi API key). */
export interface CopilotConfig {
  provider: string
  apiKey: string | null
  baseUrl: string | null
  model: string | null
}

/** Kesalahan klien LLM dengan pesan siap tampil (Bahasa Indonesia). */
export class CopilotLlmError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'CopilotLlmError'
    this.status = status
  }
}

/** Baca konfigurasi copilot dari database (khusus server). */
export async function getCopilotConfig(): Promise<CopilotConfig> {
  const rows = await db.appSetting.findMany({
    where: { key: { in: [...COPILOT_SETTING_KEYS] } },
  })
  const map = new Map(rows.map((r) => [r.key, r.value]))
  return {
    provider: map.get(KEY_PROVIDER) ?? 'default',
    apiKey: map.get(KEY_API_KEY) || null,
    baseUrl: map.get(KEY_BASE_URL) || null,
    model: map.get(KEY_MODEL) || null,
  }
}

/** Base URL efektif: nilai tersimpan > default provider. */
export function effectiveBaseUrl(cfg: CopilotConfig): string | null {
  if (cfg.baseUrl && cfg.baseUrl.trim()) return cfg.baseUrl.trim()
  const def = findCopilotProvider(cfg.provider)
  return def?.baseUrl ?? null
}

/** Info copilot untuk UI admin — API key SELALU dimasker. */
export async function getCopilotPublicInfo() {
  const cfg = await getCopilotConfig()
  const def = findCopilotProvider(cfg.provider) ?? findCopilotProvider('default')!
  return {
    provider: cfg.provider,
    providerLabel: def.label,
    baseUrl: def.id === 'default' ? null : effectiveBaseUrl(cfg),
    model: cfg.model,
    hasApiKey: !!cfg.apiKey,
    apiKeyMasked: cfg.apiKey ? maskApiKey(cfg.apiKey) : null,
    requiresKey: def.requiresKey,
  }
}

/** Hapus seluruh konfigurasi copilot (kembali ke mesin bawaan Z.ai). */
export async function clearCopilotSettings(): Promise<void> {
  await db.appSetting.deleteMany({ where: { key: { in: [...COPILOT_SETTING_KEYS] } } })
}

/**
 * Panggil endpoint OpenAI-Compatible (POST {baseUrl}/chat/completions).
 * Kesalahan HTTP dipetakan ke pesan Indonesia yang jelas bagi admin.
 */
async function callOpenAiCompatible(opts: {
  baseUrl: string
  apiKey: string | null
  model: string
  messages: CopilotChatMessage[]
  maxTokens?: number
  temperature?: number
  timeoutMs?: number
}): Promise<string> {
  const url = `${opts.baseUrl.replace(/\/+$/, '')}/chat/completions`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 60_000)

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (opts.apiKey) headers.Authorization = `Bearer ${opts.apiKey}`
    // OpenRouter merekomendasikan header referer/aplikasi
    if (url.includes('openrouter.ai')) {
      headers['HTTP-Referer'] = 'https://dashboard-seruyan.local'
      headers['X-Title'] = 'Dashboard Keuangan Kab. Seruyan'
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens ?? 1024,
        stream: false,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      let detail = ''
      try {
        const j = (await res.json()) as { error?: { message?: string } } | null
        detail = j?.error?.message ?? ''
      } catch {
        // abaikan body non-JSON
      }
      const suffix = detail ? ` (${detail})` : ''
      if (res.status === 401 || res.status === 403) {
        throw new CopilotLlmError(`API Key tidak valid atau tidak diizinkan provider${suffix}`, 401)
      }
      if (res.status === 404) {
        throw new CopilotLlmError(`Model atau Base URL tidak ditemukan${suffix}`, 404)
      }
      if (res.status === 429) {
        throw new CopilotLlmError(`Kuota / batas laju provider terlampaui${suffix}`, 429)
      }
      if (res.status >= 500) {
        throw new CopilotLlmError(`Server provider bermasalah (HTTP ${res.status})${suffix}`, 502)
      }
      throw new CopilotLlmError(`Provider menolak permintaan (HTTP ${res.status})${suffix}`, 400)
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const reply = json.choices?.[0]?.message?.content
    if (typeof reply !== 'string' || !reply.trim()) {
      throw new CopilotLlmError('Provider tidak mengembalikan jawaban yang valid.')
    }
    return reply.trim()
  } catch (err) {
    if (err instanceof CopilotLlmError) throw err
    if (err instanceof Error && err.name === 'AbortError') {
      throw new CopilotLlmError('Permintaan ke provider melebihi batas waktu (timeout).')
    }
    throw new CopilotLlmError(
      `Tidak dapat menghubungi provider: ${err instanceof Error ? err.message : 'kesalahan jaringan'}`
    )
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Jalankan percakapan copilot memakai konfigurasi tersimpan:
 * - provider bawaan → z-ai-web-dev-sdk (seperti semula)
 * - provider lain → endpoint OpenAI-Compatible dengan API key admin
 */
export async function callCopilotLlm(
  cfg: CopilotConfig,
  systemPrompt: string,
  history: { role: 'user' | 'assistant'; content: string }[]
): Promise<string> {
  const def = findCopilotProvider(cfg.provider)

  // Mesin bawaan (Z.ai) — tanpa konfigurasi
  if (!def || def.id === 'default') {
    const { default: ZAI } = await import('z-ai-web-dev-sdk')
    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        ...history.map((m) => ({ role: m.role, content: m.content })),
      ],
      thinking: { type: 'disabled' },
    })
    const reply = completion.choices[0]?.message?.content?.trim()
    if (!reply) throw new CopilotLlmError('Copilot tidak mengembalikan jawaban. Silakan coba lagi.')
    return reply
  }

  // Provider eksternal (OpenAI-Compatible)
  const baseUrl = effectiveBaseUrl(cfg)
  const model = cfg.model?.trim()
  if (!baseUrl) {
    throw new CopilotLlmError('Base URL provider belum diatur pada Pengaturan AI Copilot.')
  }
  if (!model) {
    throw new CopilotLlmError('Model belum diatur pada Pengaturan AI Copilot.')
  }

  return callOpenAiCompatible({
    baseUrl,
    apiKey: cfg.apiKey,
    model,
    messages: [{ role: 'system', content: systemPrompt }, ...history],
  })
}

/**
 * Uji koneksi ke provider dengan pesan mini.
 * Mengembalikan engine, balasan singkat, dan latensi.
 */
export async function testCopilotConnection(cfg: CopilotConfig): Promise<{
  engine: string
  reply: string
  latencyMs: number
}> {
  const t0 = Date.now()
  const def = findCopilotProvider(cfg.provider)

  if (!def || def.id === 'default') {
    const { default: ZAI } = await import('z-ai-web-dev-sdk')
    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [{ role: 'user', content: 'Balas hanya dengan satu kata: OK' }],
      thinking: { type: 'disabled' },
    })
    const reply = completion.choices[0]?.message?.content?.trim() || '(kosong)'
    return { engine: 'Z.ai (bawaan)', reply, latencyMs: Date.now() - t0 }
  }

  const baseUrl = effectiveBaseUrl(cfg)
  const model = cfg.model?.trim()
  if (!baseUrl) throw new CopilotLlmError('Base URL wajib diisi untuk menguji koneksi.')
  if (!model) throw new CopilotLlmError('Model wajib diisi untuk menguji koneksi.')
  if (def.requiresKey && !cfg.apiKey) {
    throw new CopilotLlmError(`API Key wajib diisi untuk provider ${def.label}.`)
  }

  const reply = await callOpenAiCompatible({
    baseUrl,
    apiKey: cfg.apiKey,
    model,
    messages: [{ role: 'user', content: 'Balas hanya dengan satu kata: OK' }],
    maxTokens: 16,
    temperature: 0,
    timeoutMs: 25_000,
  })
  return { engine: `${def.label} · ${model}`, reply, latencyMs: Date.now() - t0 }
}
