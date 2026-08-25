import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, unauthorized } from '@/lib/auth'
import { findCopilotProvider } from '@/lib/copilot-providers'
import { clearCopilotSettings, getCopilotConfig, getCopilotPublicInfo } from '@/lib/copilot-config'

/**
 * GET — info konfigurasi AI Copilot untuk UI admin.
 * API key SELALU dimasker (tidak pernah dikirim utuh ke klien).
 */
export async function GET() {
  try {
    const admin = await requireAdmin()
    if (!admin) return unauthorized()

    const data = await getCopilotPublicInfo()
    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET /api/admin/settings/copilot error', error)
    return NextResponse.json({ error: 'Gagal memuat konfigurasi AI Copilot' }, { status: 500 })
  }
}

/**
 * PUT — simpan konfigurasi AI Copilot.
 * Body: { provider, apiKey?, baseUrl?, model? }
 * - provider 'default' → hapus key/baseUrl/model (kembali ke mesin bawaan)
 * - provider lain → model wajib; API key wajib bila provider memintanya
 *   (key lama dipertahankan bila input kosong)
 */
export async function PUT(req: Request) {
  try {
    const admin = await requireAdmin()
    if (!admin) return unauthorized()

    const body = (await req.json().catch(() => null)) as
      | { provider?: unknown; apiKey?: unknown; baseUrl?: unknown; model?: unknown }
      | null

    const provider = typeof body?.provider === 'string' ? body.provider.trim() : ''
    if (!provider || !findCopilotProvider(provider)) {
      return NextResponse.json({ error: 'Provider tidak dikenal' }, { status: 400 })
    }
    const def = findCopilotProvider(provider)!

    const current = await getCopilotConfig()

    // Provider bawaan: cukup simpan pilihan provider, bersihkan sisanya
    if (def.id === 'default') {
      await db.$transaction([
        db.appSetting.upsert({
          where: { key: 'copilotProvider' },
          update: { value: 'default' },
          create: { key: 'copilotProvider', value: 'default' },
        }),
        db.appSetting.deleteMany({ where: { key: { in: ['copilotApiKey', 'copilotBaseUrl', 'copilotModel'] } } }),
      ])
      const data = await getCopilotPublicInfo()
      return NextResponse.json({ data })
    }

    // ---- Validasi base URL ----
    let baseUrl: string | null = null
    if (typeof body?.baseUrl === 'string' && body.baseUrl.trim()) {
      baseUrl = body.baseUrl.trim()
      if (baseUrl.length > 300) {
        return NextResponse.json({ error: 'Base URL maksimal 300 karakter' }, { status: 400 })
      }
      if (!/^https?:\/\//i.test(baseUrl)) {
        return NextResponse.json(
          { error: 'Base URL harus diawali http:// atau https://' },
          { status: 400 }
        )
      }
    }

    // ---- Validasi model ----
    let model: string | null = null
    if (typeof body?.model === 'string') model = body.model.trim() || null
    if (!model) model = current.model // input kosong → pakai model tersimpan
    if (!model) {
      return NextResponse.json(
        { error: `Nama model wajib diisi untuk provider ${def.label}` },
        { status: 400 }
      )
    }
    if (model.length > 120) {
      return NextResponse.json({ error: 'Nama model maksimal 120 karakter' }, { status: 400 })
    }

    // ---- Validasi API key ----
    let apiKey: string | null = null
    if (typeof body?.apiKey === 'string' && body.apiKey.trim()) {
      apiKey = body.apiKey.trim()
      if (apiKey.length < 8 || apiKey.length > 500) {
        return NextResponse.json({ error: 'API Key harus 8-500 karakter' }, { status: 400 })
      }
      if (/\s/.test(apiKey)) {
        return NextResponse.json({ error: 'API Key tidak boleh mengandung spasi' }, { status: 400 })
      }
    }
    if (!apiKey) apiKey = current.apiKey // input kosong → pakai key tersimpan
    if (def.requiresKey && !apiKey) {
      return NextResponse.json(
        { error: `API Key wajib diisi untuk provider ${def.label}` },
        { status: 400 }
      )
    }

    await db.$transaction([
      db.appSetting.upsert({
        where: { key: 'copilotProvider' },
        update: { value: def.id },
        create: { key: 'copilotProvider', value: def.id },
      }),
      apiKey
        ? db.appSetting.upsert({
            where: { key: 'copilotApiKey' },
            update: { value: apiKey },
            create: { key: 'copilotApiKey', value: apiKey },
          })
        : db.appSetting.deleteMany({ where: { key: 'copilotApiKey' } }),
      baseUrl
        ? db.appSetting.upsert({
            where: { key: 'copilotBaseUrl' },
            update: { value: baseUrl },
            create: { key: 'copilotBaseUrl', value: baseUrl },
          })
        : db.appSetting.deleteMany({ where: { key: 'copilotBaseUrl' } }),
      db.appSetting.upsert({
        where: { key: 'copilotModel' },
        update: { value: model },
        create: { key: 'copilotModel', value: model },
      }),
    ])

    const data = await getCopilotPublicInfo()
    return NextResponse.json({ data })
  } catch (error) {
    console.error('PUT /api/admin/settings/copilot error', error)
    return NextResponse.json({ error: 'Gagal menyimpan konfigurasi AI Copilot' }, { status: 500 })
  }
}

/** DELETE — hapus seluruh konfigurasi copilot (kembali ke mesin bawaan Z.ai). */
export async function DELETE() {
  try {
    const admin = await requireAdmin()
    if (!admin) return unauthorized()

    await clearCopilotSettings()
    const data = await getCopilotPublicInfo()
    return NextResponse.json({ data })
  } catch (error) {
    console.error('DELETE /api/admin/settings/copilot error', error)
    return NextResponse.json({ error: 'Gagal menghapus konfigurasi AI Copilot' }, { status: 500 })
  }
}
