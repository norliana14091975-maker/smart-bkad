import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireAdmin, unauthorized } from '@/lib/auth'
import { hashPassword } from '@/lib/password'
import {
  USER_ROLES,
  countActiveAdmins,
  generateUserPassword,
  isValidUsername,
  listUsers,
  normalizeRole,
} from '@/lib/users'

/**
 * GET — daftar seluruh pengguna + OPD yang belum punya akun
 * (kandidat tautan saat membuat akun role OPD).
 */
export async function GET() {
  try {
    const admin = await requireAdmin()
    if (!admin) return unauthorized()

    const [users, availableOpds] = await Promise.all([
      listUsers(),
      db.opd.findMany({
        where: { user: null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
    ])
    return NextResponse.json({ data: { users, availableOpds } })
  } catch (error) {
    console.error('GET /api/admin/users error', error)
    return NextResponse.json({ error: 'Gagal memuat data pengguna' }, { status: 500 })
  }
}

/**
 * POST — tambah pengguna baru (admin / Kepala Daerah / OPD).
 * Password kustom opsional; bila kosong dibuat sistem dan hanya
 * dikembalikan sekali di respons ini.
 */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin()
    if (!admin) return unauthorized()

    const body = (await req.json().catch(() => null)) as
      | { username?: unknown; password?: unknown; role?: unknown; opdId?: unknown }
      | null

    const username = typeof body?.username === 'string' ? body.username.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    const role = typeof body?.role === 'string' ? body.role : ''
    const opdId = Number(body?.opdId)

    if (!isValidUsername(username)) {
      return NextResponse.json(
        { error: 'Username 3-40 karakter, hanya huruf/angka/titik/garisbawah/garispisah, diawali huruf atau angka' },
        { status: 400 }
      )
    }
    if (!USER_ROLES.includes(role as (typeof USER_ROLES)[number])) {
      return NextResponse.json({ error: 'Peran tidak valid' }, { status: 400 })
    }
    if (password && (password.length < 8 || password.length > 72)) {
      return NextResponse.json({ error: 'Password kustom 8-72 karakter' }, { status: 400 })
    }
    if (await db.adminUser.findUnique({ where: { username } })) {
      return NextResponse.json({ error: `Username "${username}" sudah dipakai` }, { status: 400 })
    }

    // Role OPD wajib menautkan ke OPD yang belum punya akun
    let opdConnect: { id: number } | undefined
    if (role === 'opd') {
      if (!Number.isInteger(opdId) || opdId <= 0) {
        return NextResponse.json(
          { error: 'Akun OPD wajib dipilihkan OPD/SKPD tujuan' },
          { status: 400 }
        )
      }
      const opd = await db.opd.findUnique({ where: { id: opdId }, include: { user: true } })
      if (!opd) {
        return NextResponse.json({ error: 'OPD/SKPD tidak ditemukan' }, { status: 404 })
      }
      if (opd.user) {
        return NextResponse.json(
          { error: `OPD "${opd.name}" sudah memiliki akun (${opd.user.username})` },
          { status: 400 }
        )
      }
      opdConnect = { id: opd.id }
    }

    const finalPassword = password || generateUserPassword()
    const created = await db.adminUser.create({
      data: {
        username,
        passwordHash: hashPassword(finalPassword),
        role,
        ...(opdConnect ? { opd: { connect: opdConnect } } : {}),
      },
    })

    return NextResponse.json({
      data: {
        user: { id: created.id, username: created.username, role: normalizeRole(created.role) },
        credentials: { username: created.username, password: finalPassword },
      },
    })
  } catch (error) {
    console.error('POST /api/admin/users error', error)
    return NextResponse.json({ error: 'Gagal menambah pengguna' }, { status: 500 })
  }
}

/**
 * PUT — ubah username/peran. Peran hanya bisa diganti antara admin ↔
 * Kepala Daerah untuk akun non-OPD; akun OPD dikelola lewat Data OPD.
 */
export async function PUT(req: Request) {
  try {
    const admin = await requireAdmin()
    if (!admin) return unauthorized()

    const body = (await req.json().catch(() => null)) as
      | { id?: unknown; username?: unknown; role?: unknown }
      | null

    const id = typeof body?.id === 'string' ? body.id : ''
    if (!id) {
      return NextResponse.json({ error: 'ID pengguna tidak valid' }, { status: 400 })
    }
    const user = await db.adminUser.findUnique({ where: { id }, include: { opd: true } })
    if (!user) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 })
    }

    const username = typeof body?.username === 'string' ? body.username.trim() : ''
    const role = typeof body?.role === 'string' ? body.role : ''
    if (!isValidUsername(username)) {
      return NextResponse.json(
        { error: 'Username 3-40 karakter, hanya huruf/angka/titik/garisbawah/garispisah, diawali huruf atau angka' },
        { status: 400 }
      )
    }
    if (username !== user.username && (await db.adminUser.findUnique({ where: { username } }))) {
      return NextResponse.json({ error: `Username "${username}" sudah dipakai` }, { status: 400 })
    }

    const currentRole = normalizeRole(user.role)
    let newRole = currentRole
    if (role && role !== user.role) {
      // Akun OPD tertaut tidak boleh berubah perannya di sini
      if (user.opd) {
        return NextResponse.json(
          { error: 'Peran akun OPD tidak dapat diubah — kelola lewat menu Data OPD/SKPD' },
          { status: 400 }
        )
      }
      if (role === 'opd') {
        return NextResponse.json(
          { error: 'Akun OPD baru dibuat lewat menu Data OPD/SKPD' },
          { status: 400 }
        )
      }
      if (!USER_ROLES.includes(role as (typeof USER_ROLES)[number])) {
        return NextResponse.json({ error: 'Peran tidak valid' }, { status: 400 })
      }
      // Jangan biarkan admin menurunkan perannya sendiri / admin terakhir
      if (user.id === admin.id) {
        return NextResponse.json(
          { error: 'Tidak dapat mengubah peran akun sendiri' },
          { status: 400 }
        )
      }
      if (currentRole === 'admin' && role !== 'admin' && user.active) {
        const others = await countActiveAdmins(user.id)
        if (others === 0) {
          return NextResponse.json(
            { error: 'Minimal harus ada satu admin aktif — tidak dapat mengubah peran admin terakhir' },
            { status: 400 }
          )
        }
      }
      newRole = role as typeof currentRole
    }

    const updated = await db.adminUser.update({
      where: { id },
      data: { username, role: newRole },
    })

    return NextResponse.json({
      data: { id: updated.id, username: updated.username, role: normalizeRole(updated.role) },
    })
  } catch (error) {
    console.error('PUT /api/admin/users error', error)
    return NextResponse.json({ error: 'Gagal memperbarui pengguna' }, { status: 500 })
  }
}

/** DELETE — hapus pengguna beserta sesinya (?id=<userId>). */
export async function DELETE(req: Request) {
  try {
    const admin = await requireAdmin()
    if (!admin) return unauthorized()

    const url = new URL(req.url)
    const id = url.searchParams.get('id') ?? ''
    if (!id) {
      return NextResponse.json({ error: 'ID pengguna tidak valid' }, { status: 400 })
    }

    const user = await db.adminUser.findUnique({ where: { id } })
    if (!user) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 })
    }
    if (user.id === admin.id) {
      return NextResponse.json(
        { error: 'Tidak dapat menghapus akun yang sedang digunakan' },
        { status: 400 }
      )
    }
    if (user.role === 'admin' && user.active) {
      const others = await countActiveAdmins(user.id)
      if (others === 0) {
        return NextResponse.json(
          { error: 'Minimal harus ada satu admin aktif — tidak dapat menghapus admin terakhir' },
          { status: 400 }
        )
      }
    }

    await db.adminUser.delete({ where: { id } })
    return NextResponse.json({ data: { ok: true } })
  } catch (error) {
    console.error('DELETE /api/admin/users error', error)
    return NextResponse.json({ error: 'Gagal menghapus pengguna' }, { status: 500 })
  }
}
