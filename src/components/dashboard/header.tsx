'use client'

import { Menu } from 'lucide-react'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { BrandLogo, GoldEmblem } from '@/components/dashboard/emblem'
import type { AppSettingsDto } from '@/types/budget'

/**
 * Pita biru atas: logo (bawaan/kustom) di kiri, lencana emas di kanan,
 * dengan pola watermark ikon keuangan.
 */
export function HeaderBand({ settings }: { settings: AppSettingsDto }) {
  // Warna header: pengaturan admin (hex) atau gradien bawaan
  const headerBg = settings.headerColor
    ? { backgroundColor: settings.headerColor }
    : undefined

  return (
    <div
      className="relative overflow-hidden bg-gradient-to-r from-[#17408b] via-[#1d4ed8] to-[#17408b]"
      style={headerBg}
      role="banner"
    >
      {/* pola watermark ikon keuangan */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='2'%3E%3Crect x='10' y='60' width='10' height='30'/%3E%3Crect x='24' y='46' width='10' height='44'/%3E%3Crect x='38' y='32' width='10' height='58'/%3E%3Ccircle cx='85' cy='40' r='12'/%3E%3Cpath d='M85 30 v20 M75 40 h20'/%3E%3Ccircle cx='30' cy='14' r='8'/%3E%3Cpath d='M104 70 l8 -8 8 8 -8 8 z'/%3E%3C/g%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
        }}
      />
      <div className="relative mx-auto flex max-w-full items-center justify-between gap-4 px-4 py-4 sm:px-6">
        {settings.logoUrl ? (
          <div className="flex items-center gap-3">
            <img
              src={settings.logoUrl}
              alt={settings.brandText}
              className="h-12 w-12 shrink-0 object-contain drop-shadow-sm"
            />
            <div className="leading-tight">
              <div className="text-lg font-extrabold tracking-wide text-white drop-shadow-sm">
                {settings.brandText}
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/80">
                {settings.brandSubtext}
              </div>
            </div>
          </div>
        ) : (
          <BrandLogo text={settings.brandText} subtext={settings.brandSubtext} />
        )}
        {/* Logo pojok kanan: pengaturan khusus lencana, fallback emblem emas bawaan */}
        {settings.emblemUrl ? (
          <img
            src={settings.emblemUrl}
            alt="Lencana aplikasi"
            className="hidden h-20 w-20 shrink-0 object-contain sm:block md:h-24 md:w-24"
          />
        ) : (
          <GoldEmblem className="hidden h-20 w-20 shrink-0 sm:block md:h-24 md:w-24" />
        )}
      </div>
    </div>
  )
}

interface PageHeaderProps {
  onToggleSidebar: () => void
}

/** Baris judul halaman + breadcrumb, dengan tombol toggle sidebar di mobile. */
export function PageHeader({ title, breadcrumbHome, breadcrumbCurrent, onToggleSidebar }: PageHeaderProps & { title: string; breadcrumbHome: string; breadcrumbCurrent: string }) {
  return (
    <div className="flex flex-col gap-2 border-b bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background text-foreground shadow-sm transition-colors hover:bg-muted lg:hidden"
          aria-label="Buka atau tutup menu"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <h1 className="text-lg font-bold uppercase tracking-wide text-foreground sm:text-xl">
          {title}
        </h1>
      </div>
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <a href="#" onClick={(e) => e.preventDefault()}>{breadcrumbHome}</a>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{breadcrumbCurrent}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  )
}
