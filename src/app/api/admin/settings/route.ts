import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, unauthorized } from '@/lib/auth'
import { getSettings } from '@/lib/settings'

// Kolom teks yang boleh diubah + batas panjangnya
const TEXT_FIELDS: Record<string, number> = {
  appName: 40,
  appTitle: 100,
  appDescription: 300,
  govName: 100,
  brandText: 30,
  brandSubtext: 60,
  footerText: 200,
}

// Warna header harus hex #rrggbb valid (atau string kosong = bawaan)
const HEADER_COLOR_RE = /^#[0-9a-fA-F]{6}$/

/** Simpan pengaturan teks aplikasi (nama, judul, deskripsi, brand, footer). */
export async function PUT(req: Request) {
  try {
    const user = await requireAdmin()
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

    // Warna header: hex valid atau kosong (kosong = kembali ke gradien bawaan)
    if ('headerColor' in body) {
      const raw = body.headerColor
      if (typeof raw !== 'string') {
        return NextResponse.json({ error: 'Warna header tidak valid' }, { status: 400 })
      }
      const value = raw.trim()
      if (value !== '' && !HEADER_COLOR_RE.test(value)) {
        return NextResponse.json(
          { error: 'Warna header harus kode hex #rrggbb (contoh #17408b)' },
          { status: 400 },
        )
      }
      if (value === '') {
        await db.appSetting.deleteMany({ where: { key: 'headerColor' } })
      } else {
        updates.push({ key: 'headerColor', value })
      }
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
