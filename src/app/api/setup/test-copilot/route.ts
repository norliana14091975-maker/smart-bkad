import { NextResponse } from 'next/server'
import { isFirstRunNeeded } from '@/lib/setup-wizard'
import { findCopilotProvider } from '@/lib/copilot-providers'
import { CopilotLlmError, testCopilotConnection } from '@/lib/copilot-config'

/**
 * POST — uji koneksi AI Copilot dari dalam Setup Wizard first-run
 * (PUBLIK, tetapi HANYA berlaku saat aplikasi belum punya akun admin).
 * Body: { provider, apiKey?, baseUrl?, model? } — memakai nilai draf wizard.
 */
export async function POST(req: Request) {
  try {
    // Guard mutlak: hanya boleh saat setup first-run belum selesai
    if (!(await isFirstRunNeeded())) {
      return NextResponse.json(
        { error: 'Uji koneksi hanya tersedia saat Setup Wizard berjalan.' },
        { status: 403 }
      )
    }

    const body = (await req.json().catch(() => null)) as {
      provider?: unknown
      apiKey?: unknown
      baseUrl?: unknown
      model?: unknown
    } | null

    const provider = typeof body?.provider === 'string' ? body.provider.trim() : 'default'
    const def = findCopilotProvider(provider)
    if (!def) {
      return NextResponse.json({ error: 'Provider tidak dikenal' }, { status: 400 })
    }

    const apiKey =
      typeof body?.apiKey === 'string' && body.apiKey.trim() ? body.apiKey.trim() : null
    if (apiKey && (apiKey.length < 8 || apiKey.length > 500 || /\s/.test(apiKey))) {
      return NextResponse.json({ error: 'API Key harus 8-500 karakter tanpa spasi' }, { status: 400 })
    }

    let baseUrl: string | null = null
    if (typeof body?.baseUrl === 'string' && body.baseUrl.trim()) {
      baseUrl = body.baseUrl.trim()
      if (!/^https?:\/\//i.test(baseUrl)) {
        return NextResponse.json(
          { error: 'Base URL harus diawali http:// atau https://' },
          { status: 400 }
        )
      }
    }

    const model = typeof body?.model === 'string' ? body.model.trim() : null

    try {
      const result = await testCopilotConnection({
        provider: def.id,
        apiKey,
        baseUrl,
        model,
      })
      return NextResponse.json({ data: result })
    } catch (err) {
      if (err instanceof CopilotLlmError) {
        return NextResponse.json({ error: err.message }, { status: 400 })
      }
      throw err
    }
  } catch (error) {
    console.error('POST /api/setup/test-copilot error', error)
    return NextResponse.json({ error: 'Gagal menguji koneksi AI Copilot' }, { status: 500 })
  }
}
