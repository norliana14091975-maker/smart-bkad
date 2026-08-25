import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, unauthorized } from '@/lib/auth'
import { confirmLra, scopeFor } from '@/lib/import-lra'

/**
 * Konfirmasi hasil import LRA (admin). Body:
 * { importLogId, items, mode: 'replace' | 'append', opdId? }
 * opdId kosong → konsolidasi (scope global).
 */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin()
    if (!admin) return unauthorized()

    const body = (await req.json().catch(() => null)) as
      | { importLogId?: unknown; items?: unknown; mode?: unknown; opdId?: unknown; periode?: unknown }
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

    // Pastikan log import ada
    const log = await db.importLog.findUnique({ where: { id: importLogId } })
    if (!log) {
      return NextResponse.json({ error: 'Log import tidak ditemukan' }, { status: 400 })
    }

    // OPD tujuan (opsional untuk admin)
    let opdId: number | null = null
    if (body?.opdId !== null && body?.opdId !== undefined && body?.opdId !== '') {
      const n = Number(body.opdId)
      if (Number.isInteger(n) && n > 0) {
        const opd = await db.opd.findUnique({ where: { id: n } })
        if (opd) opdId = n
      }
    }

    // Periode dari log import (dipakai sebagai kunci penyimpanan)
    const periodeNum = Number(body?.periode)
    const periode =
      Number.isInteger(periodeNum) && periodeNum >= 1 && periodeNum <= 12
        ? periodeNum
        : (log.periode ?? 12)

    const scope = scopeFor(opdId)
    const { saved } = await confirmLra({
      items: body?.items,
      mode,
      scope,
      opdId,
      importLogId,
      periode,
    })

    return NextResponse.json({ data: { saved } })
  } catch (error) {
    console.error('POST /api/admin/import/confirm error', error)
    return NextResponse.json({ error: 'Gagal menyimpan hasil import' }, { status: 500 })
  }
}
