'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  BarChart3,
  ChevronDown,
  Eye,
  LayoutDashboard,
  Minus,
  Table2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { DkiEmblem } from '@/components/dashboard/emblem'

export type SectionId =
  | 'apbd'
  | 'pendapatan'
  | 'belanja'
  | 'pembiayaan'
  | 'realisasi-akun'
  | 'realisasi-skpd'
  | 'transparansi-apbd'
  | 'transparansi-realisasi'

interface NavChild {
  id: SectionId
  label: string
}

interface NavGroup {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  children: NavChild[]
}

const NAV: NavGroup[] = [
  {
    id: 'anggaran',
    label: 'Anggaran',
    icon: BarChart3,
    children: [
      { id: 'apbd', label: 'APBD' },
      { id: 'pendapatan', label: 'Pendapatan' },
      { id: 'belanja', label: 'Belanja' },
      { id: 'pembiayaan', label: 'Pembiayaan' },
    ],
  },
  {
    id: 'realisasi',
    label: 'Realisasi',
    icon: Table2,
    children: [
      { id: 'realisasi-akun', label: 'Realisasi Per-Akun' },
      { id: 'realisasi-skpd', label: 'Realisasi Per-SKPD' },
    ],
  },
  {
    id: 'transparansi',
    label: 'Transparansi',
    icon: Eye,
    children: [
      { id: 'transparansi-apbd', label: 'APBD' },
      { id: 'transparansi-realisasi', label: 'Realisasi' },
    ],
  },
]

interface SidebarNavProps {
  active: SectionId
  onSelect: (id: SectionId) => void
  className?: string
}

export function SidebarNav({ active, onSelect, className }: SidebarNavProps) {
  // grup yang berisi item aktif terbuka secara default
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = { anggaran: true, realisasi: false, transparansi: false }
    for (const g of NAV) {
      if (g.children.some((c) => c.id === active)) initial[g.id] = true
    }
    return initial
  })

  const toggle = (id: string) => setOpen((prev) => ({ ...prev, [id]: !prev[id] }))

  return (
    <div className={cn('flex h-full flex-col bg-[#1b2a4a] text-slate-200', className)}>
      {/* Brand */}
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-4">
        <DkiEmblem className="h-9 w-9 shrink-0" />
        <span
          className="text-base font-semibold tracking-[0.3em] text-white"
          aria-label="Dashboard"
        >
          DASHBOARD
        </span>
      </div>

      {/* Menu */}
      <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Menu utama">
        <ul className="space-y-1">
          <li>
            <button
              type="button"
              onClick={() => onSelect('apbd')}
              className={cn(
                'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition-colors hover:bg-white/10',
                active === 'apbd' && 'bg-white/15 text-white'
              )}
            >
              <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>DASHBOARD</span>
            </button>
          </li>

          {NAV.map((group) => {
            const isOpen = open[group.id]
            const groupActive = group.children.some((c) => c.id === active)
            const Icon = group.icon
            return (
              <li key={group.id}>
                <button
                  type="button"
                  onClick={() => toggle(group.id)}
                  aria-expanded={isOpen}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition-colors hover:bg-white/10',
                    groupActive && 'text-white'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="flex-1 text-left">{group.label}</span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 shrink-0 transition-transform',
                      isOpen && 'rotate-180'
                    )}
                    aria-hidden="true"
                  />
                </button>
                {isOpen && (
                  <ul className="mt-1 space-y-0.5 pl-4" role="menu">
                    {group.children.map((child) => (
                      <li key={child.id} role="none">
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => onSelect(child.id)}
                          className={cn(
                            'flex w-full items-center gap-3 rounded-md px-3 py-1.5 text-[13px] transition-colors hover:bg-white/10',
                            active === child.id
                              ? 'bg-white/15 font-semibold text-white'
                              : 'text-slate-300'
                          )}
                        >
                          <Minus className="h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
                          <span className="text-left">{child.label}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer sidebar */}
      <div className="border-t border-white/10 px-4 py-3 text-[11px] text-slate-400">
        <p>Dashboard Keuangan DKI</p>
        <p className="mt-0.5">Pemerintah Provinsi DKI Jakarta</p>
      </div>
    </div>
  )
}
