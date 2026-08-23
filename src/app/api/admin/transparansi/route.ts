import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminUser, unauthorized } from '@/lib/auth'
import type { TransparansiRowDto } from '@/types/budget'

const VALID_TYPES = ['APBD', 'Realisasi'] as const

export async function GET(req: Request) {
  try {
    const user = await getAdminUser()
    if (!user) return unauthorized()

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')?.trim() ?? ''

    const rows = await db.transparansiDoc.findMany({
      where: type ? { type } : undefined,
      orderBy: { id: 'asc' },
    })
    return NextResponse.json({ data: rows })
  } catch (error) {
    console.error('GET /api/admin/transparansi error', error)
    return NextResponse.json({ error: 'Gagal memuat dokumen transparansi' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const user = await getAdminUser()
    if (!user) return unauthorized()

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) {
      return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 })
    }

    const type = typeof body.type === 'string' ? body.type.trim() : ''
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    const url = typeof body.url === 'string' ? body.url.trim() : '#'

    if (!VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
      return NextResponse.json(
        { error: 'Tipe dokumen harus APBD atau Realisasi' },
        { status: 400 },
      )
    }
    if (!title) {
      return NextResponse.json({ error: 'Judul dokumen wajib diisi' }, { status: 400 })
    }
    if (!url) {
      return NextResponse.json({ error: 'URL dokumen wajib diisi' }, { status: 400 })
    }

    const row = await db.transparansiDoc.create({ data: { type, title, url } })
    return NextResponse.json({ data: row })
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'Dokumen dengan judul tersebut sudah ada' },
        { status: 400 },
      )
    }
    console.error('POST /api/admin/transparansi error', error)
    return NextResponse.json({ error: 'Gagal menambah dokumen transparansi' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getAdminUser()
    if (!user) return unauthorized()

    const { searchParams } = new URL(req.url)
    const id = Number(searchParams.get('id'))
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: 'Parameter id wajib diisi' }, { status: 400 })
    }

    const existing = await db.transparansiDoc.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Dokumen tidak ditemukan' }, { status: 404 })
    }

    await db.transparansiDoc.delete({ where: { id } })
    return NextResponse.json({ data: { ok: true } })
  } catch (error) {
    console.error('DELETE /api/admin/transparansi error', error)
    return NextResponse.json({ error: 'Gagal menghapus dokumen transparansi' }, { status: 500 })
  }
}
