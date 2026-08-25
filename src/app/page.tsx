'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
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
import { AdminSettingsSection } from '@/components/dashboard/sections/admin-settings-section'
import { AdminOpdSection } from '@/components/dashboard/sections/admin-opd-section'
import { AdminUsersSection } from '@/components/dashboard/sections/admin-users-section'
import { ExecutiveSummarySection } from '@/components/dashboard/sections/executive-summary-section'
import { RiskAnalysisSection } from '@/components/dashboard/sections/risk-analysis-section'
import { CopilotWidget } from '@/components/dashboard/copilot-widget'
import { OpdDashboardSection } from '@/components/dashboard/sections/opd-dashboard-section'
import { OpdImportSection } from '@/components/dashboard/sections/opd-import-section'
import { LoginDialog } from '@/components/dashboard/admin/login-dialog'
import { AdminGuard } from '@/components/dashboard/admin/admin-guard'
import { SetupWizard } from '@/components/dashboard/setup-wizard'
import { useSettings } from '@/hooks/use-settings'
import { DEFAULT_SETTINGS } from '@/lib/default-settings'
import type { AuthUserDto, SetupWizardStatusDto } from '@/types/budget'

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
  'ringkasan-eksekutif': { title: 'Ringkasan Eksekutif', breadcrumbHome: 'Analisis', breadcrumbCurrent: 'Ringkasan Eksekutif' },
  'analisis-risiko': { title: 'Analisis Risiko', breadcrumbHome: 'Analisis', breadcrumbCurrent: 'Analisis Risiko' },
  'admin-overview': { title: 'Ringkasan Admin', breadcrumbHome: 'Admin', breadcrumbCurrent: 'Ringkasan' },
  'admin-apbd': { title: 'Kelola Data APBD', breadcrumbHome: 'Admin', breadcrumbCurrent: 'Data APBD' },
  'admin-budget': { title: 'Kelola Item Anggaran', breadcrumbHome: 'Admin', breadcrumbCurrent: 'Item Anggaran' },
  'admin-realisasi': { title: 'Kelola Data Realisasi', breadcrumbHome: 'Admin', breadcrumbCurrent: 'Data Realisasi' },
  'admin-import': { title: 'Import LRA dari PDF', breadcrumbHome: 'Admin', breadcrumbCurrent: 'Import LRA' },
  'admin-transparansi': { title: 'Kelola Dokumen Transparansi', breadcrumbHome: 'Admin', breadcrumbCurrent: 'Transparansi' },
  'admin-settings': { title: 'Pengaturan Aplikasi', breadcrumbHome: 'Admin', breadcrumbCurrent: 'Pengaturan' },
  'admin-opd': { title: 'Kelola Data OPD/SKPD', breadcrumbHome: 'Admin', breadcrumbCurrent: 'Data OPD' },
  'admin-users': { title: 'Manajemen Pengguna', breadcrumbHome: 'Admin', breadcrumbCurrent: 'Pengguna' },
  'opd-dashboard': { title: 'Dashboard OPD', breadcrumbHome: 'OPD', breadcrumbCurrent: 'Dashboard OPD' },
  'opd-import': { title: 'Import LRA dari PDF', breadcrumbHome: 'OPD', breadcrumbCurrent: 'Import LRA' },
}

const ADMIN_SECTIONS: SectionId[] = [
  'admin-overview',
  'admin-apbd',
  'admin-budget',
  'admin-realisasi',
  'admin-import',
  'admin-transparansi',
  'admin-settings',
  'admin-opd',
  'admin-users',
]

/** Section Analisis & AI — hanya admin penuh & Kepala Daerah. */
const EXECUTIVE_SECTIONS: SectionId[] = ['ringkasan-eksekutif', 'analisis-risiko']

/** Peran yang boleh melihat fitur Analisis & AI + AI Copilot. */
const EXECUTIVE_ROLE: AuthUserDto['role'][] = ['admin', 'kepala_daerah']

const OPD_SECTIONS: SectionId[] = ['opd-dashboard', 'opd-import']

