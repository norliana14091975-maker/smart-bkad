'use client'

import { Badge } from '@/components/ui/badge'
import { levelBadge } from '@/lib/kode-akun'

/**
 * Batas lebar bawaan untuk kolom "Kode & Uraian".
 * Nama akun yang panjang otomatis TURUN ke baris berikutnya (wrap) alih-alih
 * memanjang ke samping, sehingga kolom Anggaran, Realisasi, dan % selalu
 * terlihat tanpa harus menggulir tabel ke kanan.
 */
export const URAIAN_MAX_W =
  'max-w-[240px] sm:max-w-[260px] md:max-w-[320px] lg:max-w-[400px] xl:max-w-[480px] 2xl:max-w-[620px]'

/**
 * Sel uraian seragam untuk seluruh tabel rincian/kelola:
 * - indentasi bertingkat mengikuti level kode rekening Permendagri (L1-L6)
 * - kode rekening selalu satu baris (shrink-0, mono)
 * - nama akun membungkus ke bawah bila melebihi batas lebar (break-words)
 * - badge level opsional (withBadge) mengikuti gaya tabel rincian
 */
export function AkunUraian({
  code,
  name,
  level = 1,
  withBadge = false,
  className = '',
}: {
  code?: string
  name: string
  level?: number
  withBadge?: boolean
  className?: string
}) {
  return (
    <div
      className={`flex flex-wrap items-baseline gap-x-2 ${className || URAIAN_MAX_W}`}
      style={{ paddingLeft: `${(level - 1) * 14}px` }}
    >
      {withBadge && (
        <Badge
          variant="secondary"
          className={`shrink-0 whitespace-nowrap font-mono text-[10px] ${
            level <= 2 ? 'bg-[#17408b]/10 text-[#17408b]' : 'bg-muted'
          }`}
        >
          {levelBadge(level)}
        </Badge>
      )}
      {code ? <span className="shrink-0 font-mono text-xs font-semibold">{code}</span> : null}
      <span className="min-w-[6.5rem] flex-1 whitespace-normal break-words text-sm">{name}</span>
    </div>
  )
}
