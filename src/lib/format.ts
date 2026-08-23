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

/** Format tanggal pendek Indonesia, mis. 23/08/2026 */
export function formatDateShortID(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${d}/${m}/${date.getFullYear()}`
}
