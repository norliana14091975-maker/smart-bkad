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
  /** 1=akun, 2=kelompok, 3=jenis, 4=obyek, 5=rincian obyek */
  level: number
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
  level: number
  opdName: string | null
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
  /** 1=akun, 2=kelompok, 3=jenis, 4=obyek, 5=rincian obyek */
  level: number
}

export interface ImportParseResultDto {
  importLogId: number
  filename: string
  pages: number
  opdId: number | null
  opdName: string | null
  items: ImportItemDto[]
  stats: ImportStatsDto
  textPreview: string
}

// Statistik penerapan aturan BAS Permendagri pada hasil ekstraksi
export interface ImportStatsDto {
  valid: number
  dropped: number
  derived: number
  droppedExamples: string[]
}

export interface ImportLogDto {
  id: number
  filename: string
  pages: number
  records: number
  status: string
  message: string | null
  opdName: string | null
  createdAt: string
}

// Pengaturan aplikasi (nama, logo, favicon, teks brand & footer)
export interface AppSettingsDto {
  appName: string
  appTitle: string
  appDescription: string
  brandText: string
  brandSubtext: string
  logoUrl: string | null
  faviconUrl: string | null
  footerText: string
}

// User yang sedang login (admin penuh atau akun OPD)
export interface AuthUserDto {
  username: string
  role: 'admin' | 'opd'
  opdName?: string | null
}

// Baris OPD/SKPD untuk tabel manajemen admin
export interface OpdRowDto {
  id: number
  code: string
  name: string
  active: boolean
  username: string | null
  createdAt: string
}

// Kredensial akun OPD yang baru dibuat/reset (password hanya tampil sekali)
export interface OpdCredentialsDto {
  opdName: string
  username: string
  password: string
}

// Data untuk Dashboard OPD (profil + realisasi SKPD miliknya)
export interface OpdSelfDto {
  opd: {
    id: number
    code: string
    name: string
    username: string
    active: boolean
    createdAt: string
  }
  realisasi: {
    pendapatan: { anggaran: number; realisasi: number }
    belanja: { anggaran: number; realisasi: number }
    pembiayaan: { anggaran: number; realisasi: number }
  } | null
}
