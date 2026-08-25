import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getLraSync, lraTotal, metaFrom } from '@/lib/lra-sync'
import type { ApbdSummaryDto } from '@/types/budget'

/**
 * Ringkasan APBD tahunan untuk dashboard publik.
 * Baris tahun anggaran berjalan (tahun terbesar) disinkronkan dengan data
 * LRA yang masuk (agregat seluruh OPD pada periode terakhir masing-masing):
 * kolom APBD dihitung ulang dari LRA; APBDP (perubahan) tetap dari baseline.
 */
export async function GET() {
  try {
    const [rows, sync] = await Promise.all([
      db.apbdSummary.findMany({ orderBy: { year: 'desc' } }),
      getLraSync(),
    ])

    const currentYear = rows.reduce((m, r) => Math.max(m, r.year), 0)

    let synced = false
    const data: ApbdSummaryDto[] = rows.map((r) => {
      if (!sync.available || r.year !== currentYear) {
        return {
          year: r.year,
          pendapatan: { apbd: r.pendapatanApbd, apbdp: r.pendapatanApbdp },
          belanja: { apbd: r.belanjaApbd, apbdp: r.belanjaApbdp },
          penerimaanPembiayaan: { apbd: r.terimaApbd, apbdp: r.terimaApbdp },
          pengeluaranPembiayaan: { apbd: r.keluarApbd, apbdp: r.keluarApbdp },
        }
      }

      // Sinkronisasi anggaran TA berjalan dari LRA terimport
      const pendApbd = lraTotal(sync.rows, '4', 'anggaran')
      const belApbd = lraTotal(sync.rows, '5', 'anggaran')
      const has61 = sync.rows.some((x) => x.code === '6.1' || x.code.startsWith('6.1.'))
      const has62 = sync.rows.some((x) => x.code === '6.2' || x.code.startsWith('6.2.'))
      const terApbd = lraTotal(sync.rows, has61 ? '6.1' : '6', 'anggaran')
      const kelApbd = lraTotal(sync.rows, has62 ? '6.2' : '6', 'anggaran')
      if (pendApbd !== null || belApbd !== null || terApbd !== null || kelApbd !== null) {
        synced = true
      }

      return {
        year: r.year,
        pendapatan: { apbd: pendApbd ?? r.pendapatanApbd, apbdp: r.pendapatanApbdp },
        belanja: { apbd: belApbd ?? r.belanjaApbd, apbdp: r.belanjaApbdp },
        penerimaanPembiayaan: { apbd: terApbd ?? r.terimaApbd, apbdp: r.terimaApbdp },
        pengeluaranPembiayaan: { apbd: kelApbd ?? r.keluarApbd, apbdp: r.keluarApbdp },
      }
    })

    return NextResponse.json({ data, meta: metaFrom(sync, synced) })
  } catch (error) {
    console.error('GET /api/apbd error', error)
    return NextResponse.json({ error: 'Gagal memuat data APBD' }, { status: 500 })
  }
}
