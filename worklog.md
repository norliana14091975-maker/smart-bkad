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

---
Task ID: 2
Agent: Z.ai Code (main)
Task: Perbaiki hydration mismatch yang dilaporkan user (console error pada <body>)

Work Log:
- Diagnosis: error hidrasi berasal dari atribut `data-gr-ext-installed` & `data-new-gr-c-s-check-loaded` yang disuntik ekstensi Grammarly ke <body> sebelum React hidrasi (terlihat pada diff di pesan error)
- Fix 1: tambah `suppressHydrationWarning` pada <body> di src/app/layout.tsx (solusi standar untuk atribut ekstensi browser; <html> sudah memilikinya)
- Fix 2 (pencegahan): eliminasi risiko mismatch tanggal karena perbedaan zona waktu server (UTC) vs browser (Asia/Jakarta) pada section Realisasi:
  - src/lib/format.ts: tambah `toLocalISODate()` (komponen tanggal lokal, bukan UTC) dan `formatDateFromISO()` (parse YYYY-MM-DD tanpa pergeseran zona waktu)
  - src/hooks/use-today.ts (baru): hook `useToday()` memakai `useSyncExternalStore` dengan getServerSnapshot `''` — render server & hidrasi pertama identik, tanggal terisi setelah hidrasi
  - realisasi-akun-section.tsx & realisasi-skpd-section.tsx: ganti `new Date()` saat render dengan pola `today = useToday()` + `dateOverride` state; input tanggal jadi controlled; teks judul pakai `formatDateFromISO(date)`
  - Catatan lint: pola setState-dalam-useEffect ditolak rule `react-hooks/set-state-in-effect`, sehingga digunakan useSyncExternalStore
- `bun run lint` bersih; verifikasi agent-browser: reload tanpa error console/hidrasi, kedua section Realisasi menampilkan tanggal dengan benar, input tanggal interaktif (ubah ke 2026-06-30 → judul "30 Juni 2026"), sanity pass semua section Anggaran tetap berfungsi

Stage Summary:
- Error hidrasi ekstensi Grammarly pada <body> diredam via suppressHydrationWarning; risiko mismatch tanggal server/klien dihilangkan secara struktural dengan hook useToday berbasis useSyncExternalStore + helper format zona-waktu-aman

---
Task ID: 3 (spec)
Agent: Z.ai Code (main)
Task: Kontrak API backend untuk fitur admin + import LRA (spesifikasi untuk Task ID 3-a)

Work Log:
- Frontend admin selesai: login dialog, sidebar dengan grup ADMIN (6 menu), section overview/apbd/budget/realisasi/import/transparansi
- Prisma sudah punya model AdminUser, AdminSession, ImportLog; DB sudah di-push & di-seed (admin/admin123)
- pdf-parse sudah terinstall + deklarasi tipe di src/types/pdf-parse.d.ts

Stage Summary: KONTRAK API YANG WAJIB DIIKUMENTASIKAN EXACTLY (semua respons JSON { data: ... } saat sukses, { error: string } saat gagal):

AUTH:
- POST /api/auth/login  body {username, password} → 200 {data:{username}} + Set-Cookie httpOnly `bpkd_admin_session` (7 hari); 401 {error:'Username atau password salah'}
- POST /api/auth/logout → 200 {data:{ok:true}} (hapus sesi + clear cookie)
- GET /api/auth/me → 200 {data:{username}} atau 401 {error:'Belum login'}
- Verifikasi password: hash scrypt format "salt:hash" (hex, keylen 64) — lihat prisma/seed.ts hashPassword()

