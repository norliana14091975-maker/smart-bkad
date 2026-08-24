import crypto from 'crypto'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/password'

/**
 * Slug nama OPD menjadi username: "DINAS KESEHATAN" → "dinas-kesehatan".
 */
export function slugifyUsername(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
  return slug || 'opd'
}

/**
 * Buat username unik dari nama OPD; jika sudah dipakai tambahkan -2, -3, …
 */
export async function generateUniqueUsername(name: string): Promise<string> {
  const base = slugifyUsername(name)
  let candidate = base
  let n = 2
  while (await db.adminUser.findUnique({ where: { username: candidate } })) {
    candidate = `${base}-${n++}`
  }
  return candidate
}

/**
 * Password acak untuk akun OPD, format: Opd-xxxxxxxxxx (10 karakter acak).
 */
export function generatePassword(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.randomBytes(10)
  let pwd = ''
  for (let i = 0; i < 10; i++) pwd += chars[bytes[i] % chars.length]
  return `Opd-${pwd}`
}

/**
 * Buat OPD beserta akun loginnya secara transaksional.
 * Mengembalikan data OPD + kredensial (password plain, hanya sekali).
 */
export async function createOpdWithUser(code: string | undefined, name: string) {
  return db.$transaction(async (tx) => {
    // Kode OPD: pakai input admin, atau gener otomatis OPD-001 dst.
    let finalCode = code?.trim() ?? ''
    if (!finalCode) {
      const count = await tx.opd.count()
      let n = count + 1
      finalCode = `OPD-${String(n).padStart(3, '0')}`
      // hindari tabrakan dengan kode manual yang sudah ada
      while (await tx.opd.findUnique({ where: { code: finalCode } })) {
        n += 1
        finalCode = `OPD-${String(n).padStart(3, '0')}`
      }
    }

    const opd = await tx.opd.create({ data: { code: finalCode, name } })

    const username = await generateUniqueUsername(name)
    const password = generatePassword()
    await tx.adminUser.create({
      data: {
        username,
        passwordHash: hashPassword(password),
        role: 'opd',
        opdId: opd.id,
      },
    })

    return { opd, username, password }
  })
}

/**
 * Reset password akun OPD: buat password baru + hapus sesi lama
 * (memaksa login ulang). Mengembalikan password plain sekali saja.
 */
export async function resetOpdPassword(opdId: number): Promise<{ username: string; password: string } | null> {
  const user = await db.adminUser.findUnique({ where: { opdId } })
  if (!user) return null

  const password = generatePassword()
  await db.$transaction([
    db.adminUser.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword(password) },
    }),
    db.adminSession.deleteMany({ where: { userId: user.id } }),
  ])
  return { username: user.username, password }
}
