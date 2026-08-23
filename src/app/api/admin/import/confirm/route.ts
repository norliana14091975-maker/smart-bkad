import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminUser, unauthorized } from '@/lib/auth'

/**
 * Tentukan kelompok rekening dari awalan kode:
 * '4' → PENDAPATAN, '5' → BELANJA, sisanya (termasuk '6') → PEMBIAYAAN.
 */
function groupFromCode(code: string): string {
  if (code.startsWith('4')) return 'PENDAPATAN'
  if (code.startsWith('5')) return 'BELANJA'
  return 'PEMBIAYAAN'
}

/**
 * Ubah nilai (number/string) menjadi angka polos.
 * Mendukung format Indonesia: "49.898.218.773.411,00" → 49898218773411.
 */
function parseLooseNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value !== 'string') return null

  let s = value.trim().replace(/^rp\.?\s*/i, '').replace(/\s|\u00a0/g, '')
  if (!s) return null

  const negative = s.startsWith('(') && s.endsWith(')')
  if (negative) s = s.slice(1, -1)
  if (!/^\d+(\.\d+)*(,\d+)*$/.test(s)) return null

  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')

  if (lastDot !== -1 && lastComma !== -1) {
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      s = s.replace(/,/g, '')
    }
  } else if (lastComma !== -1) {
    s = s.replace(',', '.')
  } else if (lastDot !== -1 && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, '')
  }

  const n = Number(s)
  if (!Number.isFinite(n)) return null
  return negative ? -n : n
}

interface NormalizedItem {
  code: string
  name: string
  anggaran: number
  realisasi: number
}

/** Validasi satu item hasil ekstraksi (code non-kosong, angka berhingga ≥ 0). */
function normalizeItem(entry: unknown): NormalizedItem | null {
  if (typeof entry !== 'object' || entry === null) return null
  const e = entry as Record<string, unknown>

  const code =
    typeof e.code === 'string'
      ? e.code.trim()
      : typeof e.code === 'number'
        ? String(e.code)
        : ''
  if (!code) return null

  const anggaran = parseLooseNumber(e.anggaran)
  const realisasi = parseLooseNumber(e.realisasi)
  if (anggaran === null || realisasi === null) return null
  if (anggaran < 0 || realisasi < 0) return null

  const name =
    typeof e.name === 'string'
      ? e.name.trim()
      : e.name != null
        ? String(e.name).trim()
        : ''

  return { code, name, anggaran, realisasi }
}

export async function POST(req: Request) {
  try {
    const user = await getAdminUser()
    if (!user) return unauthorized()

    const body = (await req.json().catch(() => null)) as
      | { importLogId?: unknown; items?: unknown; mode?: unknown }
      | null

    const importLogId = Number(body?.importLogId)
    if (!Number.isInteger(importLogId) || importLogId <= 0) {
      return NextResponse.json({ error: 'ID log import tidak valid' }, { status: 400 })
    }

    const mode = body?.mode
    if (mode !== 'replace' && mode !== 'append') {
      return NextResponse.json(
        { error: 'Mode penyimpanan harus replace atau append' },
        { status: 400 },
      )
    }

    if (!Array.isArray(body?.items)) {
      return NextResponse.json({ error: 'Data items tidak valid' }, { status: 400 })
    }

    // Validasi, normalisasi, dan dedupe by kode (item terakhir menang)
    const merged = new Map<string, NormalizedItem>()
    for (const entry of body.items) {
      const item = normalizeItem(entry)
      if (item) merged.set(item.code, item)
    }

    const rows = [...merged.values()].map((item) => ({
      code: item.code,
      name: item.name,
      group: groupFromCode(item.code),
      anggaran: item.anggaran,
      realisasi: item.realisasi,
    }))

    let saved = 0
    if (mode === 'replace') {
      // Ganti seluruh data realisasi akun
      await db.realisasiAkun.deleteMany({})
      if (rows.length > 0) {
        await db.realisasiAkun.createMany({ data: rows })
      }
      saved = rows.length
    } else {
      // Tambah/perbarui (upsert) berdasarkan kode rekening
      for (const row of rows) {
        await db.realisasiAkun.upsert({
          where: { code: row.code },
          update: {
            name: row.name,
            group: row.group,
            anggaran: row.anggaran,
            realisasi: row.realisasi,
          },
          create: row,
        })
      }
      saved = rows.length
    }

    // Perbarui status log import
    await db.importLog.updateMany({
      where: { id: importLogId },
      data: { status: 'confirmed', records: saved },
    })

    return NextResponse.json({ data: { saved } })
  } catch (error) {
    console.error('POST /api/admin/import/confirm error', error)
    return NextResponse.json({ error: 'Gagal menyimpan hasil import' }, { status: 500 })
  }
}
