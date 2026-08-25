'use client'

import { useQuery } from '@tanstack/react-query'
import { BudgetChart, type ChartRow } from '@/components/dashboard/budget-chart'
import { SectionHeading } from '@/components/dashboard/section-heading'
import { useSettings } from '@/hooks/use-settings'
import { DEFAULT_SETTINGS } from '@/lib/default-settings'
import { LraSyncBadge, type LraSyncMetaDto } from '@/components/dashboard/lra-sync-badge'
import type { ApbdSummaryDto } from '@/types/budget'

export const APBD_SERIES = [
  { key: 'apbd', label: 'APBD', color: '#86c67c' },
  { key: 'apbdp', label: 'APBDP', color: '#1e7a34' },
]

const APBD_SERIES_BELANJA = [
  { key: 'apbd', label: 'APBD', color: '#f4a08a' },
  { key: 'apbdp', label: 'APBDP', color: '#b22222' },
]

const APBD_SERIES_TERIMA = [
  { key: 'apbd', label: 'APBD', color: '#7da7f5' },
  { key: 'apbdp', label: 'APBDP', color: '#1e3fd0' },
]

const APBD_SERIES_KELUAR = [
  { key: 'apbd', label: 'APBD', color: '#f3ce4a' },
  { key: 'apbdp', label: 'APBDP', color: '#e07b00' },
]

async function fetchApbd(): Promise<{ data: ApbdSummaryDto[]; meta?: LraSyncMetaDto }> {
  const res = await fetch('/api/apbd')
  if (!res.ok) throw new Error('Gagal memuat data APBD')
  const json = (await res.json()) as { data: ApbdSummaryDto[]; meta?: LraSyncMetaDto }
  return { data: json.data, meta: json.meta }
}

export function ApbdSection() {
  const settingsQuery = useSettings()
  const govName = settingsQuery.data?.govName ?? DEFAULT_SETTINGS.govName

  const { data, isLoading, isError } = useQuery({
    queryKey: ['apbd'],
    queryFn: fetchApbd,
  })

  const rows = data?.data
  const pendapatanRows: ChartRow[] = (rows ?? []).map((d) => ({
    label: String(d.year),
    values: { apbd: d.pendapatan.apbd, apbdp: d.pendapatan.apbdp },
  }))
  const belanjaRows: ChartRow[] = (rows ?? []).map((d) => ({
    label: String(d.year),
    values: { apbd: d.belanja.apbd, apbdp: d.belanja.apbdp },
  }))
  const terimaRows: ChartRow[] = (rows ?? []).map((d) => ({
    label: String(d.year),
    values: { apbd: d.penerimaanPembiayaan.apbd, apbdp: d.penerimaanPembiayaan.apbdp },
  }))
  const keluarRows: ChartRow[] = (rows ?? []).map((d) => ({
    label: String(d.year),
    values: { apbd: d.pengeluaranPembiayaan.apbd, apbdp: d.pengeluaranPembiayaan.apbdp },
  }))

  return (
    <div>
      <SectionHeading
        title="Anggaran Pendapatan dan Belanja Daerah"
        subtitle={govName}
      />
      {isError && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          Gagal memuat data APBD. Silakan muat ulang halaman.
        </p>
      )}

      <LraSyncBadge meta={data?.meta}>
        Anggaran perubahan (APBDP) tahun berjalan tersinkron dengan LRA terimport
        {data?.meta && data.meta.opdCount > 0 && <>&nbsp;({data.meta.opdCount} OPD/SKPD)</>}
        <span className="font-normal text-emerald-800">
          &nbsp;— APBD murni tetap, anggaran hasil import masuk kategori APBDP
          (penambahan/pengurangan)
        </span>
      </LraSyncBadge>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
        <BudgetChart
          title="Anggaran Pendapatan"
          rows={pendapatanRows}
          series={APBD_SERIES}
          loading={isLoading}
        />
        <BudgetChart
          title="Anggaran Belanja"
          rows={belanjaRows}
          series={APBD_SERIES_BELANJA}
          loading={isLoading}
        />
        <BudgetChart
          title="Anggaran Penerimaan Pembiayaan"
          rows={terimaRows}
          series={APBD_SERIES_TERIMA}
          loading={isLoading}
        />
        <BudgetChart
          title="Anggaran Pengeluaran Pembiayaan"
          rows={keluarRows}
          series={APBD_SERIES_KELUAR}
          loading={isLoading}
        />
      </div>
    </div>
  )
}
