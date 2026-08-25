import { db } from '@/lib/db'
import { verifyPassword, type AdminUserPayload } from '@/lib/auth'
import { getSettings } from '@/lib/settings'
import { DEFAULT_SETTINGS } from '@/lib/default-settings'
import { getCopilotConfig } from '@/lib/copilot-config'
import type { SetupWizardStatusDto } from '@/types/budget'

/**
 * Setup Wizard — status konfigurasi awal aplikasi (server-side).
 * Penanda "selesai" disimpan di tabel app_setting sehingga wizard hanya
 * terbuka otomatis sekali (dapat dijalankan ulang kapan saja dari Pengaturan).
 */

/** Key app_setting penanda setup selesai (nilai = ISO timestamp). */
export const SETUP_WIZARD_KEY = 'setupWizardCompleted'

/**
 * Hitung status Setup Wizard:
 * - completed / completedAt — apakah admin pernah menandai setup selesai
 * - checks.identityConfigured — identitas (judul & nama pemda) sudah
 *   dikustomisasi dari nilai bawaan DKI
 * - checks.passwordDefault — akun admin yang menjalankan wizard masih
 *   memakai password bawaan "admin123" (true = perlu diganti)
 * - checks.copilotConfigured — AI Copilot memakai provider kustom
 *   (false = mesin bawaan Z.ai, tetap berfungsi tanpa konfigurasi)
 */
export async function getSetupWizardStatus(admin: AdminUserPayload): Promise<SetupWizardStatusDto> {
  const [settingRow, settings, copilot, adminRow] = await Promise.all([
    db.appSetting.findUnique({ where: { key: SETUP_WIZARD_KEY } }),
    getSettings(),
    getCopilotConfig(),
    db.adminUser.findUnique({ where: { id: admin.id }, select: { passwordHash: true } }),
  ])

  const identityConfigured =
    settings.appTitle !== DEFAULT_SETTINGS.appTitle || settings.govName !== DEFAULT_SETTINGS.govName

  const passwordDefault = adminRow ? verifyPassword('admin123', adminRow.passwordHash) : false

  return {
    completed: !!settingRow,
    completedAt: settingRow?.value ?? null,
    username: admin.username,
    checks: {
      identityConfigured,
      passwordDefault,
      copilotConfigured: copilot.provider !== 'default',
    },
  }
}

/** Tandai setup selesai (timestamp saat ini). */
export async function markSetupCompleted(): Promise<void> {
  await db.appSetting.upsert({
    where: { key: SETUP_WIZARD_KEY },
    update: { value: new Date().toISOString() },
    create: { key: SETUP_WIZARD_KEY, value: new Date().toISOString() },
  })
}

/** Hapus penanda selesai — wizard akan terbuka otomatis pada login admin berikutnya. */
export async function resetSetupCompleted(): Promise<void> {
  await db.appSetting.deleteMany({ where: { key: SETUP_WIZARD_KEY } })
}
