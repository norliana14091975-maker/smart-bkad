/**
 * Skrip pembuatan PDF LRA contoh untuk menguji aturan import sesuai
 * Bagan Akun Standar (BAS) Permendagri 77/2020:
 * - rincian obyek 3 digit (4.1.01.01.001, 5.1.01.01.001)
 * - satu baris kode flat tanpa titik (4102 → 4.1.02)
 * - level induk belanja/pembiayaan sengaja tidak dicetak (uji roll-up:
 *   5, 5.1, 5.2, 6, 6.1, 6.2 harus diturunkan dari jumlah anaknya)
 * - satu baris non-BAS (7.1.01) yang harus ditolak
 * Hasil: /tmp/test-lra.pdf
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import fs from 'fs'

const ROWS: [string, string, string, string][] = [
  // Pendapatan — hierarki lengkap + rincian obyek 3 digit + kode flat
  ['4', 'PENDAPATAN DAERAH', '100.000.000.000.000,00', '60.000.000.000.000,00'],
  ['4.1', 'PENDAPATAN ASLI DAERAH', '70.000.000.000.000,00', '45.000.000.000.000,00'],
  ['4.1.01', 'Pajak Daerah', '50.000.000.000.000,00', '30.000.000.000.000,00'],
  ['4.1.01.01', 'Pajak Hotel', '10.000.000.000.000,00', '6.000.000.000.000,00'],
  ['4.1.01.01.001', 'Pajak Hotel Bintang 3', '8.000.000.000.000,00', '5.000.000.000.000,00'],
  ['4102', 'Retribusi Daerah', '20.000.000.000.000,00', '15.000.000.000.000,00'],
  ['4.2', 'PENDAPATAN TRANSFER', '30.000.000.000.000,00', '15.000.000.000.000,00'],
  ['4.2.01', 'Transfer Pemerintah Pusat', '30.000.000.000.000,00', '15.000.000.000.000,00'],
  // Belanja — 5, 5.1, 5.2 sengaja tidak dicetak (uji turunan hierarki)
  ['5.1.01', 'Belanja Pegawai', '40.000.000.000.000,00', '25.000.000.000.000,00'],
  ['5.1.01.01.001', 'Gaji Pokok PNS', '30.000.000.000.000,00', '20.000.000.000.000,00'],
  ['5.2.04', 'Belanja Modal Jalan dan Irigasi', '10.000.000.000.000,00', '4.000.000.000.000,00'],
  // Pembiayaan — 6, 6.1, 6.2 sengaja tidak dicetak
  ['6.1.01', 'Sisa Lebih Perhitungan Anggaran', '5.000.000.000.000,00', '3.000.000.000.000,00'],
  ['6.2.02', 'Penyertaan Modal Daerah', '4.000.000.000.000,00', '2.000.000.000.000,00'],
  // Baris di luar struktur BAS — harus ditolak validator
  ['7.1.01', 'Aset Tetap (bukan LRA)', '1.000.000.000.000,00', '500.000.000.000,00'],
]

async function main() {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const page = doc.addPage([842, 595]) // A4 landscape
  const { width } = page.getSize()

  const draw = (text: string, x: number, y: number, size: number, useBold = false) => {
    page.drawText(text, { x, y, size, font: useBold ? bold : font, color: rgb(0.1, 0.1, 0.1) })
  }

  draw('LAPORAN REALISASI ANGGARAN', width / 2 - 130, 550, 16, true)
  draw('PEMERINTAH PROVINSI DKI JAKARTA', width / 2 - 120, 530, 12)
  draw('TAHUN ANGGARAN 2026 — PERIODE SAMPAI DENGAN 31 AGUSTUS 2026', width / 2 - 170, 512, 10)

  const cols = [40, 110, 330, 560, 700]
  draw('Kode', cols[0], 480, 10, true)
  draw('Uraian', cols[1], 480, 10, true)
  draw('Anggaran (Rp)', cols[2], 480, 10, true)
  draw('Realisasi (Rp)', cols[3], 480, 10, true)
  page.drawLine({
    start: { x: 40, y: 472 },
    end: { x: width - 40, y: 472 },
    thickness: 1,
    color: rgb(0.5, 0.5, 0.5),
  })

  let y = 452
  for (const [code, name, anggaran, realisasi] of ROWS) {
    const isTop = !code.includes('.') || code.split('.').length === 2
    draw(code, cols[0], y, 10, isTop)
    draw(name.slice(0, 40), cols[1], y, 10, isTop)
    draw(anggaran, cols[2], y, 10)
    draw(realisasi, cols[3], y, 10)
    y -= 20
    if (y < 40) break
  }

  const bytes = await doc.save()
  fs.writeFileSync('/tmp/test-lra.pdf', bytes)
  console.log('PDF LRA uji BAS dibuat: /tmp/test-lra.pdf,', ROWS.length, 'baris (termasuk 1 non-BAS)')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
