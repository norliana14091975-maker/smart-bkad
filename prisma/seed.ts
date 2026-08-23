import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

// ---------------------------------------------------------------------------
// Data anggaran publik APBD Provinsi DKI Jakarta (dalam Rupiah)
// ---------------------------------------------------------------------------

const apbdSummary = [
  // year, pendapatan APBD, pendapatan APBDP, belanja APBD, belanja APBDP, penerimaan pembiayaan APBD, APBDP, pengeluaran pembiayaan APBD, APBDP
  { year: 2026, pendApbd: 71450673065697, pendApbdp: 71450673065697, belApbd: 74285299931740, belApbdp: 74285299931740, terApbd: 9875623866043, terApbdp: 9875623866043, kelApbd: 7040997000000, kelApbdp: 7040997000000 },
  { year: 2025, pendApbd: 81734364760824, pendApbdp: 84454424378366, belApbd: 82663062617784, belApbdp: 85979175838982, terApbd: 9610526480390, terApbdp: 7408465084046, kelApbd: 8681828623430, kelApbdp: 5883713623430 },
  { year: 2024, pendApbd: 72446382571261, pendApbdp: 74946825859889, belApbd: 72600997362528, belApbdp: 76023113210933, terApbd: 9270190454798, terApbdp: 10255502731787, kelApbd: 9115575663531, kelApbdp: 9179215380743 },
  { year: 2023, pendApbd: 74380646088137, pendApbdp: 70662936135345, belApbd: 74613763379256, belApbdp: 72144886612586, terApbd: 9400439814055, terApbdp: 8895317655192, kelApbd: 9167322522936, kelApbdp: 7413367177951 },
  { year: 2022, pendApbd: 77448713889500, pendApbdp: 77796647728301, belApbd: 75757234798334, belApbdp: 76972166396328, terApbd: 5022420964799, terApbdp: 5015108618305, kelApbd: 6713900055965, kelApbdp: 5839589950278 },
]

type Item = { code: string; name: string; y2026: number; y2025: number }

const pendapatanItems: Item[] = [
  { code: '4.1.01', name: 'Pajak Daerah', y2026: 49898218773411, y2025: 48000000000000 },
  { code: '4.1.02', name: 'Retribusi Daerah', y2026: 2214853656242, y2025: 1396295297541 },
  { code: '4.1.03', name: 'Hasil Pengelolaan Kekayaan Daerah yang Dipisahkan', y2026: 876020190232, y2025: 774000000000 },
  { code: '4.1.04', name: 'Lain-lain PAD yang Sah', y2026: 4681555092812, y2025: 4028903045464 },
  { code: '4.2.01', name: 'Pendapatan Transfer Pemerintah Pusat', y2026: 11159480293000, y2025: 30082649167361 },
  { code: '4.3.01', name: 'Pendapatan Hibah', y2026: 2620545060000, y2025: 172576868000 },
]

const belanjaOperasi: Item[] = [
  { code: '5.1.01', name: 'Belanja Pegawai', y2026: 21431736563104, y2025: 21494737417693 },
  { code: '5.1.02', name: 'Belanja Barang dan Jasa', y2026: 29000142954078, y2025: 31382423238857 },
  { code: '5.1.03', name: 'Belanja Bunga', y2026: 120400000000, y2025: 143000000000 },
  { code: '5.1.04', name: 'Belanja Subsidi', y2026: 5277927322600, y2025: 7011138070237 },
  { code: '5.1.05', name: 'Belanja Hibah', y2026: 2801230357390, y2025: 3014479982073 },
  { code: '5.1.06', name: 'Belanja Bantuan Sosial', y2026: 4581666540583, y2025: 4355658226574 },
]

