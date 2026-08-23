import { createRequire } from 'module'
import path from 'path'
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Muat ulang modul hasil generate Prisma langsung dari disk.
 *
 * Latar belakang: dev server dapat terus berjalan ketika `prisma generate`
 * dijalankan ulang (mis. setelah perubahan skema). Modul '@prisma/client'
 * yang sudah termuat di cache require Node masih versi lama sehingga model
 * baru (mis. adminUser / importLog) tidak tersedia pada instance berjalan.
 * Fungsi ini membuang entri cache require lalu memuat ulang file client
 * hasil generate agar model terbaru selalu tersedia.
 */
function loadFreshPrismaClientConstructor(): typeof PrismaClient | null {
  try {
    const requireNative = createRequire(path.join(process.cwd(), 'package.json'))
    const clientPath = requireNative.resolve('./node_modules/.prisma/client/index.js')
    if (requireNative.cache[clientPath]) {
      delete requireNative.cache[clientPath]
    }
    const mod = requireNative(clientPath) as {
      PrismaClient: typeof PrismaClient
    }
    return mod.PrismaClient
  } catch {
    // Gagal memuat manual (mis. struktur folder berbeda) → null, fallback ke import statis
    return null
  }
}

/**
 * Pastikan instance global PrismaClient memuat seluruh model terbaru.
 * Jika instance lama masih ada (dibuat sebelum generate ulang) dan tidak
 * memiliki model baru, buat instance segar dan ganti global.
 */
function ensureFreshClient(): PrismaClient {
  const existing = globalForPrisma.prisma
  if (existing && 'adminUser' in existing && 'importLog' in existing) {
    return existing
  }

  const Ctor = loadFreshPrismaClientConstructor() ?? PrismaClient
  const client = new Ctor({
    log: ['query'],
  })
  globalForPrisma.prisma = client
  return client
}

export const db = ensureFreshClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