export default function Home() {
  const [section, setSection] = useState<SectionId>('apbd')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [user, setUser] = useState<AuthUserDto | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)

  // Setup Wizard — terbuka otomatis saat login admin bila belum pernah selesai
  const [wizardOpen, setWizardOpen] = useState(false)
  const wizardAutoChecked = useRef(false)

  // Pengaturan aplikasi (nama, logo, favicon, teks) — gabung dengan bawaan
  const settingsQuery = useSettings()
  const settings = useMemo(
    () => ({ ...DEFAULT_SETTINGS, ...(settingsQuery.data ?? {}) }),
    [settingsQuery.data]
  )

  const meta = SECTION_META[section]

  // Cek sesi admin saat halaman dimuat
  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const data = (json as { data?: AuthUserDto } | null)?.data
        if (!cancelled && data) setUser(data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // Cek status Setup Wizard setelah admin login (sekali per sesi halaman)
  useEffect(() => {
    if (user?.role !== 'admin' || wizardAutoChecked.current) return
    wizardAutoChecked.current = true
    let cancelled = false
    fetch('/api/admin/setup-wizard')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        const data = (json as { data?: SetupWizardStatusDto } | null)?.data
        if (!cancelled && data && !data.completed) setWizardOpen(true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [user?.role])

  // Judul tab browser mengikuti pengaturan
  useEffect(() => {
    document.title = settings.appTitle
  }, [settings.appTitle])

  // Favicon mengikuti pengaturan (diperbarui langsung tanpa reload)
  useEffect(() => {
    if (typeof document === 'undefined') return
    const link = document.querySelector<HTMLLinkElement>("link[rel~='icon']")
    if (settings.faviconUrl) {
      if (link) {
        link.href = settings.faviconUrl
      } else {
        const el = document.createElement('link')
        el.rel = 'icon'
        el.href = settings.faviconUrl
        document.head.appendChild(el)
      }
    }
  }, [settings.faviconUrl])

  const handleSelect = (id: SectionId) => {
    setSection(id)
    setMobileOpen(false)
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleLoginSuccess = (u: AuthUserDto) => {
    setUser(u)
    setLoginOpen(false)
    // Kepala Daerah langsung ke Ringkasan Eksekutif; admin ke ringkasan admin
    handleSelect(
      u.role === 'admin'
        ? 'admin-overview'
        : u.role === 'kepala_daerah'
          ? 'ringkasan-eksekutif'
          : 'opd-dashboard'
    )
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // abaikan kegagalan jaringan
    }
    setUser(null)
    setWizardOpen(false)
    // izinkan wizard dicek ulang pada login admin berikutnya
    wizardAutoChecked.current = false
    handleSelect('apbd')
  }

  const isAdminSection = user?.role === 'admin' && ADMIN_SECTIONS.includes(section)
  const isOpdSection = user?.role === 'opd' && OPD_SECTIONS.includes(section)
  // Section Analisis & AI (admin / Kepala Daerah)
  const isExecutiveSection =
    user != null && EXECUTIVE_ROLE.includes(user.role) && EXECUTIVE_SECTIONS.includes(section)
  const copilotVisible = user != null && EXECUTIVE_ROLE.includes(user.role)

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f6f8]">
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* Sidebar desktop */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 lg:block" aria-label="Sidebar">
          <SidebarNav
            active={section}
            onSelect={handleSelect}
            className="h-full"
            user={user}
            settings={settings}
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
              user={user}
              settings={settings}
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
          <HeaderBand settings={settings} />
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

            {isExecutiveSection && (
              <AdminGuard user={user} onLoginClick={() => setLoginOpen(true)} roles={['admin', 'kepala_daerah']}>
                {section === 'ringkasan-eksekutif' && <ExecutiveSummarySection />}
                {section === 'analisis-risiko' && <RiskAnalysisSection />}
              </AdminGuard>
            )}

            {isAdminSection && (
              <AdminGuard user={user} onLoginClick={() => setLoginOpen(true)}>
                {section === 'admin-overview' && <AdminOverviewSection />}
                {section === 'admin-apbd' && <AdminApbdSection />}
                {section === 'admin-budget' && <AdminBudgetSection />}
                {section === 'admin-realisasi' && <AdminRealisasiSection />}
                {section === 'admin-import' && <AdminImportSection />}
                {section === 'admin-transparansi' && <AdminTransparansiSection />}
                { section === 'admin-settings' && <AdminSettingsSection onOpenWizard={() => setWizardOpen(true)} /> }
                {section === 'admin-opd' && <AdminOpdSection />}
                {section === 'admin-users' && <AdminUsersSection currentUser={user} />}
              </AdminGuard>
            )}

            {isOpdSection && <OpdDashboardSection />}
            {section === 'opd-import' && <OpdImportSection />}
          </main>

          <VisitorFooter settings={settings} />
        </div>
      </div>

      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} onSuccess={handleLoginSuccess} />

      {/* Setup Wizard — khusus admin */}
      {user?.role === 'admin' && (
        <SetupWizard open={wizardOpen} onOpenChange={setWizardOpen} />
      )}

      {/* AI Copilot — hanya admin & Kepala Daerah */}
      {copilotVisible && <CopilotWidget />}
    </div>
  )
}