const belanjaModal: Item[] = [
  { code: '5.2.01', name: 'Belanja Modal Tanah', y2026: 745231989077, y2025: 1160296526916 },
  { code: '5.2.02', name: 'Belanja Modal Peralatan dan Mesin', y2026: 1967569878710, y2025: 3792579523139 },
  { code: '5.2.03', name: 'Belanja Modal Gedung dan Bangunan', y2026: 1899083568597, y2025: 4322655246961 },
  { code: '5.2.04', name: 'Belanja Modal Jalan, Jaringan, dan Irigasi', y2026: 5357208391634, y2025: 5652339335329 },
  { code: '5.2.05', name: 'Belanja Modal Aset Tetap Lainnya', y2026: 109190724044, y2025: 169044104138 },
  { code: '5.2.06', name: 'Belanja Modal Aset Lainnya', y2026: 89257642290, y2025: 156324877024 },
]

const belanjaTidakTerduga: Item[] = [
  { code: '5.3.01', name: 'Belanja Tidak Terduga', y2026: 709370820233, y2025: 2947599618521 },
]

const belanjaTransfer: Item[] = [
  { code: '5.4.02', name: 'Belanja Bantuan Keuangan', y2026: 195283179400, y2025: 376899671520 },
]

const belanjaPerUrusan: Item[] = [
  { code: '1.01', name: 'URUSAN PEMERINTAHAN BIDANG PENDIDIKAN', y2026: 36348041712714, y2025: 39207933547336 },
  { code: '1.02', name: 'URUSAN PEMERINTAHAN BIDANG KESEHATAN', y2026: 20838608476212, y2025: 22857646661226 },
  { code: '1.03', name: 'URUSAN PEMERINTAHAN BIDANG PEKERJAAN UMUM DAN PENATAAN RUANG', y2026: 18415872389380, y2025: 21104099960062 },
  { code: '1.04', name: 'URUSAN PEMERINTAHAN BIDANG PERUMAHAN DAN KAWASAN PERMUKIMAN', y2026: 3307298631978, y2025: 3109600029882 },
  { code: '1.05', name: 'URUSAN PEMERINTAHAN BIDANG KETENTERAMAN DAN KETERTIBAN UMUM SERTA PERLINDUNGAN MASYARAKAT', y2026: 5467431840812, y2025: 6268366686362 },
  { code: '1.06', name: 'URUSAN PEMERINTAHAN BIDANG SOSIAL', y2026: 3053738560546, y2025: 3056949446916 },
  { code: '2.07', name: 'URUSAN PEMERINTAHAN BIDANG TENAGA KERJA', y2026: 764761643350, y2025: 1332250300330 },
  { code: '2.08', name: 'URUSAN PEMERINTAHAN BIDANG PEMBERDAYAAN PEREMPUAN DAN PERLINDUNGAN ANAK', y2026: 62331420608, y2025: 63486579020 },
  { code: '2.09', name: 'URUSAN PEMERINTAHAN BIDANG PANGAN', y2026: 1783711556436, y2025: 2533612094574 },
  { code: '2.10', name: 'URUSAN PEMERINTAHAN BIDANG PERTANAHAN', y2026: 1927386224, y2025: 2525967006 },
  { code: '2.11', name: 'URUSAN PEMERINTAHAN BIDANG LINGKUNGAN HIDUP', y2026: 8282323768214, y2025: 9855919235478 },
  { code: '2.12', name: 'URUSAN PEMERINTAHAN BIDANG ADMINISTRASI KEPENDUDUKAN DAN PENCATATAN SIPIL', y2026: 608097303100, y2025: 753104219618 },
  { code: '2.13', name: 'URUSAN PEMERINTAHAN BIDANG PEMBERDAYAAN MASYARAKAT DAN DESA', y2026: 1404577165170, y2025: 1109119387924 },
  { code: '2.14', name: 'URUSAN PEMERINTAHAN BIDANG PENGENDALIAN PENDUDUK DAN KELUARGA BERENCANA', y2026: 380125437804, y2025: 442492790460 },
  { code: '2.15', name: 'URUSAN PEMERINTAHAN BIDANG PERHUBUNGAN', y2026: 13563711902392, y2025: 16244920715956 },
  { code: '2.16', name: 'URUSAN PEMERINTAHAN BIDANG KOMUNIKASI DAN INFORMATIKA', y2026: 1937819998786, y2025: 2138532609038 },
  { code: '2.17', name: 'URUSAN PEMERINTAHAN BIDANG KOPERASI, USAHA KECIL, DAN MENENGAH', y2026: 464615357202, y2025: 585056464356 },
  { code: '2.18', name: 'URUSAN PEMERINTAHAN BIDANG PENANAMAN MODAL', y2026: 1508099056946, y2025: 1754066344428 },
  { code: '2.19', name: 'URUSAN PEMERINTAHAN BIDANG KEPEMUDAAN DAN OLAHRAGA', y2026: 1428714260088, y2025: 2502861223248 },
  { code: '2.20', name: 'URUSAN PEMERINTAHAN BIDANG STATISTIK', y2026: 25141609348, y2025: 18869240624 },
  { code: '2.21', name: 'URUSAN PEMERINTAHAN BIDANG PERSANDIAN', y2026: 27865210616, y2025: 103696358320 },
  { code: '2.22', name: 'URUSAN PEMERINTAHAN BIDANG KEBUDAYAAN', y2026: 928749991716, y2025: 1158021359092 },
  { code: '2.23', name: 'URUSAN PEMERINTAHAN BIDANG PERPUSTAKAAN', y2026: 174990003154, y2025: 192305856364 },
  { code: '2.24', name: 'URUSAN PEMERINTAHAN BIDANG KEARSIPAN', y2026: 387039250322, y2025: 461321441578 },
  { code: '3.25', name: 'URUSAN PEMERINTAHAN BIDANG KELAUTAN DAN PERIKANAN', y2026: 97416241244, y2025: 119279614178 },
  { code: '3.26', name: 'URUSAN PEMERINTAHAN BIDANG PARIWISATA', y2026: 1148397310756, y2025: 1402543278846 },
  { code: '3.27', name: 'URUSAN PEMERINTAHAN BIDANG PERTANIAN', y2026: 146312950672, y2025: 106705554742 },
  { code: '3.28', name: 'URUSAN PEMERINTAHAN BIDANG KEHUTANAN', y2026: 916289013120, y2025: 997280134710 },
  { code: '3.29', name: 'URUSAN PEMERINTAHAN BIDANG ENERGI DAN SUMBER DAYA MINERAL', y2026: 57187852848, y2025: 161028656500 },
  { code: '3.30', name: 'URUSAN PEMERINTAHAN BIDANG PERDAGANGAN', y2026: 81459698964, y2025: 215290443784 },
  { code: '3.31', name: 'URUSAN PEMERINTAHAN BIDANG PERINDUSTRIAN', y2026: 84147802480, y2025: 165003692418 },
  { code: '3.32', name: 'URUSAN PEMERINTAHAN BIDANG TRANSMIGRASI', y2026: 261362800, y2025: 0 },
  { code: '4.01', name: 'SEKRETARIAT DAERAH', y2026: 3144477852082, y2025: 3269601410828 },
  { code: '4.02', name: 'SEKRETARIAT DPRD', y2026: 1870687349928, y2025: 2241046338706 },
  { code: '5.01', name: 'PERENCANAAN', y2026: 340091241312, y2025: 400425467270 },
  { code: '5.02', name: 'KEUANGAN', y2026: 5672338940562, y2025: 11385390932612 },
  { code: '5.03', name: 'KEPEGAWAIAN', y2026: 382077788718, y2025: 461713791252 },
  { code: '5.04', name: 'PENDIDIKAN DAN PELATIHAN', y2026: 248562748942, y2025: 193191307850 },
  { code: '5.05', name: 'PENELITIAN DAN PENGEMBANGAN', y2026: 56088441260, y2025: 71075807210 },
  { code: '6.01', name: 'INSPEKTORAT DAERAH', y2026: 458192367866, y2025: 637267835098 },
  { code: '7.01', name: 'KECAMATAN ADMINISTRASI', y2026: 6811041530594, y2025: 6367577720540 },
  { code: '7.02', name: 'KOTA ADMINISTRASI', y2026: 4395340788828, y2025: 4937606959724 },
  { code: '7.03', name: 'KABUPATEN ADMINISTRASI', y2026: 335170827918, y2025: 297389629630 },
  { code: '8.01', name: 'KESATUAN BANGSA DAN POLITIK', y2026: 1159463819468, y2025: 1672174582868 },
]

