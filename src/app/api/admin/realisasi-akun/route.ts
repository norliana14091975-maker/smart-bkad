import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminUser, unauthorized } from '@/lib/auth'
import type { RealisasiAkunRowDto } from '@/types/budget'

type AkunRow = {
  id: number
  code: string
  name: string
  group: string
  anggaran: number
  realisasi: number
}

export async function GET() {
  try {
    const user = await getAdminUser()
    if (!user) return unauthorized()

    const rows: AkunRow[] = await db.realisasiAkun.findMany({
      orderBy: { code: 'asc' },
    })
    return NextResponse.json({ data: rows })
  } catch (error) {
    console.error('GET /api/admin/realisasi-akun error', error)
    return NextResponse.json({ error: 'Gagal memuat realisasi akun' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const user = await getAdminUser()
    if (!user) return unauthorized()

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) {
      return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 })
    }

    const id = Number(body.id)
    const anggaran = Number(body.anggaran)
    const realisasi = Number(body.realisasi)

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: 'ID baris tidak valid' }, { status: 400 })
    }
    if (!Number.isFinite(anggaran) || !Number.isFinite(realisasi)) {
      return NextResponse.json(
        { error: 'Anggaran dan realisasi wajib berupa angka' },
        { status: 400 },
      )
    }

    const existing = await db.realisasiAkun.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Baris realisasi tidak ditemukan' }, { status: 404 })
    }

    const row = await db.realisasiAkun.update({
      where: { id },
      data: { anggaran, realisasi },
    })
    return NextResponse.json({ data: row })
  } catch (error) {
    console.error('PUT /api/admin/realisasi-akun error', error)
    return NextResponse.json({ error: 'Gagal memperbarui realisasi akun' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getAdminUser()
    if (!user) return unauthorized()

    const { searchParams } = new URL(req.url)
    const all = searchParams.get('all')
    const idParam = searchParams.get('id')

    if (all === '1') {
      // Hapus seluruh data realisasi akun
      await db.realisasiAkun.deleteMany({})
      return NextResponse.json({ data: { ok: true } })
    }

    const id = Number(idParam)
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { error: 'Parameter id wajib diisi (atau all=1 untuk semua)' },
        { status: 400 },
      )
    }

    const existing = await db.realisasiAkun.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Baris realisasi tidak ditemukan' }, { status: 404 })
    }

    await db.realisasiAkun.delete({ where: { id } })
    return NextResponse.json({ data: { ok: true } })
  } catch (error) {
    console.error('DELETE /api/admin/realisasi-akun error', error)
    return NextResponse.json({ error: 'Gagal menghapus realisasi akun' }, { status: 500 })
  }
}
