'use client'

import { RefreshCw, ShieldAlert } from 'lucide-react'

export interface LraSyncMetaDto {
  synced: boolean
  opdCount: number
  /** Tahun anggaran LRA yang menjadi sumber sinkronisasi */
  year?: number | null
  periodeLabel: string | null
  /** True bila tidak ada data realisasi (LRA) sama sekali — anggaran mengikuti 0 */
  noRealisasi?: boolean
}

/**
 * Penanda status sinkronisasi anggaran pada suatu seksi:
 * - Hijau : tersinkron dengan LRA terimport (hasil import OPD/konsolidasi).
 * - Amber : belum ada data realisasi sama sekali — anggaran mengikuti 0
 *           sesuai aturan (LRA adalah sumber data anggaran berjalan).
 */
export function LraSyncBadge({
  meta,
  children,
}: {
  meta?: LraSyncMetaDto | null
  children?: React.ReactNode
}) {
  // Aturan realisasi 0: belum ada LRA → anggaran menampilkan 0
  if (meta?.noRealisasi) {
    return (
      <p className="mb-4 flex flex-wrap items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
        <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Belum ada data realisasi (LRA) — item anggaran dan APBD tahun berjalan
        mengikuti 0. Import LRA melalui menu Import LRA (PDF) untuk mengisi data.
      </p>
    )
  }

  if (!meta?.synced) return null

  return (
    <p className="mb-4 flex flex-wrap items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">
      <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {children ?? (
        <>
          Anggaran tahun berjalan tersinkron dengan LRA terimport
          {meta.opdCount > 0 && <>&nbsp;({meta.opdCount} OPD/SKPD)</>}
        </>
      )}
      {meta.year && <span className="font-normal text-emerald-800">&nbsp;— TA {meta.year}</span>}
      {meta.periodeLabel && <span className="font-normal text-emerald-800">&nbsp;— {meta.periodeLabel}</span>}
    </p>
  )
}
