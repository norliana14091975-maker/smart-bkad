import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, unauthorized } from '@/lib/auth'
import { getLraSync, lraTotal } from '@/lib/lra-sync'

/**
 * Sinkronisasi data APBD dari LRA yang telah diupload/diimport
 * (tabel realisasi_akun) ke tabel anggaran:
 * - budget_item  : item anggaran level jenis (4.x.yy / 5.x.yy / 6.x.yy)
 *                  per bagian & tab untuk tahun anggaran berjalan
 * - apbd_summary : ringkasan APBD tahunan (total anggaran per kategori)
 *
 * Sinkronisasi MENGGANTI seluruh item anggaran tahun tsb dan memperbarui
 * (upsert) baris ringkasan APBD tahun tsb — nilai anggaran LRA menjadi
 * baseline APBD (murni) sekaligus APBDP (perubahan).
 */

interface SyncPlanItem {
  section: string
  tab: string
  code: string
  name: string
  amount: number
}

interface SyncPlan {
  year: number
  items: SyncPlanItem[]
  itemCounts: { pendapatan: number; belanja: number; pembiayaan: number }
  totals: {
    pendapatan: number
    belanja: number
    terima: number
    keluar: number
  }
}

/** Pemetaan prefix kode belanja → tab (selaras /api/belanja). */
const BELANJA_TAB: { prefix: string; tab: string }[] = [
  { prefix: '5.1', tab: 'ops' },
  { prefix: '5.2', tab: 'mdl' },
  { prefix: '5.3', tab: 'ttdg' },
  { prefix: '5.4', tab: 'tf' },
]

/** Susun rencana sinkronisasi dari agregat LRA untuk satu tahun anggaran. */
function buildPlan(
  rows: { code: string; name: string; level: number; anggaran: number }[],
  year: number,
): SyncPlan {
  const items: SyncPlanItem[] = []
  const counts = { pendapatan: 0, belanja: 0, pembiayaan: 0 }

  // Item anggaran = baris LRA level jenis (level 3)
  for (const r of rows.filter((x) => x.level === 3).sort((a, b) => a.code.localeCompare(b.code))) {
    if (r.code.startsWith('4')) {
      items.push({ section: 'pendapatan', tab: 'utama', code: r.code, name: r.name, amount: r.anggaran })
      counts.pendapatan += 1
    } else if (r.code.startsWith('5')) {
      const tab = BELANJA_TAB.find((t) => r.code === t.prefix || r.code.startsWith(`${t.prefix}.`))?.tab
      if (tab) {
        items.push({ section: 'belanja', tab, code: r.code, name: r.name, amount: r.anggaran })
        counts.belanja += 1
      }
    } else if (r.code.startsWith('6')) {
      const tab = r.code.startsWith('6.1') ? 'terima' : r.code.startsWith('6.2') ? 'keluar' : null
      if (tab) {
        items.push({ section: 'pembiayaan', tab, code: r.code, name: r.name, amount: r.anggaran })
        counts.pembiayaan += 1
      }
    }
  }

  // Total per kategori — logika prefix selaras /api/apbd
  const has61 = rows.some((x) => x.code === '6.1' || x.code.startsWith('6.1.'))
  const has62 = rows.some((x) => x.code === '6.2' || x.code.startsWith('6.2.'))
  const totals = {
    pendapatan: lraTotal(rows, '4', 'anggaran') ?? 0,
    belanja: lraTotal(rows, '5', 'anggaran') ?? 0,
    terima: lraTotal(rows, has61 ? '6.1' : '6', 'anggaran') ?? 0,
    keluar: lraTotal(rows, has62 ? '6.2' : '6', 'anggaran') ?? 0,
  }

  return { year, items, itemCounts: counts, totals }
}

/** GET: pratinjau sinkronisasi (tanpa menulis ke database). */
export async function GET() {
  try {
    const user = await requireAdmin()
    if (!user) return unauthorized()

    const sync = await getLraSync()
    // Tahun anggaran target = tahun LRA terbaru (dibaca dari dokumen saat
    // import), fallback tahun kalender berjalan
    const year = sync.year ?? new Date().getFullYear()
    const plan = sync.available ? buildPlan(sync.rows, year) : null
    const existingYearItems = plan
      ? await db.budgetItem.count({ where: { year: plan.year } })
      : 0

    return NextResponse.json({
      data: {
        available: sync.available,
        mode: sync.mode,
        opdCount: sync.opdCount,
        opdNames: sync.opdNames,
        year: sync.year,
        periode: sync.periode,
        periodeLabel: sync.periodeLabel,
        plan,
        existingYearItems,
      },
    })
  } catch (error) {
    console.error('GET /api/admin/sync-lra error', error)
    return NextResponse.json({ error: 'Gagal memuat pratinjau sinkronisasi' }, { status: 500 })
  }
}

/** POST: jalankan sinkronisasi — tulis item anggaran + ringkasan APBD. */
export async function POST(req: Request) {
  try {
    const user = await requireAdmin()
    if (!user) return unauthorized()

    const sync = await getLraSync()
    if (!sync.available) {
      return NextResponse.json(
        {
          error:
            'Belum ada data LRA yang dapat disinkronkan. Import LRA terlebih dahulu melalui menu Import LRA (PDF).',
        },
        { status: 400 },
      )
    }

    const body = (await req.json().catch(() => ({}))) as { year?: unknown }
    // Tahun anggaran target: dari body (override manual), bila kosong
    // mengikuti TAHUN LRA yang dibaca dari dokumen saat import — bukan
    // tahun kalender — agar data pembanding jatuh pada tahun yang benar
    const year =
      body.year === undefined || body.year === null || body.year === ''
        ? (sync.year ?? new Date().getFullYear())
        : Number(body.year)
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: 'Tahun anggaran tidak valid' }, { status: 400 })
    }

    const plan = buildPlan(sync.rows, year)

    // Nilai anggaran LRA → baseline APBD (murni) sekaligus APBDP (perubahan)
    const summaryValues = {
      pendapatanApbd: plan.totals.pendapatan,
      pendapatanApbdp: plan.totals.pendapatan,
      belanjaApbd: plan.totals.belanja,
      belanjaApbdp: plan.totals.belanja,
      terimaApbd: plan.totals.terima,
      terimaApbdp: plan.totals.terima,
      keluarApbd: plan.totals.keluar,
      keluarApbdp: plan.totals.keluar,
    }

    const replaced = await db.$transaction(async (tx) => {
      const removed = await tx.budgetItem.deleteMany({ where: { year } })
      if (plan.items.length > 0) {
        await tx.budgetItem.createMany({
          data: plan.items.map((it) => ({
            section: it.section,
            tab: it.tab,
            code: it.code,
            name: it.name,
            year,
            amount: it.amount,
          })),
        })
      }
      await tx.apbdSummary.upsert({
        where: { year },
        update: summaryValues,
        create: { year, ...summaryValues },
      })
      return { removed: removed.count, created: plan.items.length }
    })

    return NextResponse.json({
      data: {
        year,
        replacedItems: replaced.removed,
        createdItems: replaced.created,
        itemCounts: plan.itemCounts,
        totals: plan.totals,
        periodeLabel: sync.periodeLabel,
        opdCount: sync.opdCount,
      },
    })
  } catch (error) {
    console.error('POST /api/admin/sync-lra error', error)
    return NextResponse.json({ error: 'Gagal menjalankan sinkronisasi LRA' }, { status: 500 })
  }
}
