'use client'

import { useEffect, useState } from 'react'
import { Users } from 'lucide-react'
import { formatRupiah0 } from '@/lib/format'
import type { AppSettingsDto, VisitorDto } from '@/types/budget'

export function VisitorFooter({ settings }: { settings: AppSettingsDto }) {
  const [visitor, setVisitor] = useState<VisitorDto | null>(null)

  useEffect(() => {
    let cancelled = false
    async function track() {
      try {
        const res = await fetch('/api/visitor', { method: 'POST' })
        if (!res.ok) throw new Error('gagal')
        const json = (await res.json()) as { data: VisitorDto }
        if (!cancelled) setVisitor(json.data)
      } catch {
        try {
          const res = await fetch('/api/visitor')
          const json = (await res.json()) as { data: VisitorDto }
          if (!cancelled) setVisitor(json.data)
        } catch {
          // biarkan null
        }
      }
    }
    track()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <footer className="mt-auto border-t bg-[#1b2a4a] text-slate-300">
      <div className="mx-auto flex max-w-full flex-col items-center justify-between gap-2 px-4 py-4 sm:flex-row sm:px-6">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Users className="h-4 w-4 text-amber-400" aria-hidden="true" />
          <span>
            Jumlah Pengunjung bulan ini:{' '}
            {visitor ? (
              <span className="font-bold text-amber-300">{formatRupiah0(visitor.count)}</span>
            ) : (
              <span className="inline-block h-4 w-10 animate-pulse rounded bg-white/20" aria-label="memuat" />
            )}
          </span>
        </p>
        <p className="text-xs text-slate-400">{settings.footerText}</p>
      </div>
    </footer>
  )
}
