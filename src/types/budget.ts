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
  /** Anggaran APBDP (perubahan) hasil import LRA tahun berjalan; null bila belum tersinkron */
  apbdpItems?: BudgetItemDto[] | null
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
  /** ID OPD terdaftar dengan nama sama (untuk drill-down rincian akun) */
  opdId?: number | null
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
  /** Tahun anggaran LRA sumber baris (dibaca dari dokumen saat import) */
  year: number
  /** Periode kumulatif s.d. bulan ke-N */
  periode: number
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
  /** Tahun anggaran LRA (terdeteksi dari dokumen / manual / default) */
  year: number
  /** Sumber tahun: 'deteksi' (dari PDF), 'manual' (input user), 'default' */
  yearSource?: 'deteksi' | 'manual' | 'default'
  /** Periode kumulatif LRA (bulan ke-1..12) */
  periode: number
  periodeLabel: string | null
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
  /** Tahun anggaran LRA (dibaca dari dokumen saat import) */
  year: number
  /** Periode kumulatif s.d. bulan ke-N */
  periode: number
  createdAt: string
}

// Pengaturan aplikasi (nama, logo, favicon, teks brand & footer)
export interface AppSettingsDto {
  appName: string
  appTitle: string
  appDescription: string
  /** Nama pemerintah daerah — sub-judul di seluruh halaman */
  govName: string
  brandText: string
  brandSubtext: string
  logoUrl: string | null
  /** Logo khusus pojok kiri atas sidebar (null = mengikuti logoUrl) */
  sidebarLogoUrl: string | null
  /** Logo khusus pojok kanan header/lencana (null = emblem emas bawaan) */
  emblemUrl: string | null
  /** Warna latar header (hex, mis. #17408b; null = gradien bawaan) */
  headerColor: string | null
  faviconUrl: string | null
  footerText: string
}

// User yang sedang login (admin penuh atau akun OPD)
export interface AuthUserDto {
  username: string
  role: 'admin' | 'opd' | 'kepala_daerah'
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

// ---------------------------------------------------------------------------
// Tipe untuk Manajemen Pengguna (admin)
// ---------------------------------------------------------------------------

/** Baris akun pengguna untuk tabel Manajemen Pengguna */
export interface UserRowDto {
  id: string
  username: string
  role: 'admin' | 'kepala_daerah' | 'opd'
  /** Nama OPD terkait (hanya untuk role opd) */
  opdName: string | null
  /** true bila akun aktif; akun nonaktif tidak bisa login */
  active: boolean
  /** true bila akun milik OPD yang dinonaktifkan di Data OPD */
  opdActive: boolean | null
  /** Jumlah sesi login yang masih berlaku */
  sessionCount: number
  createdAt: string
}

/** Kredensial pengguna yang baru dibuat/reset (password hanya tampil sekali) */
export interface UserCredentialsDto {
  username: string
  password: string
}

// ---------------------------------------------------------------------------
// Tipe untuk konfigurasi AI Copilot (admin)
// ---------------------------------------------------------------------------

/** Info konfigurasi AI Copilot untuk UI admin — API key selalu dimasker */
export interface CopilotSettingsDto {
  provider: string
  providerLabel: string
  /** Base URL efektif (tersimpan atau default provider); null untuk bawaan */
  baseUrl: string | null
  model: string | null
  hasApiKey: boolean
  apiKeyMasked: string | null
  requiresKey: boolean
}

// ---------------------------------------------------------------------------
// Tipe untuk Setup Wizard (admin)
// ---------------------------------------------------------------------------

/** Status Setup Wizard — hasil pemeriksaan konfigurasi awal aplikasi. */
export interface SetupWizardStatusDto {
  /** true bila admin pernah menandai setup selesai */
  completed: boolean
  /** ISO timestamp saat setup ditandai selesai (null bila belum) */
  completedAt: string | null
  /** Username admin yang menjalankan wizard (untuk langkah keamanan) */
  username: string
  checks: {
    /** Identitas dashboard (judul & nama pemda) terisi & bebas sisa data DKI lama */
    identityConfigured: boolean
    /** AI Copilot memakai provider kustom (false = mesin bawaan Z.ai) */
    copilotConfigured: boolean
  }
}

/** Status Setup Wizard first-run (publik, tanpa sesi). */
export interface FirstRunStatusDto {
  /** true bila belum ada akun admin → wizard inisialisasi harus dijalankan */
  needed: boolean
  /** Judul aplikasi saat ini (untuk header wizard) */
  appTitle: string
}

// Data untuk Dashboard OPD (profil + realisasi SKPD miliknya)
export interface RealisasiGroupDto {
  pendapatan: { anggaran: number; realisasi: number }
  belanja: { anggaran: number; realisasi: number }
  pembiayaan: { anggaran: number; realisasi: number }
}

export interface OpdSelfDto {
  opd: {
    id: number
    code: string
    name: string
    username: string
    active: boolean
    createdAt: string
  }
  realisasi: RealisasiGroupDto | null
  /** Ringkasan per periode kumulatif (s.d. bulan ke-N) hasil import LRA */
  realisasiPeriode?: {
    periode: number
    /** Tahun anggaran periode ini */
    year: number
    pendapatan: { anggaran: number; realisasi: number }
    belanja: { anggaran: number; realisasi: number }
    pembiayaan: { anggaran: number; realisasi: number }
  }[]
}
