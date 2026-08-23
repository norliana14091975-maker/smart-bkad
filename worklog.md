# Project Worklog

---
Task ID: 1
Agent: Z.ai Code (main)
Task: Clone https://dashboard-bpkd.jakarta.go.id/ — Dashboard Monitoring Pengelolaan Keuangan Daerah Provinsi DKI Jakarta

Work Log:
- Analisis situs asli menggunakan web-reader + agent-browser (snapshot, ekstraksi tabel, tangkapan layar + analisis VLM) untuk memahami struktur navigasi, tata letak, skema warna, dan data yang ditampilkan
- Kumpulkan data anggaran publik: ringkasan APBD 2022–2026 (pendapatan, belanja, penerimaan & pengeluaran pembiayaan), akun pendapatan, belanja (5 tab: Operasi/Modal/Tidak Terduga/Transfer/Per-Urusan), pembiayaan (Penerimaan/Pengeluaran), daftar dokumen transparansi
- Implementasi original (bukan salinan kode) memakai Next.js 16 + Tailwind + shadcn/ui + Recharts, dengan semua kode ditulis sendiri
- Prisma: schema baru (ApbdSummary, BudgetItem, RealisasiAkun, RealisasiSkpd, TransparansiDoc, VisitorCounter) + seed (prisma/seed.ts) → `bun run db:push` + seed sukses
- API routes: /api/apbd, /api/pendapatan, /api/belanja, /api/pembiayaan, /api/realisasi/akun, /api/realisasi/skpd (dengan filter q), /api/transparansi, /api/visitor (GET/POST)
- Frontend (single-page, client-side section switching di `/`):
  - Shell: sidebar navy gelap (menu tree Anggaran/Realisasi/Transparansi + brand DASHBOARD + emblem), header band biru dengan pola watermark + logo BPKD + lencana emas SVG buatan sendiri, breadcrumb per section, footer sticky dengan penghitung pengunjung bulanan
  - APBD: grid 2x2 grafik batang berkelompok (hijau/merah/biru/kuning APBD vs APBDP) + tabel per tahun
  - Pendapatan/Belanja/Pembiayaan: grafik + tabel per akun dengan tab (shadcn Tabs) dan baris JUMLAH
  - Realisasi Per-Akun: filter tanggal, 4 kartu ringkasan (Total APBD, Realisasi Penerimaan/Pengeluaran, SiLPA), tabel per kelompok dengan kolom %
  - Realisasi Per-SKPD: filter tanggal + pencarian SKPD + tabel gabungan multi-header
  - Transparansi: tab APBD/Realisasi, daftar 15 dokumen masing-masing
- Lint bersih (`bun run lint` tanpa error)
- Verifikasi end-to-end dengan agent-browser: semua 8 section + perpindahan tab + filter SKPD + drawer mobile + footer pengunjung bekerja, tanpa error console/runtime

Stage Summary:
- Produksi: clone dashboard keuangan DKI Jakarta berfungsi penuh di route `/`, didukung API + SQLite (Prisma), seed data anggaran publik, penghitung pengunjung live
- Keputusan: navigasi via state (bukan route) karena hanya `/` yang terlihat user; angka realisasi dibuat representatif (sumber asli memuat via AJAX dan tidak menampilkan data); logo/emblem dibuat sebagai SVG original, bukan aset situs asli
