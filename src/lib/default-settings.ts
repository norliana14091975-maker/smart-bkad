import type { AppSettingsDto } from '@/types/budget'

/**
 * Nilai bawaan pengaturan aplikasi — dipakai saat pengaturan belum diubah
 * admin. Aman diimpor di komponen client (tanpa dependensi server).
 */
export const DEFAULT_SETTINGS: AppSettingsDto = {
  appName: 'DASHBOARD',
  appTitle: 'Dashboard Keuangan DKI',
  appDescription:
    'Dashboard Monitoring Pengelolaan Keuangan Daerah, Anggaran Pendapatan dan Belanja Daerah Pemerintah Provinsi DKI Jakarta',
  govName: 'Pemerintah Provinsi DKI Jakarta',
  brandText: 'BPKD',
  brandSubtext: 'Provinsi DKI Jakarta',
  logoUrl: null,
  sidebarLogoUrl: null,
  emblemUrl: null,
  headerColor: null,
  faviconUrl: null,
  footerText:
    'Dashboard Monitoring Pengelolaan Keuangan Daerah — Pemerintah Provinsi DKI Jakarta',
}