const pembiayaanPenerimaan: Item[] = [
  { code: '6.1.01', name: 'Sisa Lebih Perhitungan Anggaran Tahun Sebelumnya', y2026: 5052674866043, y2025: 4433850834046 },
  { code: '6.1.04', name: 'Penerimaan Pinjaman Daerah', y2026: 0, y2025: 2974586000000 },
  { code: '6.1.05', name: 'Penerimaan Kembali Pemberian Pinjaman Daerah', y2026: 0, y2025: 28250000 },
  { code: '6.1.08', name: 'Penerimaan Pembiayaan Utang Daerah', y2026: 4822949000000, y2025: 0 },
]

const pembiayaanPengeluaran: Item[] = [
  { code: '6.2.02', name: 'Penyertaan Modal Daerah', y2026: 5230567000000, y2025: 3902043000000 },
  { code: '6.2.03', name: 'Pembayaran Cicilan Pokok Utang yang Jatuh Tempo', y2026: 1810430000000, y2025: 1981670623430 },
]

// ---------------------------------------------------------------------------
// Realisasi (tahun anggaran berjalan) — contoh distribusi realisasi s.d. Agustus
// ---------------------------------------------------------------------------

type RealItem = { code: string; name: string; group: string; anggaran: number; pct: number }

const realisasiItems: RealItem[] = [
  { code: '4.1.01', name: 'Pajak Daerah', group: 'PENDAPATAN', anggaran: 49898218773411, pct: 0.5812 },
  { code: '4.1.02', name: 'Retribusi Daerah', group: 'PENDAPATAN', anggaran: 2214853656242, pct: 0.6241 },
  { code: '4.1.03', name: 'Hasil Pengelolaan Kekayaan Daerah yang Dipisahkan', group: 'PENDAPATAN', anggaran: 876020190232, pct: 0.7035 },
  { code: '4.1.04', name: 'Lain-lain PAD yang Sah', group: 'PENDAPATAN', anggaran: 4681555092812, pct: 0.5494 },
  { code: '4.2.01', name: 'Pendapatan Transfer Pemerintah Pusat', group: 'PENDAPATAN', anggaran: 11159480293000, pct: 0.6178 },
  { code: '4.3.01', name: 'Pendapatan Hibah', group: 'PENDAPATAN', anggaran: 2620545060000, pct: 0.4283 },
  { code: '5.1.01', name: 'Belanja Pegawai', group: 'BELANJA', anggaran: 21431736563104, pct: 0.6052 },
  { code: '5.1.02', name: 'Belanja Barang dan Jasa', group: 'BELANJA', anggaran: 29000142954078, pct: 0.5236 },
  { code: '5.1.03', name: 'Belanja Bunga', group: 'BELANJA', anggaran: 120400000000, pct: 0.6625 },
  { code: '5.1.04', name: 'Belanja Subsidi', group: 'BELANJA', anggaran: 5277927322600, pct: 0.4918 },
  { code: '5.1.05', name: 'Belanja Hibah', group: 'BELANJA', anggaran: 2801230357390, pct: 0.5477 },
  { code: '5.1.06', name: 'Belanja Bantuan Sosial', group: 'BELANJA', anggaran: 4581666540583, pct: 0.5863 },
  { code: '5.2.01', name: 'Belanja Modal Tanah', group: 'BELANJA', anggaran: 745231989077, pct: 0.3214 },
  { code: '5.2.02', name: 'Belanja Modal Peralatan dan Mesin', group: 'BELANJA', anggaran: 1967569878710, pct: 0.4057 },
  { code: '5.2.03', name: 'Belanja Modal Gedung dan Bangunan', group: 'BELANJA', anggaran: 1899083568597, pct: 0.3842 },
  { code: '5.2.04', name: 'Belanja Modal Jalan, Jaringan, dan Irigasi', group: 'BELANJA', anggaran: 5357208391634, pct: 0.4419 },
  { code: '5.2.05', name: 'Belanja Modal Aset Tetap Lainnya', group: 'BELANJA', anggaran: 109190724044, pct: 0.3586 },
  { code: '5.2.06', name: 'Belanja Modal Aset Lainnya', group: 'BELANJA', anggaran: 89257642290, pct: 0.3127 },
  { code: '5.3.01', name: 'Belanja Tidak Terduga', group: 'BELANJA', anggaran: 709370820233, pct: 0.2745 },
  { code: '5.4.02', name: 'Belanja Bantuan Keuangan', group: 'BELANJA', anggaran: 195283179400, pct: 0.4893 },
  { code: '6.1.01', name: 'Sisa Lebih Perhitungan Anggaran Tahun Sebelumnya', group: 'PEMBIAYAAN', anggaran: 5052674866043, pct: 0.6218 },
  { code: '6.1.04', name: 'Penerimaan Pinjaman Daerah', group: 'PEMBIAYAAN', anggaran: 0, pct: 0 },
  { code: '6.1.08', name: 'Penerimaan Pembiayaan Utang Daerah', group: 'PEMBIAYAAN', anggaran: 4822949000000, pct: 0.4167 },
  { code: '6.2.02', name: 'Penyertaan Modal Daerah', group: 'PEMBIAYAAN', anggaran: 5230567000000, pct: 0.4523 },
  { code: '6.2.03', name: 'Pembayaran Cicilan Pokok Utang yang Jatuh Tempo', group: 'PEMBIAYAAN', anggaran: 1810430000000, pct: 0.6641 },
]

