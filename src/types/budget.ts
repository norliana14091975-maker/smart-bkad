export interface ApbdSummaryDto {
  year: number
  pendapatan: { apbd: number; apbdp: number }
  belanja: { apbd: number; apbdp: number }
  penerimaanPembiayaan: { apbd: number; apbdp: number }
  pengeluaranPembiayaan: { apbd: number; apbdp: number }
}

export interface BudgetItemDto {
  code: string
  name: string
  year: number
  amount: number
}

export interface BudgetTabDto {
  tab: string
  label: string
  items: BudgetItemDto[]
}

export interface RealisasiAkunDto {
  code: string
  name: string
  group: string
  anggaran: number
  realisasi: number
  pct: number
}

export interface RealisasiSkpdDto {
  name: string
  pendapatan: { anggaran: number; realisasi: number }
  belanja: { anggaran: number; realisasi: number }
  pembiayaan: { anggaran: number; realisasi: number }
}

export interface TransparansiDocDto {
  title: string
  url: string
}

export interface VisitorDto {
  month: string
  count: number
}
