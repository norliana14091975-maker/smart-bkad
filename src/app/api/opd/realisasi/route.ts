import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminUser, unauthorized } from '@/lib/auth'

interface GroupInput {
  anggaran: number
  realisasi: number
}

function parseGroup(value: unknown): GroupInput | null {
  if (typeof value !== 'object' || value === null) return null
  const g = value as Record<string, unknown>
  const anggaran = Number(g.anggaran)
  const realisasi = Number(g.realisasi)
  if (!Number.isFinite(anggaran) || !Number.isFinite(realisasi)) return null
  if (anggaran < 0 || realisasi < 0) return null
  return { anggaran, realisasi }
}

/**
 * OPD memperbarui anggaran & realisasinya sendiri (pendapatan, belanja,
 * pembiayaan). Baris RealisasiSkPD dicocokkan/dibuat berdasar nama OPD.
 */
export async function PUT(req: Request) {
  try {
    const user = await getAdminUser()
    if (!user || user.role !== 'opd' || !user.opdId) return unauthorized()

    const opd = await db.opd.findUnique({ where: { id: user.opdId } })
    if (!opd) return unauthorized()
    if (!opd.active) {
      return NextResponse.json({ error: 'Akun OPD dinonaktifkan' }, { status: 403 })
    }

    const body = (await req.json().catch(() => null)) as
      | { pendapatan?: unknown; belanja?: unknown; pembiayaan?: unknown }
      | null

    const pendapatan = parseGroup(body?.pendapatan)
    const belanja = parseGroup(body?.belanja)
    const pembiayaan = parseGroup(body?.pembiayaan)
    if (!pendapatan || !belanja || !pembiayaan) {
      return NextResponse.json(
        { error: 'Data anggaran/realisasi tidak valid (angka ≥ 0)' },
        { status: 400 },
      )
    }

    const row = await db.realisasiSkpd.upsert({
      where: { name: opd.name },
      update: {
        pendapatanAnggaran: pendapatan.anggaran,
        pendapatanRealisasi: pendapatan.realisasi,
        belanjaAnggaran: belanja.anggaran,
        belanjaRealisasi: belanja.realisasi,
        pembiayaanAnggaran: pembiayaan.anggaran,
        pembiayaanRealisasi: pembiayaan.realisasi,
      },
      create: {
        name: opd.name,
        pendapatanAnggaran: pendapatan.anggaran,
        pendapatanRealisasi: pendapatan.realisasi,
        belanjaAnggaran: belanja.anggaran,
        belanjaRealisasi: belanja.realisasi,
        pembiayaanAnggaran: pembiayaan.anggaran,
        pembiayaanRealisasi: pembiayaan.realisasi,
      },
    })

    return NextResponse.json({
      data: {
        pendapatan: { anggaran: row.pendapatanAnggaran, realisasi: row.pendapatanRealisasi },
        belanja: { anggaran: row.belanjaAnggaran, realisasi: row.belanjaRealisasi },
        pembiayaan: { anggaran: row.pembiayaanAnggaran, realisasi: row.pembiayaanRealisasi },
      },
    })
  } catch (error) {
    console.error('PUT /api/opd/realisasi error', error)
    return NextResponse.json({ error: 'Gagal menyimpan realisasi OPD' }, { status: 500 })
  }
}
