'use client'

import { RefreshCw } from 'lucide-react'

export interface LraSyncMetaDto {
  synced: boolean
  opdCount: number
  periodeLabel: string | null
}

/**
 * Penanda bahwa anggaran pada seksi ini tersinkron dengan data LRA yang
 * masuk (hasil import OPD/konsolidasi pada periode terakhir).
 */
export function LraSyncBadge({ meta }: { meta?: LraSyncMetaDto | null }) {
  if (!meta?.synced) return null

  return (
    <p className="mb-4 flex flex-wrap items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">
      <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      Anggaran tahun berjalan tersinkron dengan LRA terimport
      {meta.opdCount > 0 && <>&nbsp;({meta.opdCount} OPD/SKPD)</>}
      {meta.periodeLabel && <span className="font-normal text-emerald-800">&nbsp;— {meta.periodeLabel}</span>}
    </p>
  )
}
