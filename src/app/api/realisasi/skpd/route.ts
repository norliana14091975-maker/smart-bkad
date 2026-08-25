import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { RealisasiSkpdDto } from '@/types/budget'

/**
 * Realisasi per SKPD untuk dashboard publik. Data mengikuti TAHUN ANGGARAN
 * TERBARU per SKPD (tahun anggaran dibaca dari dokumen LRA saat import;
 * ringkasan tahun lama tersimpan sebagai pembanding). Setiap baris
 * menyertakan `opdId` bila terdapat OPD terdaftar dengan nama yang sama —
 * dipakai untuk fitur detail (drill-down rincian per-akun milik SKPD tsb).
 */
export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get('q')?.trim().toLowerCase() ?? ''
  try {
    const [rows, opds] = await Promise.all([
      db.realisasiSkpd.findMany({ orderBy: { name: 'asc' } }),
      db.opd.findMany({ select: { id: true, name: true } }),
    ])
    const opdByName = new Map(opds.map((o) => [o.name, o.id]))

    // Ambil ringkasan tahun anggaran TERBARU per nama SKPD
    const latestByYear = new Map<string, typeof rows[number]>()
    for (const r of rows) {
      const cur = latestByYear.get(r.name)
      if (!cur || r.year > cur.year) latestByYear.set(r.name, r)
    }

    let data: (RealisasiSkpdDto & { opdId: number | null })[] = [...latestByYear.values()].map((r) => ({
      name: r.name,
      opdId: opdByName.get(r.name) ?? null,
      pendapatan: { anggaran: r.pendapatanAnggaran, realisasi: r.pendapatanRealisasi },
      belanja: { anggaran: r.belanjaAnggaran, realisasi: r.belanjaRealisasi },
      pembiayaan: { anggaran: r.pembiayaanAnggaran, realisasi: r.pembiayaanRealisasi },
    }))
    if (search) {
      data = data.filter((d) => d.name.toLowerCase().includes(search))
    }
    return NextResponse.json({ data })
  } catch (error) {
    console.error('GET /api/realisasi/skpd error', error)
    return NextResponse.json({ error: 'Gagal memuat realisasi per SKPD' }, { status: 500 })
  }
}
