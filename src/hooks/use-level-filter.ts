'use client'

import { useSyncExternalStore } from 'react'
import { LEVEL_LABELS } from '@/lib/kode-akun'

const STORAGE_KEY = 'bpkd.levelFilter'
const ALL_LEVELS = [1, 2, 3, 4, 5, 6] as const

export type LevelFilter = number[] // [] berarti semua level tampil

// ---------------------------------------------------------------------------
// Store global level filter — dibagi oleh semua komponen lewat
// useSyncExternalStore sehingga perubahan di satu kontrol langsung berlaku
// di seluruh tampilan (dialog, dashboard OPD, realisasi publik, dsb.).
// Nilai dipersist ke localStorage agar pilihan pengguna (mis. Kepala Daerah)
// tetap berlaku saat berpindah halaman / membuka ulang aplikasi.
// ---------------------------------------------------------------------------

function parseLevels(raw: string | null): LevelFilter {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const levels = parsed
      .map(Number)
      .filter((n) => Number.isInteger(n) && (ALL_LEVELS as readonly number[]).includes(n))
    const unique = [...new Set(levels)].sort((a, b) => a - b)
    return unique.length === ALL_LEVELS.length ? [] : unique
  } catch {
    return []
  }
}

let currentLevels: LevelFilter =
  typeof window === 'undefined' ? [] : parseLevels(window.localStorage.getItem(STORAGE_KEY))

const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function setLevels(next: LevelFilter) {
  currentLevels = next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // penyimpanan tidak tersedia → filter tetap berlaku di memori
  }
  emit()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Sinkronkan bila tab lain mengubah localStorage
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      currentLevels = parseLevels(e.newValue)
      listener()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

function getSnapshot(): LevelFilter {
  return currentLevels
}

function getServerSnapshot(): LevelFilter {
  return []
}

/**
 * Filter level kode rekening (L1 Akun … L6 Sub Rincian Obyek) yang dibagi
 * global di seluruh tampilan rincian aplikasi.
 *
 * - `levels`: daftar level aktif ([] = semua)
 * - `isVisible(level)`: cek cepat untuk render baris
 * - `toggle(level)`: aktif/nonaktif satu level
 * - `selectAll()`: kembali menampilkan semua level
 * - `matchCount`: jumlah level aktif (untuk label ringkas)
 */
export function useLevelFilter() {
  const levels = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const isVisible = (level: number) => levels.length === 0 || levels.includes(level)

  const toggle = (level: number) => {
    if (currentLevels.length === 0) {
      // dari "semua" → hanya level yang diklik
      setLevels([level])
      return
    }
    if (currentLevels.includes(level)) {
      const next = currentLevels.filter((l) => l !== level)
      setLevels(next.length === ALL_LEVELS.length ? [] : next)
    } else {
      const next = [...currentLevels, level].sort((a, b) => a - b)
      setLevels(next.length === ALL_LEVELS.length ? [] : next)
    }
  }

  const selectAll = () => setLevels([])

  const matchCount = levels.length

  return { levels, isVisible, toggle, selectAll, matchCount }
}
