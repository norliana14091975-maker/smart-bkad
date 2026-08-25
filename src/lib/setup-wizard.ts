import { db } from '@/lib/db'
import type { AdminUserPayload } from '@/lib/auth'
import { getSettings } from '@/lib/settings'
import { getCopilotConfig } from '@/lib/copilot-config'
import type { SetupWizardStatusDto } from '@/types/budget'

/**
 * Setup Wizard — status konfigurasi awal aplikasi (server-side).
 *
 * Dua mode wizard:
 * 1. FIRST-RUN (inisialisasi): aplikasi dijalankan pertama kali dan belum
 *    ada akun admin sama sekali → wizard layar-penuh membuat akun admin
 *    pertama + konfigurasi dasar (tanpa akun bawaan demi keamanan).
 * 2. PANDUAN ADMIN: dialog opsional setelah login admin — dapat dijalankan
 *    ulang kapan saja dari kartu Setup Wizard di Pengaturan Aplikasi.
 *
 * Penanda "selesai" disimpan di tabel app_setting.
 */

/** Key app_setting penanda setup selesai (nilai = ISO timestamp). */
export const SETUP_WIZARD_KEY = 'setupWizardCompleted'

/** Pola sisa data lama Provinsi DKI Jakarta pada identitas. */
const DKI_LEGACY_RE = /dki|jakarta|bpkd/i

/**
 * Apakah aplikasi perlu menjalankan Setup Wizard first-run?
 * True bila belum ada akun admin sama sekali (instalasi baru).
 */
export async function isFirstRunNeeded(): Promise<boolean> {
  const count = await db.adminUser.count({ where: { role: 'admin' } })
  return count === 0
}

/**
 * Hitung status Setup Wizard (mode panduan admin):
 * - completed / completedAt — apakah admin pernah menandai setup selesai
 * - checks.identityConfigured — identitas (judul & nama pemda) sudah aman
 *   dipakai (terisi dan bukan sisa data lama DKI Jakarta)
 * - checks.copilotConfigured — AI Copilot memakai provider kustom
 *   (false = mesin bawaan Z.ai, tetap berfungsi tanpa konfigurasi)
 */
export async function getSetupWizardStatus(admin: AdminUserPayload): Promise<SetupWizardStatusDto> {
  const [settingRow, settings, copilot] = await Promise.all([
    db.appSetting.findUnique({ where: { key: SETUP_WIZARD_KEY } }),
    getSettings(),
    getCopilotConfig(),
  ])

  const identityConfigured =
    !!settings.appTitle?.trim() &&
    !!settings.govName?.trim() &&
    !DKI_LEGACY_RE.test(settings.appTitle) &&
    !DKI_LEGACY_RE.test(settings.govName)

  return {
    completed: !!settingRow,
    completedAt: settingRow?.value ?? null,
    username: admin.username,
    checks: {
      identityConfigured,
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
