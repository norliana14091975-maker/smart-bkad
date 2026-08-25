import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getLraSync, lraTotal, metaFrom } from '@/lib/lra-sync'
import type { ApbdSummaryDto } from '@/types/budget'

function zeroRow(year: number): ApbdSummaryDto {
  return {
    year,
    pendapatan: { apbd: 0, apbdp: 0 },
    belanja: { apbd: 0, apbdp: 0 },
    penerimaanPembiayaan: { apbd: 0, apbdp: 0 },
    pengeluaranPembiayaan: { apbd: 0, apbdp: 0 },
  }
}

function baselineRow(r: {
  year: number
  pendapatanApbd: number
  pendapatanApbdp: number
  belanjaApbd: number
  belanjaApbdp: number
  terimaApbd: number
  terimaApbdp: number
  keluarApbd: number
  keluarApbdp: number
}): ApbdSummaryDto {
  return {
    year: r.year,
    pendapatan: { apbd: r.pendapatanApbd, apbdp: r.pendapatanApbdp },
    belanja: { apbd: r.belanjaApbd, apbdp: r.belanjaApbdp },
    penerimaanPembiayaan: { apbd: r.terimaApbd, apbdp: r.terimaApbdp },
    pengeluaranPembiayaan: { apbd: r.keluarApbd, apbdp: r.keluarApbdp },
  }
}

/**
 * Ringkasan APBD tahunan untuk dashboard publik.
 *
 * Aturan sinkronisasi APBD Murni / APBD Perubahan (APBDP) sesuai data
 * realisasi (LRA) yang masuk:
 * - Tidak ada data realisasi sama sekali → baris tahun anggaran berjalan
 *   mengikuti 0 (APBD & APBDP = 0), baris bila belum ada disintesis.
 * - LRA tersinkron → data LRA diterapkan pada baris TAHUN ANGGARAN LRA
 *   (dibaca dari dokumen saat import) sebagai data pembanding tahun tsb:
 *   APBD = anggaran MURNI baseline (kategori dengan realisasi 0 → murni 0);
 *   APBDP = anggaran hasil import LRA.
 */
