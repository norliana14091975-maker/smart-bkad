'use client'

import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { BadgeCheck, Building2, CalendarDays, Hash, Save, User } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { levelBadge } from '@/lib/kode-akun'
import { formatPct, formatRupiah, formatRupiah0 } from '@/lib/format'
import type { OpdSelfDto, RealisasiAkunDto } from '@/types/budget'

async function fetchSelf(): Promise<OpdSelfDto> {
  const res = await fetch('/api/opd/me')
  if (!res.ok) throw new Error('Gagal memuat data OPD')
  const json = (await res.json()) as { data: OpdSelfDto }
  return json.data
}

type GroupKey = 'pendapatan' | 'belanja' | 'pembiayaan'

const GROUPS: { key: GroupKey; label: string }[] = [
  { key: 'pendapatan', label: 'Pendapatan' },
  { key: 'belanja', label: 'Belanja' },
  { key: 'pembiayaan', label: 'Pembiayaan' },
]

type FormState = Record<GroupKey, { anggaran: string; realisasi: string }>

const EMPTY_FORM: FormState = {
  pendapatan: { anggaran: '0', realisasi: '0' },
  belanja: { anggaran: '0', realisasi: '0' },
  pembiayaan: { anggaran: '0', realisasi: '0' },
}

const AKUN_GROUPS: { key: string; label: string }[] = [
  { key: 'PENDAPATAN', label: 'Realisasi Pendapatan' },
  { key: 'BELANJA', label: 'Realisasi Belanja' },
  { key: 'PEMBIAYAAN', label: 'Realisasi Pembiayaan' },
]

