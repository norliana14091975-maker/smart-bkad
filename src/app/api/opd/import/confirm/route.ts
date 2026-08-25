import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getAdminUser, unauthorized } from '@/lib/auth'
import { confirmLra, scopeFor } from '@/lib/import-lra'

/**
 * Konfirmasi hasil import LRA untuk OPD yang sedang login.
 * Scope dipaksa mengikuti OPD — body cukup { importLogId, items, mode }.
 */
export async function POST(req: Request) {
  try {
    const user = await getAdminUser()
    if (!user || user.role !== 'opd' || !user.opdId) return unauthorized()

    const opd = await db.opd.findUnique({ where: { id: user.opdId } })
    if (!opd) return unauthorized()
    if (!opd.active) {
      return NextResponse.json({ error: 'Akun OPD dinonaktifkan' }, { status: 403 })
    }

    const body = (await req.json().catch(() => null)) as
      | { importLogId?: unknown; items?: unknown; mode?: unknown; periode?: unknown }
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

    // Pastikan log import milik OPD ini (OPD tidak bisa mengonfirmasi log OPD lain)
    const log = await db.importLog.findUnique({ where: { id: importLogId } })
    if (!log || log.opdId !== opd.id) {
      return NextResponse.json({ error: 'Log import tidak ditemukan untuk OPD ini' }, { status: 400 })
    }

    // Periode mengikuti log import milik OPD (dipakai sebagai kunci simpan)
    const periodeNum = Number(body?.periode)
    const periode =
      Number.isInteger(periodeNum) && periodeNum >= 1 && periodeNum <= 12
        ? periodeNum
        : (log.periode ?? 12)

    const scope = scopeFor(opd.id)
    const { saved } = await confirmLra({
      items: body?.items,
      mode,
      scope,
      opdId: opd.id,
      importLogId,
      periode,
    })

    return NextResponse.json({ data: { saved } })
  } catch (error) {
    console.error('POST /api/opd/import/confirm error', error)
    return NextResponse.json({ error: 'Gagal menyimpan hasil import' }, { status: 500 })
  }
}
