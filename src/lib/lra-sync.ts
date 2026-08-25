import { db } from '@/lib/db'
import { sumByPrefix } from '@/lib/import-lra'
import { periodeLabel as labelPeriode } from '@/lib/periode'
import type { BudgetItemDto } from '@/types/budget'

/**
 * Sinkronisasi anggaran (APBD / Pendapatan / Belanja / Pembiayaan) dengan
 * data LRA yang masuk (hasil import). Sumber: agregat seluruh OPD pada
 * periode TERAKHIR milik masing-masing; bila belum ada OPD yang mengimpor,
 * pakai data konsolidasi (scope global). Bila keduanya tidak ada, seksi
 * tetap memakai data statis (baseline).
 */

export interface LraSyncRow {
  code: string
  name: string
  group: string
  level: number
  anggaran: number
  realisasi: number
}

export interface LraSyncInfo {
  available: boolean
  mode: 'aggregate' | 'global'
  opdCount: number
  opdNames: string[]
  periode: number | null
  periodeLabel: string | null
  rows: LraSyncRow[]
}

/** Ambil agregat LRA terimport (anggaran + realisasi) untuk sinkronisasi. */
export async function getLraSync(): Promise<LraSyncInfo> {
  const all = await db.realisasiAkun.findMany()

  const opdRows = all.filter((r) => r.scope !== 'global')
  let base
  let mode: 'aggregate' | 'global'
  const opdIds = new Set<number>()

  if (opdRows.length > 0) {
    mode = 'aggregate'
    // Periode terakhir per OPD — anggaran versi terbarunya yang dipakai
    const periodeByOpd = new Map<number, number>()
    for (const r of opdRows) {
      if (r.opdId) {
        const cur = periodeByOpd.get(r.opdId) ?? 0
        periodeByOpd.set(r.opdId, Math.max(cur, r.periode))
      }
    }
    base = opdRows.filter((r) => {
      const target = periodeByOpd.get(r.opdId ?? -1)
      return target !== undefined && r.periode === target
    })
    for (const r of base) {
      if (r.opdId) opdIds.add(r.opdId)
    }
  } else {
    mode = 'global'
    const maxP = all.reduce((m, r) => Math.max(m, r.periode), 0)
    base = all.filter((r) => r.periode === maxP)
  }

  if (base.length === 0) {
    return {
      available: false,
      mode,
      opdCount: 0,
      opdNames: [],
      periode: null,
      periodeLabel: null,
      rows: [],
    }
  }

  // Agregasi per kode (menjumlahkan lintas OPD)
  const agg = new Map<string, LraSyncRow>()
  for (const r of base) {
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
  const rows = [...agg.values()].sort((a, b) => a.code.localeCompare(b.code))

  let opdNames: string[] = []
  if (opdIds.size > 0) {
    const opds = await db.opd.findMany({
      where: { id: { in: [...opdIds] } },
      select: { name: true },
      orderBy: { name: 'asc' },
    })
    opdNames = opds.map((o) => o.name)
  }

  const periode = base.reduce((m, r) => Math.max(m, r.periode), 0)
  return {
    available: true,
    mode,
    opdCount: opdIds.size,
    opdNames,
    periode: periode || null,
    periodeLabel: periode ? labelPeriode(periode) : null,
    rows,
  }
}

/** Meta ringkas untuk respons API dan badge UI. */
export interface LraSyncMeta {
  synced: boolean
  opdCount: number
  periodeLabel: string | null
}

export function metaFrom(sync: LraSyncInfo, synced: boolean): LraSyncMeta {
  return {
    synced: synced && sync.available,
    opdCount: sync.opdCount,
    periodeLabel: sync.periodeLabel,
  }
}

/**
 * Total LRA untuk satu prefix kode (mis. '4', '5', '6.1').
 * Mengembalikan null bila tidak ada baris LRA sama sekali di bawah prefix
 * tersebut sehingga pemanggil mempertahankan nilai baseline.
 */
export function lraTotal(
  rows: LraSyncRow[],
  prefix: string,
  field: 'anggaran' | 'realisasi'
): number | null {
  const has = rows.some((r) => r.code === prefix || r.code.startsWith(`${prefix}.`))
  if (!has) return null
  return sumByPrefix(rows, prefix, field)
}

/**
 * Gabungkan item anggaran statis dengan item LRA untuk satu tab seksi
 * (Pendapatan/Belanja/Pembiayaan):
 * - tahun berjalan: dari LRA (level jenis) — kode tanpa LRA bernilai 0
 * - tahun sebelumnya: dari data statis (pembanding)
 * Bila LRA tidak memiliki baris pada cakupan tab, kembalikan statis apa adanya.
 */
export function syncTabItems(
  staticItems: BudgetItemDto[],
  sync: LraSyncInfo,
  filter: (r: LraSyncRow) => boolean,
  year?: number
): { items: BudgetItemDto[]; synced: boolean } {
  if (!sync.available) return { items: staticItems, synced: false }

  const currentYear =
    year ?? staticItems.reduce((m, i) => Math.max(m, i.year), new Date().getFullYear())
  const prevYear = currentYear - 1

  const inScope = sync.rows
    .filter(filter)
    .sort((a, b) => a.code.localeCompare(b.code))
  if (inScope.length === 0) return { items: staticItems, synced: false }

  const staticPrev = new Map(
    staticItems.filter((i) => i.year === prevYear).map((i) => [i.code, i.amount])
  )
  const staticCur = staticItems.filter((i) => i.year === currentYear)

  const out: BudgetItemDto[] = []
  const seen = new Set<string>()

  for (const r of inScope) {
    out.push({ code: r.code, name: r.name, year: currentYear, amount: r.anggaran })
    out.push({ code: r.code, name: r.name, year: prevYear, amount: staticPrev.get(r.code) ?? 0 })
    seen.add(r.code)
  }
  // Kode statis tanpa baris LRA → tahun berjalan bernilai 0 (belum ada data masuk)
  for (const i of staticCur) {
    if (seen.has(i.code)) continue
    out.push({ code: i.code, name: i.name, year: currentYear, amount: 0 })
    out.push({ code: i.code, name: i.name, year: prevYear, amount: staticPrev.get(i.code) ?? 0 })
  }

  out.sort((a, b) => a.code.localeCompare(b.code) || b.year - a.year)
  return { items: out, synced: true }
}