export function OpdDashboardSection() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['opd-me'],
    queryFn: fetchSelf,
  })

  const opdId = data?.opd.id ?? null

  // Rincian realisasi akun milik OPD ini (hasil import LRA)
  const akunQuery = useQuery({
    queryKey: ['opd-realisasi-akun', opdId],
    queryFn: async (): Promise<RealisasiAkunDto[]> => {
      const res = await fetch(`/api/realisasi/akun?opdId=${opdId}`)
      if (!res.ok) throw new Error('Gagal memuat rincian akun')
      return ((await res.json()) as { data: RealisasiAkunDto[] }).data
    },
    enabled: opdId !== null,
  })

  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Isi form saat data dimuat
  useEffect(() => {
    if (!data?.realisasi) return
    setForm({
      pendapatan: {
        anggaran: String(data.realisasi.pendapatan.anggaran),
        realisasi: String(data.realisasi.pendapatan.realisasi),
      },
      belanja: {
        anggaran: String(data.realisasi.belanja.anggaran),
        realisasi: String(data.realisasi.belanja.realisasi),
      },
      pembiayaan: {
        anggaran: String(data.realisasi.pembiayaan.anggaran),
        realisasi: String(data.realisasi.pembiayaan.realisasi),
      },
    })
  }, [data])

  async function handleSave() {
    if (saving) return
    setSaving(true)
    try {
      const body = Object.fromEntries(
        GROUPS.map((g) => [
          g.key,
          {
            anggaran: Number(form[g.key].anggaran) || 0,
            realisasi: Number(form[g.key].realisasi) || 0,
          },
        ])
      )
      const res = await fetch('/api/opd/realisasi', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Gagal menyimpan')
      toast({ title: 'Realisasi OPD tersimpan' })
      await queryClient.invalidateQueries({ queryKey: ['opd-me'] })
      await queryClient.invalidateQueries({ queryKey: ['realisasi-skpd'] })
      await queryClient.invalidateQueries({ queryKey: ['admin-realisasi-skpd'] })
    } catch (err) {
      toast({ title: 'Gagal menyimpan', description: String(err), variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const pct = (g: GroupKey) => {
    const anggaran = Number(form[g].anggaran) || 0
    const realisasi = Number(form[g].realisasi) || 0
    return anggaran > 0 ? (realisasi / anggaran) * 100 : 0
  }

  if (isError) {
    return (
      <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        Gagal memuat data OPD.
      </p>
    )
  }

  return (
    <div>
      <h2 className="mb-4 text-base font-bold uppercase tracking-wide text-foreground">
        Dashboard OPD/SKPD
      </h2>

      {/* Profil OPD */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-[#17408b]">
            <Building2 className="h-5 w-5" aria-hidden="true" />
          </div>
          {isLoading || !data ? (
            <Skeleton className="mt-2 h-7 w-40" />
          ) : (
            <p className="mt-2 text-base font-extrabold text-foreground">{data.opd.name}</p>
          )}
          <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Nama OPD/SKPD
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-[#17408b]">
            <Hash className="h-5 w-5" aria-hidden="true" />
          </div>
          {isLoading || !data ? (
            <Skeleton className="mt-2 h-7 w-24" />
          ) : (
            <p className="mt-2 font-mono text-lg font-extrabold text-foreground">{data.opd.code}</p>
          )}
          <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Kode OPD
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-[#17408b]">
            <User className="h-5 w-5" aria-hidden="true" />
          </div>
          {isLoading || !data ? (
            <Skeleton className="mt-2 h-7 w-32" />
          ) : (
            <p className="mt-2 font-mono text-sm font-extrabold break-all text-foreground">
              {data.opd.username}
            </p>
          )}
          <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Username Login
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-2 text-[#17408b]">
            <CalendarDays className="h-5 w-5" aria-hidden="true" />
          </div>
          {isLoading || !data ? (
            <Skeleton className="mt-2 h-7 w-28" />
          ) : (
            <>
              <p className="mt-2 text-sm font-extrabold text-foreground">
                {new Date(data.opd.createdAt).toLocaleDateString('id-ID', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
              <Badge
                variant="secondary"
                className={`mt-1 ${data.opd.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
              >
                {data.opd.active ? 'Aktif' : 'Nonaktif'}
              </Badge>
            </>
          )}
          <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Terdaftar
          </p>
        </div>
      </div>

      {/* Editor realisasi */}
      <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-1 flex items-center gap-2">
          <BadgeCheck className="h-5 w-5 text-[#17408b]" aria-hidden="true" />
          <h3 className="text-sm font-bold uppercase tracking-wide text-foreground/80">
            Realisasi Anggaran OPD
          </h3>
        </div>
        <p className="mb-4 text-xs text-muted-foreground">
          Isi angka dalam Rupiah tanpa pemisah ribuan. Perubahan langsung tampil pada dashboard
          publik Realisasi Per-SKPD.
        </p>

        <div className="space-y-5">
          {GROUPS.map((g) => (
            <div key={g.key}>
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-foreground/70">
                {g.label}
              </p>
              <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`${g.key}-anggaran`}>Anggaran</Label>
                  <Input
                    id={`${g.key}-anggaran`}
                    type="number"
                    min={0}
                    value={form[g.key].anggaran}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, [g.key]: { ...f[g.key], anggaran: e.target.value } }))
                    }
                  />
                  <p className="text-[11px] tabular-nums text-muted-foreground">
                    {formatRupiah0(Number(form[g.key].anggaran) || 0)}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${g.key}-realisasi`}>Realisasi</Label>
                  <Input
                    id={`${g.key}-realisasi`}
                    type="number"
                    min={0}
                    value={form[g.key].realisasi}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, [g.key]: { ...f[g.key], realisasi: e.target.value } }))
                    }
                  />
                  <p className="text-[11px] tabular-nums text-muted-foreground">
                    {formatRupiah0(Number(form[g.key].realisasi) || 0)}
                  </p>
                </div>
                <div className="rounded-md border-l-4 border-l-[#17408b] bg-muted/40 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Capaian
                  </p>
                  <p className="text-lg font-extrabold tabular-nums text-[#17408b]">
                    {formatPct(pct(g.key))}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <Button onClick={handleSave} disabled={saving || isLoading} className="bg-[#17408b] text-white hover:bg-[#12326e]">
            <Save className="h-4 w-4" aria-hidden="true" />
            {saving ? 'Menyimpan…' : 'Simpan Realisasi'}
          </Button>
        </div>
      </section>

      {/* Rincian realisasi per akun (hasil import LRA, klasifikasi level 1-5) */}
      <section className="mt-5">
        <h3 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-foreground/80">
          <BadgeCheck className="h-4 w-4 text-[#17408b]" aria-hidden="true" />
          Rincian Realisasi Per-Akun OPD Ini
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Kode rekening hasil import diklasifikasi per level: L1 Akun · L2 Kelompok · L3 Jenis ·
          L4 Obyek · L5 Rincian Obyek · L6 Sub Rincian Obyek.
        </p>

        {akunQuery.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : akunQuery.data && akunQuery.data.length > 0 ? (
          AKUN_GROUPS.map((g) => {
            const rows = akunQuery.data.filter((r) => r.group === g.key)
            if (rows.length === 0) return null
            return (
              <div key={g.key} className="mb-4 overflow-hidden rounded-lg border">
                <div className="bg-muted/60 px-4 py-2 text-xs font-bold uppercase tracking-wide text-foreground/80">
                  {g.label}
                </div>
                <div className="max-h-72 overflow-y-auto nice-scrollbar">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-32">Level</TableHead>
                        <TableHead className="min-w-[200px]">Kode &amp; Uraian</TableHead>
                        <TableHead className="text-right">Anggaran</TableHead>
                        <TableHead className="text-right">Realisasi</TableHead>
                        <TableHead className="text-right">%</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((item) => (
                        <TableRow key={item.code}>
                          <TableCell>
                            <Badge
                              variant="secondary"
                              className={`whitespace-nowrap font-mono text-[10px] ${
                                item.level <= 2 ? 'bg-[#17408b]/10 text-[#17408b]' : 'bg-muted'
                              }`}
                            >
                              {levelBadge(item.level)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div
                              className="flex items-baseline gap-2"
                              style={{ paddingLeft: `${(item.level - 1) * 14}px` }}
                            >
                              <span className="font-mono text-xs font-semibold">{item.code}</span>
                              <span className="text-sm">{item.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{formatRupiah(item.anggaran)}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatRupiah(item.realisasi)}</TableCell>
                          <TableCell className="text-right tabular-nums font-semibold text-[#17408b]">
                            {formatPct(item.pct)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )
          })
        ) : (
          <p className="rounded-lg border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
            Belum ada rincian akun untuk OPD ini. Gunakan menu{' '}
            <strong>Area OPD → Import LRA (PDF)</strong> untuk mengimpor LRA dan mengklasifikasi
            kode rekening secara otomatis.
          </p>
        )}
      </section>
    </div>
  )
}
