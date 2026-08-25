'use client'

import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AuthUserDto } from '@/types/budget'

/**
 * Pembungkus section terbatas: jika user belum login dengan peran yang
 * diizinkan, tampilkan kartu peringatan dengan tombol login (pertahanan
 * ekstra — menu hanya muncul setelah login).
 *
 * `roles` default ['admin'] (section kelola admin). Section Analisis & AI
 * memakai roles=['admin','kepala_daerah'].
 */
export function AdminGuard({
  user,
  onLoginClick,
  roles,
  children,
}: {
  user: AuthUserDto | null
  onLoginClick: () => void
  /** Peran yang diizinkan mengakses section; default hanya admin */
  roles?: AuthUserDto['role'][]
  children: React.ReactNode
}) {
  const allowed = roles ?? ['admin']
  if (user && allowed.includes(user.role)) return <>{children}</>

  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="max-w-sm rounded-lg border bg-card p-6 text-center shadow-sm">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <Lock className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
        </div>
        <h2 className="text-base font-bold text-foreground">Akses Terbatas</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {allowed.length > 1
            ? 'Silakan login sebagai admin atau Kepala Daerah untuk mengakses fitur ini.'
            : 'Silakan login sebagai admin untuk mengelola data sistem.'}
        </p>
        <Button onClick={onLoginClick} className="mt-4 bg-[#17408b] text-white hover:bg-[#12326e]">
          <Lock className="h-4 w-4" aria-hidden="true" /> Login
        </Button>
      </div>
    </div>
  )
}
