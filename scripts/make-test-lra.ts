/**
 * Skrip pembuatan PDF LRA contoh untuk menguji fitur import.
 * Hasil: /tmp/test-lra.pdf
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import fs from 'fs'

const ROWS: [string, string, string, string][] = [
  ['4.1.01', 'Pajak Daerah', '49.898.218.773.411,00', '30.000.000.000.000,00'],
  ['4.1.02', 'Retribusi Daerah', '2.214.853.656.242,00', '1.500.000.000.000,00'],
  ['4.1.03', 'Hasil Pengelolaan Kekayaan Daerah yang Dipisahkan', '876.020.190.232,00', '600.000.000.000,00'],
  ['4.2.01', 'Pendapatan Transfer Pemerintah Pusat', '11.159.480.293.000,00', '7.000.000.000.000,00'],
  ['5.1.01', 'Belanja Pegawai', '21.431.736.563.104,00', '12.000.000.000.000,00'],
  ['5.1.02', 'Belanja Barang dan Jasa', '29.000.142.954.078,00', '15.500.000.000.000,00'],
  ['5.2.04', 'Belanja Modal Jalan, Jaringan, dan Irigasi', '5.357.208.391.634,00', '2.000.000.000.000,00'],
  ['6.1.01', 'Sisa Lebih Perhitungan Anggaran Tahun Sebelumnya', '5.052.674.866.043,00', '3.000.000.000.000,00'],
  ['6.2.02', 'Penyertaan Modal Daerah', '5.230.567.000.000,00', '2.500.000.000.000,00'],
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

  // Judul
  draw('LAPORAN REALISASI ANGGARAN', width / 2 - 130, 550, 16, true)
  draw('PEMERINTAH PROVINSI DKI JAKARTA', width / 2 - 120, 530, 12)
  draw('TAHUN ANGGARAN 2026 — PERIODE SAMPAI DENGAN 31 AGUSTUS 2026', width / 2 - 170, 512, 10)

  // Kepala kolom
  const cols = [40, 100, 330, 560, 700]
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
    draw(code, cols[0], y, 10)
    draw(name.slice(0, 45), cols[1], y, 10)
    draw(anggaran, cols[2], y, 10)
    draw(realisasi, cols[3], y, 10)
    y -= 22
  }

  const bytes = await doc.save()
  fs.writeFileSync('/tmp/test-lra.pdf', bytes)
  console.log('PDF LRA uji dibuat: /tmp/test-lra.pdf,', ROWS.length, 'baris rekening')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