type SkpdItem = {
  name: string
  pendAng: number; pendReal: number
  belAng: number; belReal: number
  pemAng: number; pemReal: number
}

const skpdItems: SkpdItem[] = [
  { name: 'SEKRETARIAT DAERAH', pendAng: 252808662000, pendReal: 162808662000, belAng: 3144477852082, belReal: 1934477852082, pemAng: 0, pemReal: 0 },
  { name: 'SEKRETARIAT DPRD', pendAng: 47863500000, pendReal: 33498635000, belAng: 1870687349928, belReal: 1180687349928, pemAng: 0, pemReal: 0 },
  { name: 'BADAN PERENCANAAN PEMBANGUNAN DAERAH', pendAng: 12624000000, pendReal: 8424000000, belAng: 340091241312, belReal: 204091241312, pemAng: 0, pemReal: 0 },
  { name: 'BADAN PENGELOLA KEUANGAN DAN ASET DAERAH', pendAng: 63816749360000, pendReal: 41816749360000, belAng: 5672338940562, belReal: 3272338940562, pemAng: 4822949000000, pemReal: 2009181000000 },
  { name: 'BADAN KEPEGAWAIAN DAERAH', pendAng: 8216900000, pendReal: 5466900000, belAng: 382077788718, belReal: 242077788718, pemAng: 0, pemReal: 0 },
  { name: 'BADAN PENDIDIKAN DAN PELATIHAN', pendAng: 5419800000, pendReal: 3519800000, belAng: 248562748942, belReal: 136562748942, pemAng: 0, pemReal: 0 },
  { name: 'BADAN PENELITIAN DAN PENGEMBANGAN', pendAng: 2046900000, pendReal: 1246900000, belAng: 56088441260, belReal: 31088441260, pemAng: 0, pemReal: 0 },
  { name: 'INSPEKTORAT DAERAH', pendAng: 6283200000, pendReal: 4183200000, belAng: 458192367866, belReal: 288192367866, pemAng: 0, pemReal: 0 },
  { name: 'BADAN KESATUAN BANGSA DAN POLITIK', pendAng: 7962600000, pendReal: 5262600000, belAng: 1159463819468, belReal: 719463819468, pemAng: 0, pemReal: 0 },
  { name: 'DINAS PENDIDIKAN', pendAng: 1266221740000, pendReal: 786221740000, belAng: 36348041712714, belReal: 20448041712714, pemAng: 0, pemReal: 0 },
  { name: 'DINAS KESEHATAN', pendAng: 1020189280000, pendReal: 682189280000, belAng: 20838608476212, belReal: 11938608476212, pemAng: 0, pemReal: 0 },
  { name: 'DINAS PEKERJAAN UMUM DAN PENATAAN RUANG', pendAng: 364724310000, pendReal: 234724310000, belAng: 18415872389380, belReal: 9415872389380, pemAng: 0, pemReal: 0 },
  { name: 'DINAS PERUMAHAN DAN KAWASAN PERMUKIMAN', pendAng: 137488000000, pendReal: 89488000000, belAng: 3307298631978, belReal: 1807298631978, pemAng: 0, pemReal: 0 },
  { name: 'SATUAN POLISI PAMONG PRAJA', pendAng: 85138000000, pendReal: 57138000000, belAng: 5467431840812, belReal: 3267431840812, pemAng: 0, pemReal: 0 },
  { name: 'DINAS SOSIAL', pendAng: 92582000000, pendReal: 58582000000, belAng: 3053738560546, belReal: 1753738560546, pemAng: 0, pemReal: 0 },
  { name: 'DINAS TENAGA KERJA', pendAng: 210576000000, pendReal: 140576000000, belAng: 764761643350, belReal: 434761643350, pemAng: 0, pemReal: 0 },
  { name: 'DINAS LINGKUNGAN HIDUP', pendAng: 298210000000, pendReal: 198210000000, belAng: 8282323768214, belReal: 4582323768214, pemAng: 0, pemReal: 0 },
  { name: 'DINAS KEPENDUDUKAN DAN PENCATATAN SIPIL', pendAng: 154234000000, pendReal: 104234000000, belAng: 608097303100, belReal: 368097303100, pemAng: 0, pemReal: 0 },
  { name: 'DINAS PEMBERDAYAAN MASYARAKAT DAN DESA', pendAng: 34756000000, pendReal: 21756000000, belAng: 1404577165170, belReal: 784577165170, pemAng: 0, pemReal: 0 },
  { name: 'DINAS PENGENDALIAN PENDUDUK DAN KELUARGA BERENCANA', pendAng: 12366000000, pendReal: 7366000000, belAng: 380125437804, belReal: 220125437804, pemAng: 0, pemReal: 0 },
  { name: 'DINAS PERHUBUNGAN', pendAng: 254360000000, pendReal: 164360000000, belAng: 13563711902392, belReal: 7463711902392, pemAng: 0, pemReal: 0 },
  { name: 'DINAS KOMUNIKASI DAN INFORMATIKA', pendAng: 78221000000, pendReal: 50221000000, belAng: 1937819998786, belReal: 1077819998786, pemAng: 0, pemReal: 0 },
  { name: 'DINAS KOPERASI, USAHA KECIL, DAN MENENGAH', pendAng: 66432000000, pendReal: 43432000000, belAng: 464615357202, belReal: 264615357202, pemAng: 0, pemReal: 0 },
  { name: 'DINAS PENANAMAN MODAL DAN PELAYANAN TERPADU SATU PINTU', pendAng: 46277000000, pendReal: 30277000000, belAng: 1508099056946, belReal: 868099056946, pemAng: 0, pemReal: 0 },
  { name: 'DINAS KEPEMUDAAN DAN OLAHRAGA', pendAng: 43218000000, pendReal: 28218000000, belAng: 1428714260088, belReal: 828714260088, pemAng: 0, pemReal: 0 },
  { name: 'DINAS KEBUDAYAAN', pendAng: 28654000000, pendReal: 17654000000, belAng: 928749991716, belReal: 528749991716, pemAng: 0, pemReal: 0 },
  { name: 'DINAS PERPUSTAKAAN', pendAng: 5362000000, pendReal: 3362000000, belAng: 174990003154, belReal: 94990003154, pemAng: 0, pemReal: 0 },
  { name: 'DINAS KEARSIPAN', pendAng: 4186000000, pendReal: 2586000000, belAng: 387039250322, belReal: 217039250322, pemAng: 0, pemReal: 0 },
  { name: 'DINAS PANGAN', pendAng: 32479000000, pendReal: 20479000000, belAng: 1783711556436, belReal: 983711556436, pemAng: 0, pemReal: 0 },
  { name: 'DINAS KELAUTAN DAN PERIKANAN', pendAng: 14832000000, pendReal: 8832000000, belAng: 97416241244, belReal: 52416241244, pemAng: 0, pemReal: 0 },
  { name: 'DINAS PARIWISATA', pendAng: 89466000000, pendReal: 58466000000, belAng: 1148397310756, belReal: 648397310756, pemAng: 0, pemReal: 0 },
  { name: 'DINAS PERTANIAN', pendAng: 9238000000, pendReal: 5638000000, belAng: 146312950672, belReal: 76312950672, pemAng: 0, pemReal: 0 },
  { name: 'DINAS KEHUTANAN', pendAng: 7245000000, pendReal: 4245000000, belAng: 916289013120, belReal: 486289013120, pemAng: 0, pemReal: 0 },
  { name: 'DINAS ENERGI DAN SUMBER DAYA MINERAL', pendAng: 3864000000, pendReal: 2164000000, belAng: 57187852848, belReal: 29187852848, pemAng: 0, pemReal: 0 },
  { name: 'DINAS PERDAGANGAN', pendAng: 5173000000, pendReal: 3173000000, belAng: 81459698964, belReal: 43459698964, pemAng: 0, pemReal: 0 },
  { name: 'DINAS PERINDUSTRIAN', pendAng: 6141000000, pendReal: 3641000000, belAng: 84147802480, belReal: 47147802480, pemAng: 0, pemReal: 0 },
  { name: 'KECAMATAN ADMINISTRASI', pendAng: 72412000000, pendReal: 48412000000, belAng: 6811041530594, belReal: 4111041530594, pemAng: 0, pemReal: 0 },
  { name: 'KOTA ADMINISTRASI', pendAng: 112380000000, pendReal: 72380000000, belAng: 4395340788828, belReal: 2595340788828, pemAng: 0, pemReal: 0 },
  { name: 'KABUPATEN ADMINISTRASI KEPULAUAN SERIBU', pendAng: 18934000000, pendReal: 11934000000, belAng: 335170827918, belReal: 195170827918, pemAng: 0, pemReal: 0 },
]

