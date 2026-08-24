'use client'

import { Filter } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LEVEL_LABELS } from '@/lib/kode-akun'
import { useLevelFilter } from '@/hooks/use-level-filter'

const ALL_LEVELS = [1, 2, 3, 4, 5, 6]

/**
 * Kontrol filter level kode rekening (L1 Akun … L6 Sub Rincian Obyek).
 * Dipakai bersama di semua tampilan rincian agar pilihan pengguna —
 * termasuk Kepala Daerah — konsisten di seluruh aplikasi (persist di
 * localStorage).
 */
export function LevelFilterControls({ className }: { className?: string }) {
  const { levels, isVisible, toggle, selectAll, matchCount } = useLevelFilter()

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2',
        className
      )}
      role="group"
      aria-label="Filter level kode rekening"
    >
      <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-foreground/70">
        <Filter className="h-3.5 w-3.5 text-[#17408b]" aria-hidden="true" />
        Level
      </span>

      <div className="flex flex-wrap gap-1" role="group" aria-label="Pilih level yang ditampilkan">
        {ALL_LEVELS.map((lv) => {
          const active = isVisible(lv)
          return (
            <button
              key={lv}
              type="button"
              onClick={() => toggle(lv)}
              aria-pressed={active}
              title={`${LEVEL_LABELS[lv]} — tampilkan kode level ${lv}`}
              className={cn(
                'rounded-md border px-2 py-1 font-mono text-[10px] font-bold transition-colors',
                active
                  ? 'border-[#17408b] bg-[#17408b] text-white'
                  : 'border-muted-foreground/30 bg-background text-muted-foreground hover:border-[#17408b]/50'
              )}
            >
              L{lv}
            </button>
          )
        })}
      </div>

      <span className="hidden text-[11px] text-muted-foreground sm:inline">
        {matchCount === 0
          ? 'Semua level tampil'
          : `${matchCount} level: ${levels
              .map((l) => `L${l} ${LEVEL_LABELS[l] ?? ''}`)
              .join(', ')}`}
      </span>

      {matchCount > 0 && (
        <button
          type="button"
          onClick={selectAll}
          className="ml-auto rounded-md border border-[#17408b]/40 px-2 py-1 text-[10px] font-semibold text-[#17408b] transition-colors hover:bg-[#17408b]/10"
        >
          Tampilkan Semua
        </button>
      )}
    </div>
  )
}
