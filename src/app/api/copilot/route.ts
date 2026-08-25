import { NextResponse } from 'next/server'
import { requireExecutive, unauthorized } from '@/lib/auth'
import { buildCopilotContext, copilotSystemPrompt } from '@/lib/copilot'
import { CopilotLlmError, callCopilotLlm, getCopilotConfig } from '@/lib/copilot-config'

export const runtime = 'nodejs'

/** Batas aman percakapan & panjang pesan (mencegah penyalahgunaan token). */
const MAX_MESSAGES = 20
const MAX_CONTENT_LENGTH = 4000

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/**
 * POST /api/copilot — AI Copilot keuangan daerah.
 * Body: { messages: [{ role: 'user' | 'assistant', content: string }] }
 * (riwayat percakapan dikirim klien; server membangun prompt sistem berisi
 * konteks data keuangan terkini lalu memanggil LLM sesuai konfigurasi
 * Pengaturan → AI Copilot: mesin bawaan Z.ai, atau provider eksternal
 * apa pun yang kompatibel OpenAI dengan API key admin).
 * Hanya untuk admin penuh & Kepala Daerah.
 */
export async function POST(req: Request) {
  try {
    const user = await requireExecutive()
    if (!user) return unauthorized()

    const body = (await req.json().catch(() => null)) as
      | { messages?: unknown }
      | null

    // Validasi riwayat pesan
    if (!Array.isArray(body?.messages) || body.messages.length === 0) {
      return NextResponse.json({ error: 'Pesan tidak valid' }, { status: 400 })
    }
    const raw = body.messages as unknown[]
    if (raw.length > MAX_MESSAGES) {
      return NextResponse.json(
        { error: `Riwayat percakapan terlalu panjang (maks ${MAX_MESSAGES} pesan). Mulai percakapan baru.` },
        { status: 400 },
      )
    }

    const history: ChatMessage[] = []
    for (const m of raw) {
      if (typeof m !== 'object' || m === null) continue
      const e = m as Record<string, unknown>
      const role = e.role === 'user' || e.role === 'assistant' ? e.role : null
      const content = typeof e.content === 'string' ? e.content.trim() : ''
      if (!role || !content || content.length > MAX_CONTENT_LENGTH) {
        return NextResponse.json({ error: 'Format pesan tidak valid' }, { status: 400 })
      }
      history.push({ role, content })
    }
    if (history.length === 0 || history[history.length - 1].role !== 'user') {
      return NextResponse.json(
        { error: 'Pesan terakhir harus dari pengguna' },
        { status: 400 },
      )
    }

    // Konteks data keuangan + prompt sistem
    const context = await buildCopilotContext()
    const systemPrompt = copilotSystemPrompt(context, user.role)

    // Panggil LLM sesuai konfigurasi (bawaan Z.ai / provider eksternal)
    const cfg = await getCopilotConfig()
    const reply = await callCopilotLlm(cfg, systemPrompt, history)

    return NextResponse.json({
      data: { reply, hasContext: context !== null },
    })
  } catch (error) {
    if (error instanceof CopilotLlmError) {
      return NextResponse.json({ error: error.message }, { status: 502 })
    }
    console.error('POST /api/copilot error', error)
    return NextResponse.json(
      { error: 'Copilot sedang tidak tersedia. Silakan coba beberapa saat lagi.' },
      { status: 500 },
    )
  }
}
