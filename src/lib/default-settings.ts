import type { AppSettingsDto } from '@/types/budget'

/**
 * Nilai bawaan pengaturan aplikasi — dipakai saat pengaturan belum diubah
 * admin. Aman diimpor di komponen client (tanpa dependensi server).
 */
export const DEFAULT_SETTINGS: AppSettingsDto = {
  appName: 'DASHBOARD',
  appTitle: 'Dashboard Keuangan Kab. Seruyan',
  appDescription:
    'Dashboard Monitoring Pengelolaan Keuangan Daerah, Anggaran Pendapatan dan Belanja Daerah Pemerintah Kabupaten Seruyan',
  govName: 'Pemerintah Kabupaten Seruyan',
  brandText: 'PEMDA',
  brandSubtext: 'Kabupaten Seruyan',
  logoUrl: null,
  sidebarLogoUrl: null,
  emblemUrl: null,
  headerColor: null,
  faviconUrl: null,
  footerText:
    'Dashboard Monitoring Pengelolaan Keuangan Daerah — Pemerintah Kabupaten Seruyan',
}
