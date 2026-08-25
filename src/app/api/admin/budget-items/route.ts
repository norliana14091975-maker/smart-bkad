import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, unauthorized } from '@/lib/auth'
import type { BudgetItemRowDto } from '@/types/budget'

type BudgetItemRow = {
  id: number
  section: string
  tab: string
  code: string
  name: string
  year: number
  amount: number
}

export async function GET(req: Request) {
  try {
    const user = await requireAdmin()
    if (!user) return unauthorized()

    const { searchParams } = new URL(req.url)
    const section = searchParams.get('section')?.trim() ?? ''
    const tab = searchParams.get('tab')?.trim() ?? ''
    const yearParam = searchParams.get('year')?.trim() ?? ''

    // Filter dinamis; year 'semua'/kosong/non-numerik → tanpa filter tahun
    const where: { section?: string; tab?: string; year?: number } = {}
    if (section) where.section = section
    if (tab) where.tab = tab
    const year = Number(yearParam)
    if (yearParam && yearParam !== 'semua' && Number.isInteger(year)) {
      where.year = year
    }

    const rows: BudgetItemRow[] = await db.budgetItem.findMany({
      where,
      orderBy: [{ code: 'asc' }, { year: 'asc' }, { id: 'asc' }],
    })
    return NextResponse.json({ data: rows })
  } catch (error) {
    console.error('GET /api/admin/budget-items error', error)
    return NextResponse.json({ error: 'Gagal memuat item anggaran' }, { status: 500 })
  }
}

/** Validasi payload item anggaran; mengembalikan error Indonesia jika tidak valid. */
function validateBody(body: Record<string, unknown>): string | null {
  const section = typeof body.section === 'string' ? body.section.trim() : ''
  const tab = typeof body.tab === 'string' ? body.tab.trim() : ''
  const code = typeof body.code === 'string' ? body.code.trim() : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const year = Number(body.year)
  const amount = Number(body.amount)

  if (!section || !tab) return 'Section dan tab wajib diisi'
  if (!code) return 'Kode rekening wajib diisi'
  if (!name) return 'Nama/uraian wajib diisi'
  if (!Number.isInteger(year) || year < 1900 || year > 2200) return 'Tahun tidak valid'
  if (!Number.isFinite(amount)) return 'Nilai anggaran wajib berupa angka'
  return null
}

export async function POST(req: Request) {
  try {
    const user = await requireAdmin()
    if (!user) return unauthorized()

    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
    if (!body) {
      return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 })
    }
    const invalid = validateBody(body)
    if (invalid) {
      return NextResponse.json({ error: invalid }, { status: 400 })
    }

    const row = await db.budgetItem.create({
      data: {
        section: (body.section as string).trim(),
        tab: (body.tab as string).trim(),
        code: (body.code as string).trim(),
        name: (body.name as string).trim(),
        year: Number(body.year),
        amount: Number(body.amount),
      },
    })
    return NextResponse.json({ data: row })
  } catch (error) {
    // Pelanggaran unique constraint (section, tab, code, year)
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'Item dengan kode dan tahun tersebut sudah ada' },
        { status: 400 },
      )
    }
    console.error('POST /api/admin/budget-items error', error)
    return NextResponse.json({ error: 'Gagal menambah item anggaran' }, { status: 500 })
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
      return NextResponse.json({ error: 'ID item tidak valid' }, { status: 400 })
    }
    const invalid = validateBody(body)
    if (invalid) {
      return NextResponse.json({ error: invalid }, { status: 400 })
    }

    const existing = await db.budgetItem.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Item anggaran tidak ditemukan' }, { status: 404 })
    }

    const row = await db.budgetItem.update({
      where: { id },
      data: {
        section: (body.section as string).trim(),
        tab: (body.tab as string).trim(),
        code: (body.code as string).trim(),
        name: (body.name as string).trim(),
        year: Number(body.year),
        amount: Number(body.amount),
      },
    })
    return NextResponse.json({ data: row })
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'Item dengan kode dan tahun tersebut sudah ada' },
        { status: 400 },
      )
    }
    console.error('PUT /api/admin/budget-items error', error)
    return NextResponse.json({ error: 'Gagal memperbarui item anggaran' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireAdmin()
    if (!user) return unauthorized()

    const { searchParams } = new URL(req.url)

    // all=1 → hapus SELURUH item anggaran (semua bagian, tab, dan tahun)
    if (searchParams.get('all') === '1') {
      const res = await db.budgetItem.deleteMany({})
      return NextResponse.json({ data: { ok: true, deleted: res.count } })
    }

    // Hapus per cakupan (section+tab+year) bila ketiga filter diberikan
    const section = searchParams.get('section')?.trim() ?? ''
    const tab = searchParams.get('tab')?.trim() ?? ''
    const year = Number(searchParams.get('year'))
    if (section && tab && Number.isInteger(year) && year >= 1900 && year <= 2200) {
      const res = await db.budgetItem.deleteMany({ where: { section, tab, year } })
      return NextResponse.json({ data: { ok: true, deleted: res.count } })
    }

    const id = Number(searchParams.get('id'))
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: 'Parameter id wajib diisi' }, { status: 400 })
    }

    const existing = await db.budgetItem.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Item anggaran tidak ditemukan' }, { status: 404 })
    }

    await db.budgetItem.delete({ where: { id } })
    return NextResponse.json({ data: { ok: true } })
  } catch (error) {
    console.error('DELETE /api/admin/budget-items error', error)
    return NextResponse.json({ error: 'Gagal menghapus item anggaran' }, { status: 500 })
  }
}
