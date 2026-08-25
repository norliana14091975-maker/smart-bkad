import crypto from 'crypto'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/password'
import type { UserRowDto } from '@/types/budget'

/** Peran pengguna yang dikenal sistem. */
export const USER_ROLES = ['admin', 'kepala_daerah', 'opd'] as const
export type UserRole = (typeof USER_ROLES)[number]

/** Label tampilan peran (Bahasa Indonesia). */
export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  kepala_daerah: 'Kepala Daerah',
  opd: 'OPD/SKPD',
}

/** Normalisasi string peran dari DB ke tipe UserRole yang aman. */
export function normalizeRole(raw: string): UserRole {
  return raw === 'opd' || raw === 'kepala_daerah' ? raw : 'admin'
}

/** Validasi username: 3-40 karakter, alfanumerik + titik/garisbawah/garispisah, diawali alfanumerik. */
export function isValidUsername(username: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{2,39}$/.test(username)
}

/**
 * Password acak untuk akun baru, format: Akun-xxxxxxxxxx (10 karakter acak
 * tanpa karakter yang mudah tertukar). Pola serupa dengan akun OPD.
 */
export function generateUserPassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.randomBytes(10)
  let pwd = ''
  for (let i = 0; i < 10; i++) pwd += chars[bytes[i] % chars.length]
  return `Akun-${pwd}`
}

/**
 * Daftar seluruh pengguna beserta nama OPD terkait dan jumlah sesi aktif.
 * Diurutkan: admin dulu, lalu kepala_daerah, lalu opd, masing-masing per username.
 */
export async function listUsers(): Promise<UserRowDto[]> {
  const users = await db.adminUser.findMany({
    include: { opd: { select: { name: true, active: true } } },
    orderBy: [{ role: 'asc' }, { username: 'asc' }],
  })

  const now = Date.now()
  const sessionCounts = await db.adminSession.groupBy({
    by: ['userId'],
    where: { expiresAt: { gt: new Date(now) } },
    _count: { _all: true },
  })
  const countMap = new Map(sessionCounts.map((s) => [s.userId, s._count._all]))

  return users.map((u) => ({
    id: u.id,
    username: u.username,
    role: normalizeRole(u.role),
    opdName: u.opd?.name ?? null,
    active: u.active,
    opdActive: u.opd ? u.opd.active : null,
    sessionCount: countMap.get(u.id) ?? 0,
    createdAt: u.createdAt.toISOString(),
  }))
}

/**
 * Jumlah akun admin penuh yang aktif (kecuali satu id tertentu, bila diberikan).
 * Dipakai untuk proteksi "admin terakhir" agar admin tidak mengunci dirinya sendiri.
 */
export async function countActiveAdmins(excludeId?: string): Promise<number> {
  return db.adminUser.count({
    where: {
      role: 'admin',
      active: true,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  })
}

/**
 * Reset password pengguna: pakai password kustom (bila ada) atau buat baru,
 * lalu hapus semua sesi loginnya (memaksa login ulang). Bila keepSessionId
 * diberikan (sesi admin yang sedang mereset password akunnya sendiri), sesi
 * tersebut tetap dipertahankan agar admin tidak keluar mendadak.
 * Mengembalikan password plain HANYA sekali di sini (untuk ditampilkan admin).
 */
export async function resetUserPassword(
  userId: string,
  customPassword?: string,
  keepSessionId?: string
): Promise<{ username: string; password: string } | null> {
  const user = await db.adminUser.findUnique({ where: { id: userId } })
  if (!user) return null

  const password = customPassword?.trim() || generateUserPassword()
  await db.$transaction([
    db.adminUser.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword(password) },
    }),
    db.adminSession.deleteMany({
      where: { userId: user.id, ...(keepSessionId ? { id: { not: keepSessionId } } : {}) },
    }),
  ])
  return { username: user.username, password }
}
