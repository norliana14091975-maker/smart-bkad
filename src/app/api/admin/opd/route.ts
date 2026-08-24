import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, unauthorized } from '@/lib/auth'
import { createOpdWithUser } from '@/lib/opd'
import type { OpdRowDto } from '@/types/budget'

function toRow(opd: { id: number; code: string; name: string; active: boolean; createdAt: Date; user: { username: string } | null }): OpdRowDto {
  return {
    id: opd.id,
    code: opd.code,
    name: opd.name,
    active: opd.active,
    username: opd.user?.username ?? null,
    createdAt: opd.createdAt.toISOString(),
  }
}

/** Daftar seluruh OPD/SKPD beserta akun loginnya. */
export async function GET() {
  try {
    const admin = await requireAdmin()
    if (!admin) return unauthorized()

    const opds = await db.opd.findMany({
      include: { user: { select: { username: true } } },
      orderBy: { id: 'asc' },
    })
    const data = opds.map(toRow)
    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET /api/admin/opd error', error)
    return NextResponse.json({ error: 'Gagal memuat data OPD' }, { status: 500 })
  }
}

/**
 * Tambah OPD/SKPD — otomatis membuat akun login untuk OPD tersebut.
 * Password hanya dikembalikan sekali di respons ini.
 */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin()
    if (!admin) return unauthorized()

    const body = (await req.json().catch(() => null)) as
      | { name?: unknown; code?: unknown }
      | null

    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const code = typeof body?.code === 'string' && body.code.trim() ? body.code.trim() : undefined

    if (!name) {
      return NextResponse.json({ error: 'Nama OPD/SKPD wajib diisi' }, { status: 400 })
    }
    if (name.length > 120) {
      return NextResponse.json({ error: 'Nama OPD maksimal 120 karakter' }, { status: 400 })
    }
    if (await db.opd.findUnique({ where: { name } })) {
      return NextResponse.json({ error: 'Nama OPD/SKPD sudah terdaftar' }, { status: 400 })
    }
    if (code && (await db.opd.findUnique({ where: { code } }))) {
      return NextResponse.json({ error: `Kode ${code} sudah dipakai OPD lain` }, { status: 400 })
    }

    const { opd, username, password } = await createOpdWithUser(code, name)
    const row = await db.opd.findUnique({
      where: { id: opd.id },
      include: { user: { select: { username: true } } },
    })

    return NextResponse.json({
      data: {
        opd: row ? toRow(row) : null,
        credentials: { opdName: name, username, password },
      },
    })
  } catch (error) {
    console.error('POST /api/admin/opd error', error)
    return NextResponse.json({ error: 'Gagal menambah OPD' }, { status: 500 })
  }
}

/** Ubah kode/nama OPD (nama lama di RealisasiSkPD ikut diperbarui). */
export async function PUT(req: Request) {
  try {
    const admin = await requireAdmin()
    if (!admin) return unauthorized()

    const body = (await req.json().catch(() => null)) as
      | { id?: unknown; name?: unknown; code?: unknown }
      | null

    const id = Number(body?.id)
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: 'ID OPD tidak valid' }, { status: 400 })
    }
    const opd = await db.opd.findUnique({ where: { id } })
    if (!opd) {
      return NextResponse.json({ error: 'OPD tidak ditemukan' }, { status: 404 })
    }

    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const code = typeof body?.code === 'string' && body.code.trim() ? body.code.trim() : undefined
    if (!name) {
      return NextResponse.json({ error: 'Nama OPD wajib diisi' }, { status: 400 })
    }
    if (name !== opd.name) {
      const dup = await db.opd.findUnique({ where: { name } })
      if (dup && dup.id !== id) {
        return NextResponse.json({ error: 'Nama OPD/SKPD sudah dipakai lainnya' }, { status: 400 })
      }
    }
    if (code && code !== opd.code) {
      const dup = await db.opd.findUnique({ where: { code } })
      if (dup && dup.id !== id) {
        return NextResponse.json({ error: `Kode ${code} sudah dipakai OPD lain` }, { status: 400 })
      }
    }

    const updated = await db.$transaction(async (tx) => {
      // Pertahankan tautan data realisasi bila nama berubah
      if (name !== opd.name) {
        await tx.realisasiSkpd.updateMany({ where: { name: opd.name }, data: { name } })
      }
      return tx.opd.update({
        where: { id },
        data: { name, ...(code ? { code } : {}) },
        include: { user: { select: { username: true } } },
      })
    })

    return NextResponse.json({ data: toRow(updated) })
  } catch (error) {
    console.error('PUT /api/admin/opd error', error)
    return NextResponse.json({ error: 'Gagal memperbarui OPD' }, { status: 500 })
  }
}

/** Hapus OPD beserta akun loginnya (sesi ikut terhapus via cascade). */
export async function DELETE(req: Request) {
  try {
    const admin = await requireAdmin()
    if (!admin) return unauthorized()

    const url = new URL(req.url)
    const id = Number(url.searchParams.get('id'))
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: 'ID OPD tidak valid' }, { status: 400 })
    }
    const opd = await db.opd.findUnique({ where: { id } })
    if (!opd) {
      return NextResponse.json({ error: 'OPD tidak ditemukan' }, { status: 404 })
    }

    await db.opd.delete({ where: { id } })
    return NextResponse.json({ data: { ok: true } })
  } catch (error) {
    console.error('DELETE /api/admin/opd error', error)
    return NextResponse.json({ error: 'Gagal menghapus OPD' }, { status: 500 })
  }
}