ADMIN (semua butuh sesi valid; tanpa sesi → 401 {error:'Tidak diizinkan. Silakan login.'}):
- GET /api/admin/overview → {data:{counts:{apbdYears,budgetItems,realisasiAkun,realisasiSkpd,transparansiDocs,importLogs}, visitorThisMonth, recentImports:[ImportLogDto terbaru 10, createdAt ISO string]}}
- GET /api/admin/apbd → {data:[ApbdSummaryDto]} (bentuk sama dengan /api/apbd: year,pendapatan{apbd,apbdp},belanja{...},penerimaanPembiayaan{...},pengeluaranPembiayaan{...}) urut year desc
- POST /api/admin/apbd body bentuk ApbdSummaryDto → upsert by year → {data:ApbdSummaryDto}
- DELETE /api/admin/apbd?year=2024 → {data:{ok:true}}
- GET /api/admin/budget-items?section=&tab=&year= → {data:[{id,section,tab,code,name,year,amount}]} (year boleh 'semua' → tanpa filter) urut code asc
- POST /api/admin/budget-items body {section,tab,code,name,year,amount} → {data:{id,...}}
- PUT /api/admin/budget-items body {id,section,tab,code,name,year,amount} → {data:{...}}
- DELETE /api/admin/budget-items?id=1 → {data:{ok:true}}
- GET /api/admin/realisasi-akun → {data:[{id,code,name,group,anggaran,realisasi}]} urut code asc
- PUT /api/admin/realisasi-akun body {id,anggaran,realisasi} → {data:{...}}
- DELETE /api/admin/realisasi-akun?id=1 ATAU ?all=1 → {data:{ok:true}}
- GET /api/admin/realisasi-skpd → {data:[{id,name,pendapatan{anggaran,realisasi},belanja{...},pembiayaan{...}}]} urut name asc
- PUT /api/admin/realisasi-skpd body {id,pendapatan{anggaran,realisasi},belanja{...},pembiayaan{...}} → {data:{...}}
- DELETE /api/admin/realisasi-skpd?id=1 ATAU ?all=1 → {data:{ok:true}}
- GET /api/admin/transparansi?type=APBD|Realisasi → {data:[{id,type,title,url}]} urut id asc
- POST /api/admin/transparansi body {type,title,url} → {data:{id,...}}
- DELETE /api/admin/transparansi?id=1 → {data:{ok:true}}
- POST /api/admin/import/lra (multipart field 'file', PDF ≤10MB, cek magic bytes %PDF) → {data:{importLogId, filename, pages, items:[{code,name,anggaran,realisasi,pct}], textPreview(≤500 char)}}; error 400 {error} jika bukan PDF/terlalu besar/tanpa teks (hasil scan); ekstraksi: pdf-parse → chunk teks ±15000 char → per chunk panggil z-ai-web-dev-sdk chat completions (lihat skills/LLM/SKILL.md, `const zai = await ZAI.create()`, messages + thinking disabled) minta HANYA array JSON [{"code","name","anggaran","realisasi"}] (angka format Indonesia→plain), parse dengan buang code fence, gabung & dedupe by code; pct=anggaran>0?realisasi/anggaran*100:0; simpan ImportLog status 'parsed'
- POST /api/admin/import/confirm body {importLogId, items(sama bentuk), mode:'replace'|'append'} → {data:{saved:N}}; replace = deleteMany realisasi_akun lalu insert semua; append = upsert by code; group ditentukan prefix kode ('4'→PENDAPATAN,'5'→BELANJA,'6'→PEMBIAYAAN); update ImportLog status 'confirmed' records=N
- GET /api/admin/import/logs → {data:[ImportLogDto]} urut terbaru

---
Task ID: 3-b
Agent: Z.ai Code (main)
Task: Integrasi frontend admin, perbaikan worker pdf-parse, verifikasi end-to-end penuh

Work Log:
- Frontend admin (build sendiri, frontend-first): LoginDialog, AdminGuard, sidebar grup ADMIN (6 menu) + tombol Login/Keluar, 6 section admin (overview stat cards + riwayat, APBD CRUD dialog, Item Anggaran dengan filter section/tab/tahun + CRUD, Data Realisasi tabs Akun/SKPD dengan edit/hapus/hapus-semua, Import LRA dengan dropzone + preview + radio mode + konfirmasi + riwayat, Transparansi CRUD), integrasi page.tsx (state admin + cek sesi on-mount), CSS scrollbar kustom .nice-scrollbar
- Backend dibuat full-stack-developer (Task 3-a) sesuai kontrak: src/lib/auth.ts + 13 route auth/admin/import; semua lulus lint
- Perbaikan bug integrasi pdf-parse v2 di Turbopack: worker pdfjs gagal resolve ('.next/dev/server/chunks/pdf.worker.mjs') → tambahkan PDFParse.setWorker(path absolut node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs) di route import; hapus d.ts usang
- Perbaikan bug hydration (div dalam p): admin-overview-section — <p> berisi <Skeleton> (div) diganti <div>
- Uji curl end-to-end: login ok/salah, cookie sesi, overview counts, APBD upsert+delete, budget-items list, import PDF test (pdf-lib generate /tmp/test-lra.pdf 9 baris) → ekstraksi LLM 9/9 baris akurat (format angka Indonesia diparse benar, pct benar), confirm append (saved 9), API publik memuat data baru, logout invalidasi sesi
- Verifikasi browser penuh: login dialog → auto-navigasi Ringkasan Admin, semua 6 section admin berfungsi, upload PDF via UI → "Ekstraksi berhasil — 9 baris terdeteksi" → Konfirmasi Import → status Tersimpan, data tampil di dashboard publik, logout kembali ke publik, sesi bertahan reload, mobile drawer + tombol login admin OK, tanpa error console/hidrasi
- Data di-reseed untuk kondisi bersih; scripts/make-test-lra.ts disimpan sebagai utilitas uji

