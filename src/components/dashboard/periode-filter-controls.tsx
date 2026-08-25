'use client'

import { useSyncExternalStore } from 'react'
import { CalendarRange } from 'lucide-react'
import { cn } from '@/lib/utils'
import { periodePilihan } from '@/lib/periode'

const STORAGE_KEY = 'bpkd.periodeFilter'

// ---------------------------------------------------------------------------
// Store global filter periode LRA (kumulatif s.d. bulan ke-N) — dibagi semua
// tampilan realisasi via useSyncExternalStore; persist di localStorage agar
// preferensi Kepala Daerah tetap berlaku lintas halaman/sesi.
// 'all' = periode terakhir per OPD; 'p1'..'p12' = paksa periode tertentu.
// ---------------------------------------------------------------------------

type PeriodeValue = 'all' | `p${number}`

function load(): PeriodeValue {
  if (typeof window === 'undefined') return 'all'
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return 'all'
    if (raw === 'all' || /^p([1-9]|1[0-2])$/.test(raw)) return raw as PeriodeValue
    return 'all'
  } catch {
    return 'all'
  }
}

let current: PeriodeValue = load()
const listeners = new Set<() => void>()

function setPeriode(next: PeriodeValue) {
  current = next
  try {
    window.localStorage.setItem(STORAGE_KEY, next)
  } catch {
    // abaikan
  }
  for (const l of listeners) l()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      current = load()
      listener()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

/** Hook filter periode global (dipakai bersama seluruh tampilan realisasi). */
export function usePeriodeFilter() {
  const value = useSyncExternalStore(
    subscribe,
    () => current,
    () => 'all' as PeriodeValue
  )
  const periode = value === 'all' ? null : Number(value.slice(1))
  return { value, periode, setPeriode }
}

/**
 * Kontrol periode LRA: Periode Terakhir (default), setahun, semester,
 * triwulan, dan bulanan (Jan..Nov) — sesuai ketentuan penyampaian LRA.
 */
export function PeriodeFilterControls({ className }: { className?: string }) {
  const { value, setPeriode } = usePeriodeFilter()
  const pilihan = periodePilihan()

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2',
        className
      )}
      role="group"
      aria-label="Filter periode LRA"
    >
      <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-foreground/70">
        <CalendarRange className="h-3.5 w-3.5 text-[#17408b]" aria-hidden="true" />
        Periode
      </span>
      <select
        value={value}
        onChange={(e) => setPeriode(e.target.value as PeriodeValue)}
        aria-label="Pilih periode realisasi"
        className="h-8 min-w-56 max-w-full rounded-md border border-muted-foreground/30 bg-background px-2 text-xs font-semibold text-foreground focus:border-[#17408b] focus:outline-none"
      >
        {pilihan.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      {value !== 'all' && (
        <button
          type="button"
          onClick={() => setPeriode('all')}
          className="rounded-md border border-[#17408b]/40 px-2 py-1 text-[10px] font-semibold text-[#17408b] transition-colors hover:bg-[#17408b]/10"
        >
          Kembali ke Periode Terakhir
        </button>
      )}
    </div>
  )
}
