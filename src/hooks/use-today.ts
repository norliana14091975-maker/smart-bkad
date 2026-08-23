'use client'

import { useSyncExternalStore } from 'react'
import { toLocalISODate } from '@/lib/format'

/**
 * Tanggal hari ini (YYYY-MM-DD, zona waktu browser) yang aman dari hydration
 * mismatch.
 *
 * Saat SSR dan saat render hidrasi pertama, nilai ini selalu string kosong
 * (getServerSnapshot). Setelah hidrasi selesai, React membaca snapshot klien
 * sehingga tanggal terisi tanpa ketidakcocokan atribut/teks antara server dan
 * browser — berbeda dari memanggil new Date() langsung saat render, yang bisa
 * menghasilkan tanggal berbeda karena perbedaan zona waktu server vs browser.
 */
function subscribe() {
  // Tidak ada sumber data eksternal yang berubah; snapshot cukup dibaca
  // sekali setelah hidrasi.
  return () => {}
}

function getClientSnapshot(): string {
  return toLocalISODate(new Date())
}

function getServerSnapshot(): string {
  return ''
}

export function useToday(): string {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot)
}