// ---------------------------------------------------------------------------
// Dokumen transparansi
// ---------------------------------------------------------------------------

const transparansiApbd = [
  'Informasi Kebijakan Umum Anggaran',
  'Informasi Ringkasan Dokumen Prioritas dan Plafon Anggaran',
  'Informasi Ringkasan Dokumen RKA SKPD',
  'Informasi Ringkasan Dokumen RKA PPKD',
  'Notasi Anggaran Pendapatan dan Belanja Daerah (APBD)',
  'Anggaran Pendapatan dan Belanja Daerah (APBD)',
  'Penjelasan Anggaran Pendapatan dan Belanja Daerah (APBD)',
  'Dokumen Anggaran Pendapatan dan Belanja Daerah (APBD)',
  'Peraturan Daerah tentang Anggaran Pendapatan dan Belanja Daerah (APBD)',
  'Data Pokok APBD',
  'Laporan Realisasi APBD',
  'Laporan Realisasi Belanja SKPD',
  'Laporan Realisasi Penerimaan Pembiayaan',
  'Ringkasan Realisasi APBD',
  'Laporan Keuangan Pemerintah Daerah',
]

const transparansiRealisasi = [
  'Laporan Realisasi Pendapatan Daerah',
  'Laporan Realisasi Belanja Daerah',
  'Laporan Realisasi Penerimaan Pembiayaan',
  'Laporan Realisasi Pengeluaran Pembiayaan',
  'Laporan Realisasi Anggaran per SKPD',
  'Laporan Realisasi Anggaran per Program',
  'Laporan Realisasi Anggaran per Kegiatan',
  'Rekapitulasi Realisasi Belanja per Urusan',
  'Rekapitulasi Realisasi Belanja per Fungsi',
  'Laporan Kemajuan Realisasi per Triwulan',
  'Laporan Realisasi Belanja Modal',
  'Laporan Realisasi Transfer Daerah',
  'Laporan Pertanggungjawaban Pelaksanaan APBD',
  'Laporan Operasional (LO)',
  'Laporan Perubahan Ekuitas (LPE)',
]

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main() {
  console.log('Seeding database...')

  await db.apbdSummary.deleteMany()
  await db.budgetItem.deleteMany()
  await db.realisasiAkun.deleteMany()
  await db.realisasiSkpd.deleteMany()
  await db.transparansiDoc.deleteMany()

  for (const s of apbdSummary) {
    await db.apbdSummary.create({
      data: {
        year: s.year,
        pendapatanApbd: s.pendApbd,
        pendapatanApbdp: s.pendApbdp,
        belanjaApbd: s.belApbd,
        belanjaApbdp: s.belApbdp,
        terimaApbd: s.terApbd,
        terimaApbdp: s.terApbdp,
        keluarApbd: s.kelApbd,
        keluarApbdp: s.kelApbdp,
      },
    })
  }

  const sections: { section: string; tab: string; items: Item[] }[] = [
    { section: 'pendapatan', tab: 'utama', items: pendapatanItems },
    { section: 'belanja', tab: 'ops', items: belanjaOperasi },
    { section: 'belanja', tab: 'mdl', items: belanjaModal },
    { section: 'belanja', tab: 'ttdg', items: belanjaTidakTerduga },
    { section: 'belanja', tab: 'tf', items: belanjaTransfer },
    { section: 'belanja', tab: 'urusan', items: belanjaPerUrusan },
    { section: 'pembiayaan', tab: 'terima', items: pembiayaanPenerimaan },
    { section: 'pembiayaan', tab: 'keluar', items: pembiayaanPengeluaran },
  ]

  for (const { section, tab, items } of sections) {
    for (const it of items) {
      await db.budgetItem.create({
        data: { section, tab, code: it.code, name: it.name, year: 2026, amount: it.y2026 },
      })
      await db.budgetItem.create({
        data: { section, tab, code: it.code, name: it.name, year: 2025, amount: it.y2025 },
      })
    }
  }

  for (const r of realisasiItems) {
    await db.realisasiAkun.create({
      data: {
        code: r.code,
        name: r.name,
        group: r.group,
        anggaran: r.anggaran,
        realisasi: Math.round(r.anggaran * r.pct),
      },
    })
  }

  for (const s of skpdItems) {
    await db.realisasiSkpd.create({
      data: {
        name: s.name,
        pendapatanAnggaran: s.pendAng,
        pendapatanRealisasi: s.pendReal,
        belanjaAnggaran: s.belAng,
        belanjaRealisasi: s.belReal,
        pembiayaanAnggaran: s.pemAng,
        pembiayaanRealisasi: s.pemReal,
      },
    })
  }

  for (const title of transparansiApbd) {
    await db.transparansiDoc.create({
      data: { type: 'APBD', title, url: '#' },
    })
  }
  for (const title of transparansiRealisasi) {
    await db.transparansiDoc.create({
      data: { type: 'Realisasi', title, url: '#' },
    })
  }

  // visitor counter bulan berjalan
  const now = new Date()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  await db.visitorCounter.upsert({
    where: { month },
    update: {},
    create: { month, count: 0 },
  })

  console.log('Seed selesai.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