Stage Summary:
- Fitur lengkap: login admin (admin/admin123, sesi cookie httpOnly 7 hari, scrypt), dashboard admin 6 modul pengelolaan data, import LRA dari PDF (pdf-parse + LLM chunked, replace/append) terverifikasi end-to-end; lint bersih; tanpa error runtime

---
Task ID: 4
Agent: Z.ai Code (main)
Task: Fitur Pengaturan Aplikasi (ubah nama aplikasi, logo, favicon, dan teks lainnya)

Work Log:
- Prisma: model AppSetting (key-value) → db:push
- Backend: src/lib/default-settings.ts (nilai bawaan, client-safe), src/lib/settings.ts (getSettings gabung default, server), src/lib/image-upload.ts (deteksi magic bytes PNG/JPG/GIF/WebP/ICO/SVG + sanitasi SVG anti-XSS + simpan ke public/uploads dengan cache-buster ?v=)
- API: GET /api/settings (publik), PUT /api/admin/settings (teks dengan limit panjang), POST /api/admin/settings/reset, POST+DELETE /api/admin/settings/logo, POST+DELETE /api/admin/settings/favicon (semua admin butuh sesi)
- Integrasi: layout.tsx generateMetadata dinamis (title/description/icons dari DB); sidebar (brand appName + logo kustom + menu "Pengaturan Aplikasi" + footer teks); HeaderBand (logo kustom + brandText/subtext, BpkdLogo kini parametris); VisitorFooter (footerText); page.tsx (useSettings + merge default + efek document.title & favicon live tanpa reload); hooks/use-settings.ts dipakai bersama page & admin
- UI admin: admin-settings-section.tsx — form 6 kolom teks dengan counter karakter + draft/batalkan, kartu Logo & Favicon (preview, unggah, hapus), reset semua dengan AlertDialog
- Investigasi anomali "[m hilang": terbukti file di disk BENAR (Write/Edit tool aman); yang ter-strip hanyalah tampilan input/output command bash tool (sanitasi ANSI). Scanner damage = 0 file rusak. File tes dibersihkan
- Dev server sempat mati (dibunuh untuk regenerasi Prisma client) — ditemukan teknik start persisten: proses orphan double-fork (setsid bash -c 'exec ...') diadopsi PID 1 sehingga bertahan antar-call
- Generate logo & favicon uji via z-ai image CLI (JPEG terdeteksi benar oleh magic-byte check → tersimpan .jpg)
- Verifikasi end-to-end: API (login/PUT/upload/unauth 401/head HTML menampilkan title+favicon kustom via generateMetadata), browser (sidebar "KEUANGAN DKI" + logo kustom di sidebar/header + footer kustom + title tab berubah; ubah nama via UI → sidebar update instan; upload logo via UI → versi cache baru; reset via UI → semua kembali bawaan + file terhapus), restart server segar → kompilasi bersih, tanpa error console, lint bersih

Stage Summary:
- Fitur Pengaturan Aplikasi lengkap: nama aplikasi, judul halaman (tab browser), deskripsi SEO, teks & sub-teks brand header, footer, logo (unggah/hapus), favicon (unggah/hapus), reset semua — tersimpan di DB, live update tanpa reload, favicon/title juga dirender server-side via generateMetadata; dev server berjalan persisten
