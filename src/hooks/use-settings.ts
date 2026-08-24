'use client'

import { useQuery } from '@tanstack/react-query'
import type { AppSettingsDto } from '@/types/budget'

/**
 * Hook pengambilan pengaturan aplikasi (nama, logo, favicon, teks).
 * Dipakai bersama oleh halaman utama dan panel admin sehingga perubahan
 * langsung tercermin setelah cache query di-invalidate.
 */
export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async (): Promise<AppSettingsDto> => {
      const res = await fetch('/api/settings')
      if (!res.ok) throw new Error('Gagal memuat pengaturan')
      const json = (await res.json()) as { data: AppSettingsDto }
      return json.data
    },
    staleTime: 60_000,
    retry: 1,
  })
}
