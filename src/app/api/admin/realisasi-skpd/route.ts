import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, unauthorized } from '@/lib/auth'
import type { RealisasiSkpdRowDto } from '@/types/budget'

type SkpdRow = {
  id: number
  name: string
  pendapatanAnggaran: number
  pendapatanRealisasi: number
  belanjaAnggaran: number
  belanjaRealisasi: number
  pembiayaanAnggaran: number
  pembiayaanRealisasi: number
}

function toDto(r: SkpdRow): RealisasiSkpdRowDto {
  return {
    id: r.id,
    name: r.name,
    pendapatan: { anggaran: r.pendapatanAnggaran, realisasi: r.pendapatanRealisasi },
    belanja: { anggaran: r.belanjaAnggaran, realisasi: r.belanjaRealisasi },
    pembiayaan: { anggaran: r.pembiayaanAnggaran, realisasi: r.pembiayaanRealisasi },
  }
}

/** Validasi pasangan {anggaran, realisasi}; null jika valid, pesan error jika tidak. */
function validatePair(value: unknown, label: string): string | null {
  if (typeof value !== 'object' || value === null) {
    return `Data ${label} wajib berupa objek anggaran & realisasi`
  }
  const { anggaran, realisasi } = value as Record<string, unknown>
  if (!Number.isFinite(Number(anggaran)) || !Number.isFinite(Number(realisasi))) {
    return `Nilai anggaran/realisasi ${label} wajib berupa angka`
  }
  return null
}

export async function GET() {
  try {
    const user = await requireAdmin()
    if (!user) return unauthorized()

    const rows = await db.realisasiSkpd.findMany({ orderBy: { name: 'asc' } })
    return NextResponse.json({ data: rows.map(toDto) })
  } catch (error) {
    console.error('GET /api/admin/realisasi-skpd error', error)
    return NextResponse.json({ error: 'Gagal memuat realisasi SKPD' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const user = await requireAdmin()
    if (!user) return unauthorized()

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) {
      return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 })
    }

    const id = Number(body.id)
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: 'ID baris tidak valid' }, { status: 400 })
    }

    for (const [key, label] of [
      ['pendapatan', 'pendapatan'],
      ['belanja', 'belanja'],
      ['pembiayaan', 'pembiayaan'],
    ] as const) {
      const err = validatePair(body[key], label)
      if (err) return NextResponse.json({ error: err }, { status: 400 })
    }

    const existing = await db.realisasiSkpd.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Baris SKPD tidak ditemukan' }, { status: 404 })
    }

    const pendapatan = body.pendapatan as { anggaran: number; realisasi: number }
    const belanja = body.belanja as { anggaran: number; realisasi: number }
    const pembiayaan = body.pembiayaan as { anggaran: number; realisasi: number }

    const row = await db.realisasiSkpd.update({
      where: { id },
      data: {
        pendapatanAnggaran: Number(pendapatan.anggaran),
        pendapatanRealisasi: Number(pendapatan.realisasi),
        belanjaAnggaran: Number(belanja.anggaran),
        belanjaRealisasi: Number(belanja.realisasi),
        pembiayaanAnggaran: Number(pembiayaan.anggaran),
        pembiayaanRealisasi: Number(pembiayaan.realisasi),
      },
    })
    return NextResponse.json({ data: toDto(row) })
  } catch (error) {
    console.error('PUT /api/admin/realisasi-skpd error', error)
    return NextResponse.json({ error: 'Gagal memperbarui realisasi SKPD' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireAdmin()
    if (!user) return unauthorized()

    const { searchParams } = new URL(req.url)
    const all = searchParams.get('all')
    const idParam = searchParams.get('id')

    if (all === '1') {
      // Hapus seluruh data realisasi SKPD
      await db.realisasiSkpd.deleteMany({})
      return NextResponse.json({ data: { ok: true } })
    }

    const id = Number(idParam)
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: 'Parameter id wajib diisi (atau all=1 untuk semua)' },
        { status: 400 },
      )
    }

    const existing = await db.realisasiSkpd.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Baris SKPD tidak ditemukan' }, { status: 404 })
    }

    await db.realisasiSkpd.delete({ where: { id } })
    return NextResponse.json({ data: { ok: true } })
  } catch (error) {
    console.error('DELETE /api/admin/realisasi-skpd error', error)
    return NextResponse.json({ error: 'Gagal menghapus realisasi SKPD' }, { status: 500 })
  }
}
