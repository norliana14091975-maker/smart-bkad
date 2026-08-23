const idFormat2 = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const idFormat0 = new Intl.NumberFormat('id-ID', {
  maximumFractionDigits: 0,
})

/** Format angka gaya Indonesia dengan 2 desimal, mis. 71.450.673.065.697,00 */
export function formatRupiah(value: number): string {
  return idFormat2.format(value)
}

/** Format angka bulat gaya Indonesia, mis. 71.450.673.065.697 */
export function formatRupiah0(value: number): string {
  return idFormat0.format(value)
}

/** Format ringkas dalam triliun, mis. 71,45 T */
export function formatTriliun(value: number): string {
  return `${idFormat2.format(value / 1e12)} T`
}

/** Format persentase dengan 2 desimal, mis. 61,78 % */
export function formatPct(value: number): string {
  return `${idFormat2.format(value)} %`
}

/** Format tanggal Indonesia, mis. 23 Agustus 2026 */
export function formatDateID(date: Date): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

/**
 * Ubah Date menjadi string tanggal ISO lokal (YYYY-MM-DD) menggunakan komponen
 * tanggal lokal — berbeda dengan toISOString() yang memakai UTC sehingga bisa
 * bergeser satu hari tergantung zona waktu.
 */
export function toLocalISODate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Format string tanggal ISO (YYYY-MM-DD) menjadi teks Indonesia, mis. 23 Agustus 2026.
 * Diparse dari komponen tanggal (bukan UTC) agar tidak bergeser zona waktu.
 */
export function formatDateFromISO(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const [y, m, d] = iso.split('-').map(Number)
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(y, m - 1, d))
}

/** Format tanggal pendek Indonesia, mis. 23/08/2026 */
export function formatDateShortID(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${d}/${m}/${date.getFullYear()}`
}
