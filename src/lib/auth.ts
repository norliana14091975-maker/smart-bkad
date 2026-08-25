import crypto from 'crypto'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Nama cookie sesi admin (httpOnly)
export const SESSION_COOKIE = 'dashboard_admin_session'

// Masa berlaku sesi: 7 hari
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60

export interface AdminUserPayload {
  id: string
  username: string
  role: 'admin' | 'opd' | 'kepala_daerah'
  opdId: number | null
  opdName: string | null
}

/** Peran yang boleh mengakses fitur Analisis & AI (Ringkasan Eksekutif,
 * Analisis Risiko, AI Copilot): admin penuh dan Kepala Daerah. */
export const EXECUTIVE_ROLES: AdminUserPayload['role'][] = ['admin', 'kepala_daerah']

/**
 * Verifikasi password terhadap hash scrypt dengan format "salt:hash" (hex, keylen 64).
 * Pola yang sama dipakai pada prisma/seed.ts (fungsi hashPassword).
 */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false

  const candidate = crypto.scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  if (candidate.length !== expected.length) return false

  return crypto.timingSafeEqual(candidate, expected)
}

/**
 * Ambil user admin yang sedang login dari cookie sesi.
 * Next 16: cookies() bersifat async sehingga wajib di-await.
 * Mengembalikan null jika tidak ada cookie, sesi tidak ditemukan, atau sesi kedaluwarsa.
 */
export async function getAdminUser(): Promise<AdminUserPayload | null> {
  try {
    const store = await cookies()
    const sessionId = store.get(SESSION_COOKIE)?.value
    if (!sessionId) return null

    const session = await db.adminSession.findUnique({
      where: { id: sessionId },
      include: { user: { include: { opd: true } } },
    })
    if (!session) return null

    // Sesi kedaluwarsa → hapus dan anggap belum login
    if (session.expiresAt.getTime() < Date.now()) {
      await db.adminSession.deleteMany({ where: { id: session.id } })
      return null
    }

    // Akun dinonaktifkan admin (Manajemen Pengguna) → hapus semua sesinya
    // dan anggap belum login
    if (!session.user.active) {
      await db.adminSession.deleteMany({ where: { userId: session.user.id } })
      return null
    }

    return {
      id: session.user.id,
      username: session.user.username,
      role:
        session.user.role === 'opd'
          ? 'opd'
          : session.user.role === 'kepala_daerah'
            ? 'kepala_daerah'
            : 'admin',
      opdId: session.user.opd?.id ?? null,
      opdName: session.user.opd?.name ?? null,
    }
  } catch (error) {
    console.error('getAdminUser error', error)
    return null
  }
}

/**
 * Guard khusus admin penuh: mengembalikan user hanya jika role 'admin'.
 * Route admin memakai ini agar akun OPD tidak bisa mengakses API admin.
 */
export async function requireAdmin(): Promise<AdminUserPayload | null> {
  const user = await getAdminUser()
  if (!user || user.role !== 'admin') return null
  return user
}

/**
 * Guard fitur Analisis & AI (Ringkasan Eksekutif, Analisis Risiko, AI
 * Copilot): hanya admin penuh dan Kepala Daerah yang diizinkan.
 * Akun OPD dan pengunjung anonim ditolak.
 */
export async function requireExecutive(): Promise<AdminUserPayload | null> {
  const user = await getAdminUser()
  if (!user || !EXECUTIVE_ROLES.includes(user.role)) return null
  return user
}

/**
 * Buat sesi baru untuk user admin (id UUID acak, kedaluwarsa 7 hari).
 */
export async function createSession(userId: string): Promise<{ id: string; expiresAt: Date }> {
  const id = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await db.adminSession.create({ data: { id, userId, expiresAt } })
  return { id, expiresAt }
}

/**
 * Hapus sesi berdasarkan id (idempoten, tidak error jika tidak ada).
 */
export async function deleteSession(sessionId: string): Promise<void> {
  await db.adminSession.deleteMany({ where: { id: sessionId } })
}

/**
 * Respons standar 401 untuk endpoint admin yang butuh sesi valid.
 */
export function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Tidak diizinkan. Silakan login.' }, { status: 401 })
}
