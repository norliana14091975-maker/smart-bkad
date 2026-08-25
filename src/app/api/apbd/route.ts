import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getLraSync, lraTotal, metaFrom } from '@/lib/lra-sync'
import type { ApbdSummaryDto } from '@/types/budget'

/**
 * Ringkasan APBD tahunan untuk dashboard publik.
 *
 * Aturan sinkronisasi APBD Murni / APBD Perubahan (APBDP) pada tahun anggaran
 * berjalan sesuai data LRA yang masuk:
 * - Kolom APBD  = anggaran MURNI (baseline) — tidak diubah oleh import.
 * - Kolom APBDP = anggaran hasil import LRA (anggaran PERUBAHAN) — bila LRA
 *   diimport dan anggarannya berbeda dari murni, penambahan/pengurangan
 *   otomatis terkategori di APBDP. Bila tidak ada LRA, APBDP tetap baseline.
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

      // Anggaran hasil import LRA (kandidat APBDP / perubahan)
      const pendLra = lraTotal(sync.rows, '4', 'anggaran')
      const belLra = lraTotal(sync.rows, '5', 'anggaran')
      const has61 = sync.rows.some((x) => x.code === '6.1' || x.code.startsWith('6.1.'))
      const has62 = sync.rows.some((x) => x.code === '6.2' || x.code.startsWith('6.2.'))
      const terLra = lraTotal(sync.rows, has61 ? '6.1' : '6', 'anggaran')
      const kelLra = lraTotal(sync.rows, has62 ? '6.2' : '6', 'anggaran')
      if (pendLra !== null || belLra !== null || terLra !== null || kelLra !== null) {
        synced = true
      }

      // APBDP = anggaran import bila ada (perubahan); APBD murni tetap baseline.
      // Bila anggaran import sama dengan murni (tidak berubah), pertahankan
      // APBDP baseline agar tidak menimpa data perubahan resmi.
      const perubahan = (lra: number | null, murni: number, apbdpBaseline: number) =>
        lra !== null && lra !== murni ? lra : apbdpBaseline

      return {
        year: r.year,
        pendapatan: {
          apbd: r.pendapatanApbd,
          apbdp: perubahan(pendLra, r.pendapatanApbd, r.pendapatanApbdp),
        },
        belanja: {
          apbd: r.belanjaApbd,
          apbdp: perubahan(belLra, r.belanjaApbd, r.belanjaApbdp),
        },
        penerimaanPembiayaan: {
          apbd: r.terimaApbd,
          apbdp: perubahan(terLra, r.terimaApbd, r.terimaApbdp),
        },
        pengeluaranPembiayaan: {
          apbd: r.keluarApbd,
          apbdp: perubahan(kelLra, r.keluarApbd, r.keluarApbdp),
        },
      }
    })

    return NextResponse.json({ data, meta: metaFrom(sync, synced) })
  } catch (error) {
    console.error('GET /api/apbd error', error)
    return NextResponse.json({ error: 'Gagal memuat data APBD' }, { status: 500 })
  }
}
