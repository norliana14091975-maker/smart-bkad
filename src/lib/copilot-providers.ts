/**
 * Registry penyedia LLM untuk AI Copilot.
 * File ini berisi DATA MURNI (tanpa Prisma/fetch) sehingga aman diimpor
 * oleh komponen client maupun kode server.
 *
 * Semua provider non-bawaan memakai protokol OpenAI-Compatible
 * (POST {baseUrl}/chat/completions + header Authorization: Bearer) —
 * standar yang didukung hampir semua penyedia LLM.
 */

export interface CopilotProviderDef {
  id: string
  label: string
  /** Base URL OpenAI-compatible; null = mesin bawaan (Z.ai, tanpa konfigurasi) */
  baseUrl: string | null
  /** Contoh/placeholder nama model populer untuk provider tsb. */
  modelPlaceholder: string | null
  /** true bila provider mewajibkan API key */
  requiresKey: boolean
  /** Keterangan singkat untuk UI */
  hint: string
  /** Petunjuk format API key */
  keyHint: string
}

export const COPILOT_PROVIDERS: CopilotProviderDef[] = [
  {
    id: 'default',
    label: 'Bawaan (Z.ai)',
    baseUrl: null,
    modelPlaceholder: null,
    requiresKey: false,
    hint: 'Mesin AI bawaan aplikasi — tanpa API key, tanpa konfigurasi.',
    keyHint: '',
  },
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    modelPlaceholder: 'gpt-4o-mini',
    requiresKey: true,
    hint: 'Platform resmi OpenAI (GPT-4o, GPT-4.1, o4-mini, dsb.).',
    keyHint: 'Berawalan sk-…',
  },
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    baseUrl: 'https://api.anthropic.com/v1',
    modelPlaceholder: 'claude-sonnet-4-5',
    requiresKey: true,
    hint: 'Model Claude — endpoint kompatibel OpenAI.',
    keyHint: 'Berawalan sk-ant-…',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    modelPlaceholder: 'gemini-2.0-flash',
    requiresKey: true,
    hint: 'Google AI Studio (Gemini 2.0 Flash / Pro).',
    keyHint: 'Dari Google AI Studio',
  },
  {
    id: 'groq',
    label: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    modelPlaceholder: 'llama-3.3-70b-versatile',
    requiresKey: true,
    hint: 'Inferensi sangat cepat (Llama, Mixtral, Kimi).',
    keyHint: 'Dari console.groq.com',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    modelPlaceholder: 'deepseek-chat',
    requiresKey: true,
    hint: 'Biaya hemat, kuat untuk analisis data.',
    keyHint: 'Berawalan sk-…',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    modelPlaceholder: 'openai/gpt-4o-mini',
    requiresKey: true,
    hint: 'Agregator 400+ model dari banyak vendor dalam satu key.',
    keyHint: 'Berawalan sk-or-…',
  },
  {
    id: 'mistral',
    label: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    modelPlaceholder: 'mistral-large-latest',
    requiresKey: true,
    hint: 'Model open-weight dari Eropa.',
    keyHint: 'Dari console.mistral.ai',
  },
  {
    id: 'together',
    label: 'Together AI',
    baseUrl: 'https://api.together.xyz/v1',
    modelPlaceholder: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    requiresKey: true,
    hint: 'Hosting model open-source populer.',
    keyHint: 'Dari api.together.ai',
  },
  {
    id: 'ollama',
    label: 'Ollama (Lokal)',
    baseUrl: 'http://localhost:11434/v1',
    modelPlaceholder: 'llama3.1',
    requiresKey: false,
    hint: 'Server LLM lokal — tanpa API key, tanpa biaya.',
    keyHint: '',
  },
  {
    id: 'custom',
    label: 'Kustom (OpenAI-Compatible)',
    baseUrl: '',
    modelPlaceholder: '',
    requiresKey: false,
    hint: 'Endpoint apa pun yang kompatibel OpenAI (vLLM, LM Studio, Azure, proxy, dll.).',
    keyHint: 'Opsional',
  },
]

/** Cari definisi provider berdasarkan id. */
export function findCopilotProvider(id: string): CopilotProviderDef | undefined {
  return COPILOT_PROVIDERS.find((p) => p.id === id)
}

/** Masking API key untuk tampilan admin: hanya 4 karakter terakhir terlihat. */
export function maskApiKey(key: string): string {
  const trimmed = key.trim()
  if (trimmed.length <= 8) return '••••••'
  return `${'•'.repeat(12)}${trimmed.slice(-4)}`
}
