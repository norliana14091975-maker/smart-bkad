import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sumByPrefix } from '@/lib/import-lra'
import type { RealisasiAkunDto } from '@/types/budget'

interface AggRow {
  code: string
  name: string
  group: string
  level: number
  anggaran: number
  realisasi: number
}

/**
 * Realisasi per-akun untuk dashboard publik.
 * - ?opdId=N  : hanya baris milik OPD tersebut.
 * - tanpa param: bila ada data OPD manapun → agregat (jumlah lintas OPD) per
 *   kode; bila belum ada → tampilkan data konsolidasi (scope global).
 */
export async function GET(request: NextRequest) {
  try {
    const opdParam = request.nextUrl.searchParams.get('opdId')

    let dbRows
    if (opdParam !== null) {
      const n = Number(opdParam)
      dbRows = Number.isInteger(n) && n > 0
        ? await db.realisasiAkun.findMany({ where: { scope: `opd:${n}` } })
        : []
    } else {
      const all = await db.realisasiAkun.findMany()
      const hasOpdRows = all.some((r) => r.scope !== 'global')
      dbRows = hasOpdRows
        ? all.filter((r) => r.scope !== 'global')
        : all.filter((r) => r.scope === 'global')
    }

    // Urutkan menurut kode (kode 2-digit berisi nol sehingga urut leksikografis aman)
    dbRows.sort((a, b) => a.code.localeCompare(b.code))

    // Agregasi per kode (menjumlahkan lintas OPD)
    const agg = new Map<string, AggRow>()
    for (const r of dbRows) {
      const ex = agg.get(r.code)
      if (ex) {
        ex.anggaran += r.anggaran
        ex.realisasi += r.realisasi
      } else {
        agg.set(r.code, {
          code: r.code,
          name: r.name,
          group: r.group,
          level: r.level,
          anggaran: r.anggaran,
          realisasi: r.realisasi,
        })
      }
    }
    const rows = [...agg.values()]

    const data: RealisasiAkunDto[] = rows.map((r) => ({
      code: r.code,
      name: r.name,
      group: r.group,
      level: r.level,
      anggaran: r.anggaran,
      realisasi: r.realisasi,
      pct: r.anggaran > 0 ? (r.realisasi / r.anggaran) * 100 : 0,
    }))

    // Ringkasan: jumlahkan pada level terendah tiap kelompok agar tidak dobel
    const totalApbd = sumByPrefix(rows, '5', 'anggaran') + sumByPrefix(rows, '6.2', 'anggaran')
    const totalPenerimaan =
      sumByPrefix(rows, '4', 'realisasi') + sumByPrefix(rows, '6.1', 'realisasi')
    const totalPengeluaran =
      sumByPrefix(rows, '5', 'realisasi') + sumByPrefix(rows, '6.2', 'realisasi')

    return NextResponse.json({
      data,
      summary: {
        totalApbd,
        totalRealisasiPenerimaan: totalPenerimaan,
        totalRealisasiPengeluaran: totalPengeluaran,
        silpa: totalPenerimaan - totalPengeluaran,
      },
    })
  } catch (error) {
    console.error('GET /api/realisasi/akun error', error)
    return NextResponse.json({ error: 'Gagal memuat realisasi per akun' }, { status: 500 })
  }
}
