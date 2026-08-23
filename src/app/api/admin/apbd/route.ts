import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, unauthorized } from '@/lib/auth'
import type { ApbdSummaryDto } from '@/types/budget'

/** Bentuk DTO ringkasan APBD (sama dengan /api/apbd). */
function toDto(r: {
  year: number
  pendapatanApbd: number
  pendapatanApbdp: number
  belanjaApbd: number
  belanjaApbdp: number
  terimaApbd: number
  terimaApbdp: number
  keluarApbd: number
  keluarApbdp: number
}): ApbdSummaryDto {
  return {
    year: r.year,
    pendapatan: { apbd: r.pendapatanApbd, apbdp: r.pendapatanApbdp },
    belanja: { apbd: r.belanjaApbd, apbdp: r.belanjaApbdp },
    penerimaanPembiayaan: { apbd: r.terimaApbd, apbdp: r.terimaApbdp },
    pengeluaranPembiayaan: { apbd: r.keluarApbd, apbdp: r.keluarApbdp },
  }
}

/** Ambil angka valid dari nilai apa pun (number/string); null jika tidak valid. */
function toFiniteNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

export async function GET() {
  try {
    const user = await requireAdmin()
    if (!user) return unauthorized()

    const rows = await db.apbdSummary.findMany({ orderBy: { year: 'desc' } })
    return NextResponse.json({ data: rows.map(toDto) })
  } catch (error) {
    console.error('GET /api/admin/apbd error', error)
    return NextResponse.json({ error: 'Gagal memuat data APBD' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAdmin()
    if (!user) return unauthorized()

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) {
      return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 })
    }

    const year = Number(body.year)
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: 'Tahun tidak valid' }, { status: 400 })
    }

    // Validasi kelima field numerik (masing-masing apbd & apbdp)
    const src = body as {
      pendapatan?: Record<string, unknown>
      belanja?: Record<string, unknown>
      penerimaanPembiayaan?: Record<string, unknown>
      pengeluaranPembiayaan?: Record<string, unknown>
    }
    const pendapatanApbd = toFiniteNumber(src.pendapatan?.apbd)
    const pendapatanApbdp = toFiniteNumber(src.pendapatan?.apbdp)
    const belanjaApbd = toFiniteNumber(src.belanja?.apbd)
    const belanjaApbdp = toFiniteNumber(src.belanja?.apbdp)
    const terimaApbd = toFiniteNumber(src.penerimaanPembiayaan?.apbd)
    const terimaApbdp = toFiniteNumber(src.penerimaanPembiayaan?.apbdp)
    const keluarApbd = toFiniteNumber(src.pengeluaranPembiayaan?.apbd)
    const keluarApbdp = toFiniteNumber(src.pengeluaranPembiayaan?.apbdp)

    if (
      [pendapatanApbd, pendapatanApbdp, belanjaApbd, belanjaApbdp, terimaApbd, terimaApbdp, keluarApbd, keluarApbdp].some(
        (v) => v === null,
      )
    ) {
      return NextResponse.json(
        { error: 'Seluruh nilai angka APBD wajib berupa angka yang valid' },
        { status: 400 },
      )
    }

    const values = {
      pendapatanApbd: pendapatanApbd as number,
      pendapatanApbdp: pendapatanApbdp as number,
      belanjaApbd: belanjaApbd as number,
      belanjaApbdp: belanjaApbdp as number,
      terimaApbd: terimaApbd as number,
      terimaApbdp: terimaApbdp as number,
      keluarApbd: keluarApbd as number,
      keluarApbdp: keluarApbdp as number,
    }

    // Upsert berdasarkan tahun
    const row = await db.apbdSummary.upsert({
      where: { year },
      update: values,
      create: { year, ...values },
    })
    return NextResponse.json({ data: toDto(row) })
  } catch (error) {
    console.error('POST /api/admin/apbd error', error)
    return NextResponse.json({ error: 'Gagal menyimpan data APBD' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireAdmin()
    if (!user) return unauthorized()

    const { searchParams } = new URL(req.url)
    const year = Number(searchParams.get('year'))
    if (!Number.isInteger(year) || year < 1900 || year > 2200) {
      return NextResponse.json({ error: 'Parameter year wajib diisi' }, { status: 400 })
    }

    await db.apbdSummary.deleteMany({ where: { year } })
    return NextResponse.json({ data: { ok: true } })
  } catch (error) {
    console.error('DELETE /api/admin/apbd error', error)
    return NextResponse.json({ error: 'Gagal menghapus data APBD' }, { status: 500 })
  }
}
