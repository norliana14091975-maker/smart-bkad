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
 * - tanpa param: kumpulan SELURUH OPD menjadi satu — setiap kode rekening
 *   dijumlahkan lintas OPD (scope opd:<id>). Bila belum ada OPD yang mengimpor
 *   LRA, tampilkan data konsolidasi (scope global) sebagai fallback.
 * Respons menyertakan `meta` (mode agregasi + daftar OPD penyusun) agar
 * tampilan publik dapat menampilkan asal data.
 */
export async function GET(request: NextRequest) {
  try {
    const opdParam = request.nextUrl.searchParams.get('opdId')

    let dbRows
    let mode: 'opd' | 'aggregate' | 'global'
    const opdIds = new Set<number>()

    if (opdParam !== null) {
      // Tampilan satu OPD (dashboard OPD / dialog rincian SKPD)
      mode = 'opd'
      const n = Number(opdParam)
      dbRows =
        Number.isInteger(n) && n > 0
          ? await db.realisasiAkun.findMany({ where: { scope: `opd:${n}` } })
          : []
    } else {
      const all = await db.realisasiAkun.findMany()
      const opdRows = all.filter((r) => r.scope !== 'global')
      if (opdRows.length > 0) {
        // Kumpulan semua OPD menjadi satu konsolidasi
        mode = 'aggregate'
        dbRows = opdRows
        for (const r of opdRows) {
          if (r.opdId) opdIds.add(r.opdId)
        }
      } else {
        mode = 'global'
        dbRows = all.filter((r) => r.scope === 'global')
      }
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

    // Nama OPD penyusun konsolidasi (untuk keterangan tampilan)
    let opdNames: string[] = []
    if (opdIds.size > 0) {
      const opds = await db.opd.findMany({
        where: { id: { in: [...opdIds] } },
        select: { name: true },
        orderBy: { name: 'asc' },
      })
      opdNames = opds.map((o) => o.name)
    }

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
      meta: {
        mode,
        opdCount: opdIds.size,
        opdNames,
      },
    })
  } catch (error) {
    console.error('GET /api/realisasi/akun error', error)
    return NextResponse.json({ error: 'Gagal memuat realisasi per akun' }, { status: 500 })
  }
}
