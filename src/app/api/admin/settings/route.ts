import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminUser, unauthorized } from '@/lib/auth'
import { getSettings } from '@/lib/settings'

// Kolom teks yang boleh diubah + batas panjangnya
const TEXT_FIELDS: Record<string, number> = {
  appName: 40,
  appTitle: 100,
  appDescription: 300,
  brandText: 30,
  brandSubtext: 60,
  footerText: 200,
}

/** Simpan pengaturan teks aplikasi (nama, judul, deskripsi, brand, footer). */
export async function PUT(req: Request) {
  try {
    const user = await getAdminUser()
    if (!user) return unauthorized()

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 })
    }

    const updates: { key: string; value: string }[] = []
    for (const [key, limit] of Object.entries(TEXT_FIELDS)) {
      if (!(key in body)) continue
      const raw = body[key]
      if (typeof raw !== 'string') {
        return NextResponse.json(
          { error: `Nilai ${key} harus berupa teks` },
          { status: 400 },
        )
      }
      const value = raw.trim()
      if (value.length > limit) {
        return NextResponse.json(
          { error: `${key} maksimal ${limit} karakter` },
          { status: 400 },
        )
      }
      updates.push({ key, value })
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'Tidak ada pengaturan yang dikirim' },
        { status: 400 },
      )
    }

    for (const { key, value } of updates) {
      await db.appSetting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    }

    const data = await getSettings()
    return NextResponse.json({ data })
  } catch (error) {
    console.error('PUT /api/admin/settings error', error)
    return NextResponse.json({ error: 'Gagal menyimpan pengaturan' }, { status: 500 })
  }
}