export async function GET() {
  try {
    const [rows, sync] = await Promise.all([
      db.apbdSummary.findMany({ orderBy: { year: 'desc' } }),
      getLraSync(),
    ])

    // Tahun anggaran berjalan: dari apbd_summary, fallback item anggaran /
    // tahun kalender berjalan (agar baris 0 tetap tampil bila summary kosong)
    let currentYear = rows.reduce((m, r) => Math.max(m, r.year), 0)
    if (currentYear === 0) {
      const agg = await db.budgetItem.aggregate({ _max: { year: true } })
      currentYear = agg._max.year ?? new Date().getFullYear()
    }

    // Tahun pembanding LRA: tahun anggaran yang terbaca dari dokumen LRA
    // terbaru — bukan tahun kalender — agar perubahan/realisasi diterapkan
    // pada tahun anggaran yang benar
    const targetYear = sync.available && sync.year ? sync.year : currentYear

    // Aturan realisasi 0: tidak ada baris LRA sama sekali → APBD mengikuti 0
    const realisasiKosong = !sync.available

    let synced = false
    const data: ApbdSummaryDto[] = []

    for (const r of rows) {
      if (r.year !== targetYear) {
        // Tahun selain tahun LRA: baseline apa adanya
        data.push(baselineRow(r))
        continue
      }

      if (realisasiKosong) {
        // Data realisasi 0 → APBD tahun berjalan mengikuti 0
        data.push(zeroRow(r.year))
        continue
      }

      // Tahun berjalan + LRA tersinkron: per kategori,
      // realisasi 0 → murni 0; realisasi > 0 → murni baseline
      const pendLra = lraTotal(sync.rows, '4', 'anggaran')
      const pendRea = lraTotal(sync.rows, '4', 'realisasi')
      const belLra = lraTotal(sync.rows, '5', 'anggaran')
      const belRea = lraTotal(sync.rows, '5', 'realisasi')
      const has61 = sync.rows.some((x) => x.code === '6.1' || x.code.startsWith('6.1.'))
      const has62 = sync.rows.some((x) => x.code === '6.2' || x.code.startsWith('6.2.'))
      const terLra = lraTotal(sync.rows, has61 ? '6.1' : '6', 'anggaran')
      const terRea = lraTotal(sync.rows, has61 ? '6.1' : '6', 'realisasi')
      const kelLra = lraTotal(sync.rows, has62 ? '6.2' : '6', 'anggaran')
      const kelRea = lraTotal(sync.rows, has62 ? '6.2' : '6', 'realisasi')
      if (
        pendLra !== null ||
        belLra !== null ||
        terLra !== null ||
        kelLra !== null
      ) {
        synced = true
      }

      const murni = (rea: number | null, baseline: number) =>
        rea === null || rea === 0 ? 0 : baseline

      data.push({
        year: r.year,
        pendapatan: {
          apbd: murni(pendRea, r.pendapatanApbd),
          apbdp: pendLra ?? r.pendapatanApbdp,
        },
        belanja: {
          apbd: murni(belRea, r.belanjaApbd),
          apbdp: belLra ?? r.belanjaApbdp,
        },
        penerimaanPembiayaan: {
          apbd: murni(terRea, r.terimaApbd),
          apbdp: terLra ?? r.terimaApbdp,
        },
        pengeluaranPembiayaan: {
          apbd: murni(kelRea, r.keluarApbd),
          apbdp: kelLra ?? r.keluarApbdp,
        },
      })
    }

    // Baris tahun anggaran LRA belum ada di apbd_summary → sintesis
    // (agar dashboard tetap menampilkan tahun tsb, bukan kosong)
    if (!rows.some((r) => r.year === targetYear)) {
      if (realisasiKosong) {
        data.push(zeroRow(targetYear))
      } else {
        // Dari LRA: kategori terealisasi → murni = anggaran LRA, else 0
        const pendLra = lraTotal(sync.rows, '4', 'anggaran')
        const pendRea = lraTotal(sync.rows, '4', 'realisasi')
        const belLra = lraTotal(sync.rows, '5', 'anggaran')
        const belRea = lraTotal(sync.rows, '5', 'realisasi')
        const has61 = sync.rows.some((x) => x.code === '6.1' || x.code.startsWith('6.1.'))
        const has62 = sync.rows.some((x) => x.code === '6.2' || x.code.startsWith('6.2.'))
        const terLra = lraTotal(sync.rows, has61 ? '6.1' : '6', 'anggaran')
        const terRea = lraTotal(sync.rows, has61 ? '6.1' : '6', 'realisasi')
        const kelLra = lraTotal(sync.rows, has62 ? '6.2' : '6', 'anggaran')
        const kelRea = lraTotal(sync.rows, has62 ? '6.2' : '6', 'realisasi')
        if (pendLra !== null || belLra !== null || terLra !== null || kelLra !== null) {
          synced = true
        }

        const dariLra = (rea: number | null, lra: number | null) => ({
          apbd: rea !== null && rea > 0 ? lra ?? 0 : 0,
          apbdp: lra ?? 0,
        })

        data.push({
          year: targetYear,
          pendapatan: dariLra(pendRea, pendLra),
          belanja: dariLra(belRea, belLra),
          penerimaanPembiayaan: dariLra(terRea, terLra),
          pengeluaranPembiayaan: dariLra(kelRea, kelLra),
        })
      }
    }

    data.sort((a, b) => b.year - a.year)
    return NextResponse.json({ data, meta: metaFrom(sync, synced) })
  } catch (error) {
    console.error('GET /api/apbd error', error)
    return NextResponse.json({ error: 'Gagal memuat data APBD' }, { status: 500 })
  }
}
