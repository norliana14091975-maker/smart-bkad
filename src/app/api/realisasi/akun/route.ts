import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sumByPrefix } from '@/lib/import-lra'
import { periodeLabel } from '@/lib/periode'
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
 * Realisasi per-akun untuk dashboard publik dengan filter periode.
 * - ?opdId=N        : hanya baris milik OPD tersebut
 * - ?periode=N|all  : periode kumulatif s.d. bulan ke-N; 'all' (default) =
 *                     periode TERAKHIR yang tersedia per OPD (konsolidasi)
 * - ?compare=1      : sertakan ringkasan pembanding antar periode tersedia
 *                     (bulanan/triwulan/semester) untuk perbandingan Kepala Daerah
 * Data mengikuti TAHUN ANGGARAN TERBARU hasil import LRA (tahun anggaran
 * dibaca dari dokumen); import tahun lama tersimpan sebagai pembanding.
 * meta menjelaskan mode agregasi + daftar OPD + tahun & periode aktif.
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams
    const opdParam = sp.get('opdId')
    const periodeParam = sp.get('periode') ?? 'all'
    const withCompare = sp.get('compare') === '1'

    let dbRows
    let mode: 'opd' | 'aggregate' | 'global'
    const opdIds = new Set<number>()

    if (opdParam !== null) {
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

    // --- Penentuan tahun anggaran aktif ---
    // Gunakan tahun anggaran TERBARU yang tersedia (data tahun lama tidak
    // tercampur); bila OPD tak punya data tahun tsb, fallback tahun terbesar
    // yang dimilikinya ditangani filter periode di bawah.
    const activeYear = dbRows.length > 0 ? Math.max(...dbRows.map((r) => r.year)) : null
    dbRows = activeYear !== null ? dbRows.filter((r) => r.year === activeYear) : []

    // --- Penentuan periode aktif ---
    // 'all' → per OPD ambil periode terbesarnya (LRA terbaru yang diimpor);
    // angka → semua OPD dipaksa ke periode tersebut (bila OPD belum punya
    // data pada periode itu, barisnya tidak ikut).
    let periodeAktif: number | null = null
    const periodeByOpd = new Map<number, number>()
    if (mode === 'opd') {
      const n = Number(opdParam)
      const perOpd = dbRows
        .filter((r) => r.scope === `opd:${n}`)
        .map((r) => r.periode)
      if (perOpd.length > 0) periodeAktif = Math.max(...perOpd)
    } else if (mode === 'aggregate') {
      for (const r of dbRows) {
        if (r.opdId) {
          const cur = periodeByOpd.get(r.opdId) ?? 0
          periodeByOpd.set(r.opdId, Math.max(cur, r.periode))
        }
      }
      // label ringkas: periode terbesar di antara OPD (informasi "terbaru")
      const allPeriodes = [...periodeByOpd.values()]
      if (allPeriodes.length > 0) periodeAktif = Math.max(...allPeriodes)
    } else {
      const per = dbRows.map((r) => r.periode)
      if (per.length > 0) periodeAktif = Math.max(...per)
    }

    if (periodeParam !== 'all') {
      const n = Number(periodeParam)
      if (Number.isInteger(n) && n >= 1 && n <= 12) {
        periodeAktif = n
        // mode aggregate: tiap OPD hanya ikut bila punya periode tsb;
        // bila tidak ada, fallback ke periode terdekat yang lebih kecil
        if (mode === 'aggregate') {
          const adjusted = new Map<number, number>()
          for (const [opdId, maxP] of periodeByOpd) {
            const own = dbRows
              .filter((r) => r.opdId === opdId)
              .map((r) => r.periode)
              .sort((a, b) => b - a)
              .find((p) => p <= n)
            adjusted.set(opdId, own ?? maxP)
          }
          periodeByOpd.clear()
          for (const [k, v] of adjusted) periodeByOpd.set(k, v)
        }
      }
    }

    // --- Filter baris sesuai periode ---
    const filtered =
      mode === 'opd' || mode === 'global'
        ? dbRows.filter((r) => (periodeAktif === null ? true : r.periode === periodeAktif))
        : dbRows.filter((r) => {
            const target = periodeByOpd.get(r.opdId ?? -1)
            return target !== undefined && r.periode === target
          })

    filtered.sort((a, b) => a.code.localeCompare(b.code))

    // --- Agregasi per kode ---
    const agg = new Map<string, AggRow>()
    for (const r of filtered) {
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

    // Nama OPD penyusun
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

    const totalApbd = sumByPrefix(rows, '5', 'anggaran') + sumByPrefix(rows, '6.2', 'anggaran')
    const totalPenerimaan =
      sumByPrefix(rows, '4', 'realisasi') + sumByPrefix(rows, '6.1', 'realisasi')
    const totalPengeluaran =
      sumByPrefix(rows, '5', 'realisasi') + sumByPrefix(rows, '6.2', 'realisasi')

    // --- Pembanding antar periode (untuk Kepala Daerah) ---
    let compare: { periode: number; label: string; penerimaan: number; pengeluaran: number; tersedia: boolean }[] | undefined
    if (withCompare) {
      const comparePeriodes = [3, 6, 9, 12]
      compare = comparePeriodes.map((p) => {
        // Kartu pembanding = total kumulatif seluruh data pada tahun aktif
        // dan periode p (tiap OPD menyumbang datanya sendiri pada periode tsb)
        const subset = dbRows.filter((r) => r.periode === p)
        const aggC = new Map<string, { code: string; level: number; anggaran: number; realisasi: number }>()
        for (const r of subset) {
          const ex = aggC.get(r.code)
          if (ex) {
            ex.anggaran += r.anggaran
            ex.realisasi += r.realisasi
          } else {
            aggC.set(r.code, { code: r.code, level: r.level, anggaran: r.anggaran, realisasi: r.realisasi })
          }
        }
        const cRows = [...aggC.values()]
        return {
          periode: p,
          label: periodeLabel(p),
          penerimaan:
            sumByPrefix(cRows, '4', 'realisasi') + sumByPrefix(cRows, '6.1', 'realisasi'),
          pengeluaran:
            sumByPrefix(cRows, '5', 'realisasi') + sumByPrefix(cRows, '6.2', 'realisasi'),
          tersedia: cRows.length > 0,
        }
      })
    }

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
        year: activeYear,
        periode: periodeAktif,
        periodeLabel: periodeAktif ? periodeLabel(periodeAktif) : null,
      },
      ...(compare ? { compare } : {}),
    })
  } catch (error) {
    console.error('GET /api/realisasi/akun error', error)
    return NextResponse.json({ error: 'Gagal memuat realisasi per akun' }, { status: 500 })
  }
}
