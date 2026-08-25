import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  createSession,
} from '@/lib/auth'
import { hashPassword } from '@/lib/password'
import { isValidUsername } from '@/lib/users'
import { isFirstRunNeeded, markSetupCompleted } from '@/lib/setup-wizard'
import { findCopilotProvider } from '@/lib/copilot-providers'

/**
 * POST — selesaikan Setup Wizard first-run (PUBLIK, tetapi HANYA berlaku
 * saat aplikasi belum punya akun admin sama sekali).
 *
 * Body:
 * - username, password          → akun admin pertama (wajib)
 * - identity { appTitle?, govName?, brandText?, brandSubtext?, footerText? }
 * - copilot { provider?, apiKey?, baseUrl?, model? }  (opsional)
 *
 * Setelah sukses: akun dibuat, pengaturan disimpan, setup ditandai selesai,
 * dan sesi login admin dipasang otomatis (auto-login).
 */
export async function POST(req: Request) {
  try {
    // Guard mutlak: hanya boleh saat belum ada admin (instalasi baru)
    if (!(await isFirstRunNeeded())) {
      return NextResponse.json(
        { error: 'Setup sudah pernah dilakukan. Silakan login sebagai admin.' },
        { status: 403 }
      )
    }

    const body = (await req.json().catch(() => null)) as {
      username?: unknown
      password?: unknown
      identity?: Record<string, unknown> | null
      copilot?: { provider?: unknown; apiKey?: unknown; baseUrl?: unknown; model?: unknown } | null
    } | null

    // ---- Validasi akun admin pertama ----
    const username = typeof body?.username === 'string' ? body.username.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''

    if (!isValidUsername(username)) {
      return NextResponse.json(
        { error: 'Username harus 3-40 karakter (huruf, angka, titik, garis bawah, garis pisah) dan diawali huruf/angka.' },
        { status: 400 }
      )
    }
    if (password.length < 8 || password.length > 72) {
      return NextResponse.json({ error: 'Password harus 8-72 karakter.' }, { status: 400 })
    }
    if (/\s/.test(password)) {
      return NextResponse.json({ error: 'Password tidak boleh mengandung spasi.' }, { status: 400 })
    }
    const exists = await db.adminUser.findUnique({ where: { username } })
    if (exists) {
      return NextResponse.json({ error: 'Username sudah dipakai.' }, { status: 400 })
    }

    // ---- Validasi identitas ----
    const id = (body?.identity ?? {}) as Record<string, unknown>
    const identityFields: { key: string; value: string }[] = []
    for (const [key, limit] of [
      ['appTitle', 100],
      ['govName', 100],
      ['brandText', 30],
      ['brandSubtext', 60],
      ['footerText', 200],
    ] as const) {
      if (id[key] === undefined) continue
      if (typeof id[key] !== 'string') {
        return NextResponse.json({ error: `Nilai ${key} harus berupa teks` }, { status: 400 })
      }
      const value = (id[key] as string).trim()
      if (value.length > limit) {
        return NextResponse.json({ error: `${key} maksimal ${limit} karakter` }, { status: 400 })
      }
      identityFields.push({ key, value })
    }
    const appTitle = identityFields.find((f) => f.key === 'appTitle')?.value ?? ''
    const govName = identityFields.find((f) => f.key === 'govName')?.value ?? ''
    if (!appTitle || !govName) {
      return NextResponse.json(
        { error: 'Judul Dashboard dan Nama Pemerintah Daerah wajib diisi.' },
        { status: 400 }
      )
    }

    // ---- Validasi konfigurasi AI Copilot (opsional) ----
    const cp = body?.copilot ?? null
    let copilot: { provider: string; apiKey: string | null; baseUrl: string | null; model: string } | null = null
    if (cp && typeof cp.provider === 'string' && cp.provider.trim() && cp.provider.trim() !== 'default') {
      const provider = cp.provider.trim()
      const def = findCopilotProvider(provider)
      if (!def) {
        return NextResponse.json({ error: 'Provider AI Copilot tidak dikenal' }, { status: 400 })
      }

      let baseUrl: string | null = null
      if (typeof cp.baseUrl === 'string' && cp.baseUrl.trim()) {
        baseUrl = cp.baseUrl.trim()
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

      const model = typeof cp.model === 'string' ? cp.model.trim() : ''
      if (!model || model.length > 120) {
        return NextResponse.json(
          { error: `Nama model wajib diisi untuk provider ${def.label} (maks. 120 karakter)` },
          { status: 400 }
        )
      }

      let apiKey: string | null = null
      if (typeof cp.apiKey === 'string' && cp.apiKey.trim()) {
        apiKey = cp.apiKey.trim()
        if (apiKey.length < 8 || apiKey.length > 500) {
          return NextResponse.json({ error: 'API Key harus 8-500 karakter' }, { status: 400 })
        }
        if (/\s/.test(apiKey)) {
          return NextResponse.json({ error: 'API Key tidak boleh mengandung spasi' }, { status: 400 })
        }
      }
      if (def.requiresKey && !apiKey) {
        return NextResponse.json(
          { error: `API Key wajib diisi untuk provider ${def.label}` },
          { status: 400 }
        )
      }
      if (!baseUrl && !def.baseUrl) {
        return NextResponse.json({ error: 'Base URL wajib diisi untuk provider kustom' }, { status: 400 })
      }

      copilot = { provider: def.id, apiKey, baseUrl, model }
    }

    // ---- Eksekusi: buat akun admin + simpan pengaturan ----
    const user = await db.adminUser.create({
      data: { username, passwordHash: hashPassword(password), role: 'admin' },
    })

    for (const { key, value } of identityFields) {
      await db.appSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    }

    if (copilot) {
      await db.$transaction([
        db.appSetting.upsert({
          where: { key: 'copilotProvider' },
          update: { value: copilot.provider },
          create: { key: 'copilotProvider', value: copilot.provider },
        }),
        copilot.apiKey
          ? db.appSetting.upsert({
              where: { key: 'copilotApiKey' },
              update: { value: copilot.apiKey },
              create: { key: 'copilotApiKey', value: copilot.apiKey },
            })
          : db.appSetting.deleteMany({ where: { key: 'copilotApiKey' } }),
        copilot.baseUrl
          ? db.appSetting.upsert({
              where: { key: 'copilotBaseUrl' },
              update: { value: copilot.baseUrl },
              create: { key: 'copilotBaseUrl', value: copilot.baseUrl },
            })
          : db.appSetting.deleteMany({ where: { key: 'copilotBaseUrl' } }),
        db.appSetting.upsert({
          where: { key: 'copilotModel' },
          update: { value: copilot.model },
          create: { key: 'copilotModel', value: copilot.model },
        }),
      ])
    }

    await markSetupCompleted()

    // Auto-login: pasang sesi admin pertama langsung
    const session = await createSession(user.id)

    const res = NextResponse.json({
      data: {
        username: user.username,
        role: 'admin' as const,
        opdName: null,
      },
    })
    res.cookies.set(SESSION_COOKIE, session.id, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
      expires: session.expiresAt,
    })
    return res
  } catch (error) {
    console.error('POST /api/setup/complete error', error)
    return NextResponse.json({ error: 'Gagal menyelesaikan setup' }, { status: 500 })
  }
}
