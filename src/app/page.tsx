'use client'

import { useEffect, useState } from 'react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { HeaderBand, PageHeader } from '@/components/dashboard/header'
import { SidebarNav, type SectionId } from '@/components/dashboard/sidebar'
import { VisitorFooter } from '@/components/dashboard/visitor-footer'
import { ApbdSection } from '@/components/dashboard/sections/apbd-section'
import { PendapatanSection } from '@/components/dashboard/sections/pendapatan-section'
import { BelanjaSection } from '@/components/dashboard/sections/belanja-section'
import { PembiayaanSection } from '@/components/dashboard/sections/pembiayaan-section'
import { RealisasiAkunSection } from '@/components/dashboard/sections/realisasi-akun-section'
import { RealisasiSkpdSection } from '@/components/dashboard/sections/realisasi-skpd-section'
import { TransparansiSection } from '@/components/dashboard/sections/transparansi-section'
import { AdminOverviewSection } from '@/components/dashboard/sections/admin-overview-section'
import { AdminApbdSection } from '@/components/dashboard/sections/admin-apbd-section'
import { AdminBudgetSection } from '@/components/dashboard/sections/admin-budget-section'
import { AdminRealisasiSection } from '@/components/dashboard/sections/admin-realisasi-section'
import { AdminImportSection } from '@/components/dashboard/sections/admin-import-section'
import { AdminTransparansiSection } from '@/components/dashboard/sections/admin-transparansi-section'
import { LoginDialog } from '@/components/dashboard/admin/login-dialog'
import { AdminGuard } from '@/components/dashboard/admin/admin-guard'

const SECTION_META: Record<
  SectionId,
  { title: string; breadcrumbHome: string; breadcrumbCurrent: string }
> = {
  apbd: { title: 'APBD', breadcrumbHome: 'DASHBOARD', breadcrumbCurrent: 'APBD' },
  pendapatan: { title: 'Anggaran Pendapatan', breadcrumbHome: 'Beranda', breadcrumbCurrent: 'Anggaran Pendapatan' },
  belanja: { title: 'Anggaran Belanja', breadcrumbHome: 'Beranda', breadcrumbCurrent: 'Anggaran Belanja' },
  pembiayaan: { title: 'Anggaran Pembiayaan', breadcrumbHome: 'Beranda', breadcrumbCurrent: 'Anggaran Pembiayaan' },
  'realisasi-akun': { title: 'Realisasi Anggaran Per-Akun', breadcrumbHome: 'Dashboard', breadcrumbCurrent: 'Akun' },
  'realisasi-skpd': { title: 'Realisasi Anggaran Per-SKPD', breadcrumbHome: 'Dashboard', breadcrumbCurrent: 'SKPD' },
  'transparansi-apbd': { title: 'Transparansi', breadcrumbHome: 'Transparansi', breadcrumbCurrent: 'APBD' },
  'transparansi-realisasi': { title: 'Transparansi', breadcrumbHome: 'Transparansi', breadcrumbCurrent: 'Realisasi' },
  'admin-overview': { title: 'Ringkasan Admin', breadcrumbHome: 'Admin', breadcrumbCurrent: 'Ringkasan' },
  'admin-apbd': { title: 'Kelola Data APBD', breadcrumbHome: 'Admin', breadcrumbCurrent: 'Data APBD' },
  'admin-budget': { title: 'Kelola Item Anggaran', breadcrumbHome: 'Admin', breadcrumbCurrent: 'Item Anggaran' },
  'admin-realisasi': { title: 'Kelola Data Realisasi', breadcrumbHome: 'Admin', breadcrumbCurrent: 'Data Realisasi' },
  'admin-import': { title: 'Import LRA dari PDF', breadcrumbHome: 'Admin', breadcrumbCurrent: 'Import LRA' },
  'admin-transparansi': { title: 'Kelola Dokumen Transparansi', breadcrumbHome: 'Admin', breadcrumbCurrent: 'Transparansi' },
}

const ADMIN_SECTIONS: SectionId[] = [
  'admin-overview',
  'admin-apbd',
  'admin-budget',
  'admin-realisasi',
  'admin-import',
  'admin-transparansi',
]

export default function Home() {
  const [section, setSection] = useState<SectionId>('apbd')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [admin, setAdmin] = useState<string | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)

  const meta = SECTION_META[section]

  // Cek sesi admin saat halaman dimuat
  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const username = (json as { data?: { username: string } } | null)?.data?.username
        if (!cancelled && username) setAdmin(username)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    document.title = 'Dashboard Keuangan DKI'
  }, [])

  const handleSelect = (id: SectionId) => {
    setSection(id)
    setMobileOpen(false)
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleLoginSuccess = (username: string) => {
    setAdmin(username)
    setLoginOpen(false)
    handleSelect('admin-overview')
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // abaikan kegagalan jaringan
    }
    setAdmin(null)
    handleSelect('apbd')
  }

  const isAdminSection = ADMIN_SECTIONS.includes(section)

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f6f8]">
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Sidebar desktop */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 lg:block" aria-label="Sidebar">
          <SidebarNav
            active={section}
            onSelect={handleSelect}
            className="h-full"
            admin={admin}
            onLoginClick={() => setLoginOpen(true)}
            onLogout={handleLogout}
          />
        </aside>

        {/* Sidebar mobile */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-72 border-0 p-0 [&>button]:text-white">
            <SheetTitle className="sr-only">Menu Navigasi</SheetTitle>
            <SidebarNav
              active={section}
              onSelect={handleSelect}
              className="h-full rounded-r-lg"
              admin={admin}
              onLoginClick={() => {
                setMobileOpen(false)
                setLoginOpen(true)
              }}
              onLogout={handleLogout}
            />
          </SheetContent>
        </Sheet>

        {/* Konten utama */}
        <div className="flex min-w-0 flex-1 flex-col">
          <HeaderBand />
          <PageHeader
            title={meta.title}
            breadcrumbHome={meta.breadcrumbHome}
            breadcrumbCurrent={meta.breadcrumbCurrent}
            onToggleSidebar={() => setMobileOpen(true)}
          />

          <main className="flex-1 px-4 py-6 sm:px-6" aria-live="polite">
            {section === 'apbd' && <ApbdSection />}
            {section === 'pendapatan' && <PendapatanSection />}
            {section === 'belanja' && <BelanjaSection />}
            {section === 'pembiayaan' && <PembiayaanSection />}
            {section === 'realisasi-akun' && <RealisasiAkunSection />}
            {section === 'realisasi-skpd' && <RealisasiSkpdSection />}
            {section === 'transparansi-apbd' && <TransparansiSection initialType="APBD" />}
            {section === 'transparansi-realisasi' && <TransparansiSection initialType="Realisasi" />}

            {isAdminSection && (
              <AdminGuard admin={admin} onLoginClick={() => setLoginOpen(true)}>
                {section === 'admin-overview' && <AdminOverviewSection />}
                {section === 'admin-apbd' && <AdminApbdSection />}
                {section === 'admin-budget' && <AdminBudgetSection />}
                {section === 'admin-realisasi' && <AdminRealisasiSection />}
                {section === 'admin-import' && <AdminImportSection />}
                {section === 'admin-transparansi' && <AdminTransparansiSection />}
              </AdminGuard>
            )}
          </main>

          <VisitorFooter />
        </div>
      </div>

      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} onSuccess={handleLoginSuccess} />
    </div>
  )
}
