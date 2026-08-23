'use client'

import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Pembungkus section admin: jika belum login, tampilkan kartu peringatan
 * dengan tombol login (pertahanan ekstra — menu admin hanya muncul setelah login).
 */
export function AdminGuard({
  admin,
  onLoginClick,
  children,
}: {
  admin: string | null
  onLoginClick: () => void
  children: React.ReactNode
}) {
  if (admin) return <>{children}</>

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="max-w-sm rounded-lg border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Lock className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        </div>
        <h2 className="text-base font-bold text-foreground">Akses Terbatas</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Silakan login sebagai admin untuk mengelola data sistem.
        </p>
        <Button onClick={onLoginClick} className="mt-4 bg-[#17408b] text-white hover:bg-[#12326e]">
          <Lock className="h-4 w-4" aria-hidden="true" /> Login Admin
        </Button>
      </div>
    </div>
  )
}
