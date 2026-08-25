import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, unauthorized } from '@/lib/auth'

/** Daftar seluruh realisasi akun (semua scope) untuk kelola admin. */
export async function GET() {
  try {
    const admin = await requireAdmin()
    if (!admin) return unauthorized()

    const rows = await db.realisasiAkun.findMany({
      include: { opd: { select: { name: true } } },
      orderBy: [{ scope: 'asc' }, { year: 'desc' }, { code: 'asc' }],
    })
    const data = rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      group: r.group,
      level: r.level,
      opdName: r.opd?.name ?? null,
      year: r.year,
      periode: r.periode,
      anggaran: r.anggaran,
      realisasi: r.realisasi,
    }))
    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET /api/admin/realisasi-akun error', error)
    return NextResponse.json({ error: 'Gagal memuat realisasi akun' }, { status: 500 })
  }
}

/** Ubah anggaran/realisasi satu baris berdasarkan id. */
export async function PUT(req: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) return unauthorized()

    const body = (await req.json().catch(() => null)) as
      | { id?: unknown; anggaran?: unknown; realisasi?: unknown }
      | null

    const id = Number(body?.id)
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }
    const anggaran = Number(body?.anggaran)
    const realisasi = Number(body?.realisasi)
    if (!Number.isFinite(anggaran) || !Number.isFinite(realisasi) || anggaran < 0 || realisasi < 0) {
      return NextResponse.json({ error: 'Nilai tidak valid' }, { status: 400 })
    }

    const existing = await db.realisasiAkun.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Baris tidak ditemukan' }, { status: 404 })
    }

    const row = await db.realisasiAkun.update({
      where: { id },
      data: { anggaran, realisasi },
      include: { opd: { select: { name: true } } },
    })

    return NextResponse.json({
      data: {
        id: row.id,
        code: row.code,
        name: row.name,
        group: row.group,
        level: row.level,
        opdName: row.opd?.name ?? null,
        year: row.year,
        periode: row.periode,
        anggaran: row.anggaran,
        realisasi: row.realisasi,
      },
    })
  } catch (error) {
    console.error('PUT /api/admin/realisasi-akun error', error)
    return NextResponse.json({ error: 'Gagal menyimpan' }, { status: 500 })
  }
}

/** Hapus satu baris (?id=) atau seluruh data (?all=1). */
export async function DELETE(req: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin) return unauthorized()

    const url = new URL(req.url)
    if (url.searchParams.get('all') === '1') {
      await db.realisasiAkun.deleteMany({})
      return NextResponse.json({ data: { ok: true } })
    }

    const id = Number(url.searchParams.get('id'))
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: 'ID tidak valid' }, { status: 400 })
    }
    const existing = await db.realisasiAkun.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Baris tidak ditemukan' }, { status: 404 })
    }
    await db.realisasiAkun.delete({ where: { id } })
    return NextResponse.json({ data: { ok: true } })
  } catch (error) {
    console.error('DELETE /api/admin/realisasi-akun error', error)
    return NextResponse.json({ error: 'Gagal menghapus' }, { status: 500 })
  }
}
