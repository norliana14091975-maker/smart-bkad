import { db } from '@/lib/db'
import { DEFAULT_SETTINGS } from '@/lib/default-settings'
import type { AppSettingsDto } from '@/types/budget'

/**
 * Baca pengaturan aplikasi dari database, digabung dengan nilai bawaan.
 * Hanya untuk kode server (layout/route) karena mengimpor Prisma.
 */
export async function getSettings(): Promise<AppSettingsDto> {
  const rows = await db.appSetting.findMany()
  const map: Record<string, string> = {}
  for (const r of rows) map[r.key] = r.value

  return {
    appName: map.appName ?? DEFAULT_SETTINGS.appName,
    appTitle: map.appTitle ?? DEFAULT_SETTINGS.appTitle,
    appDescription: map.appDescription ?? DEFAULT_SETTINGS.appDescription,
    brandText: map.brandText ?? DEFAULT_SETTINGS.brandText,
    brandSubtext: map.brandSubtext ?? DEFAULT_SETTINGS.brandSubtext,
    logoUrl: map.logoUrl || null,
    sidebarLogoUrl: map.sidebarLogoUrl || null,
    faviconUrl: map.faviconUrl || null,
    footerText: map.footerText ?? DEFAULT_SETTINGS.footerText,
  }
}
