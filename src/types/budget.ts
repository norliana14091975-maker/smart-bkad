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

// ---------------------------------------------------------------------------
// Tipe untuk dashboard admin
// ---------------------------------------------------------------------------

export interface AdminOverviewDto {
  counts: {
    apbdYears: number
    budgetItems: number
    realisasiAkun: number
    realisasiSkpd: number
    transparansiDocs: number
    importLogs: number
  }
  visitorThisMonth: number
  recentImports: ImportLogDto[]
}

export interface BudgetItemRowDto {
  id: number
  section: string
  tab: string
  code: string
  name: string
  year: number
  amount: number
}

export interface RealisasiAkunRowDto {
  id: number
  code: string
  name: string
  group: string
  anggaran: number
  realisasi: number
}

export interface RealisasiSkpdRowDto {
  id: number
  name: string
  pendapatan: { anggaran: number; realisasi: number }
  belanja: { anggaran: number; realisasi: number }
  pembiayaan: { anggaran: number; realisasi: number }
}

export interface TransparansiRowDto {
  id: number
  type: string
  title: string
  url: string
}

export interface ImportItemDto {
  code: string
  name: string
  anggaran: number
  realisasi: number
  pct: number
}

export interface ImportParseResultDto {
  importLogId: number
  filename: string
  pages: number
  items: ImportItemDto[]
  textPreview: string
}

export interface ImportLogDto {
  id: number
  filename: string
  pages: number
  records: number
  status: string
  message: string | null
  createdAt: string
}
