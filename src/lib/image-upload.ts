import fs from 'fs'
import path from 'path'

// Folder penyimpanan unggahan (disajikan sebagai file statis)
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')

// Ukuran maksimum gambar logo/favicon: 2 MB
export const MAX_IMAGE_SIZE = 2 * 1024 * 1024

const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico']

/**
 * Deteksi jenis gambar dari magic bytes buffer (tidak memercayai nama file).
 * Mengembalikan ekstensi ('png'|'jpg'|'gif'|'webp'|'ico'|'svg') atau null.
 */
export function detectImageType(buffer: Buffer): string | null {
  if (buffer.length < 8) return null

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'png'
  }
  // JPEG: FF D8 FF
  if (buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return 'jpg'
  // GIF: "GIF89a" / "GIF87a"
  const gif = buffer.subarray(0, 6).toString('latin1')
  if (gif === 'GIF89a' || gif === 'GIF87a') return 'gif'
  // ICO/CUR: 00 00 01 00
  if (buffer.subarray(0, 4).equals(Buffer.from([0x00, 0x00, 0x01, 0x00]))) return 'ico'
  // WEBP: "RIFF" .... "WEBP"
  if (
    buffer.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buffer.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'webp'
  }
  // SVG berbasis teks: diawali <?xml / <svg / <!doctype svg
  const head = buffer.subarray(0, 256).toString('utf8').trim().toLowerCase()
  if (
    head.startsWith('<?xml') ||
    head.startsWith('<svg') ||
    head.startsWith('<!doctype svg')
  ) {
    return 'svg'
  }
  return null
}

/**
 * Sanitasi SVG unggahan: buang elemen script, atribut event handler (on*),
 * dan URL javascript: agar tidak menjadi vektor XSS.
 */
export function sanitizeSvg(svg: string): string {
  return svg
    .replace(/<script[\s\S]*?<\/script\s*>/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|xlink:href)\s*=\s*("javascript:[^"]*"|'javascript:[^']*')/gi, '')
}

/**
 * Simpan gambar unggahan dengan nama dasar tetap (mis. 'app-logo').
 * Menghapus varian ekstensi lama agar tidak menumpuk. Mengembalikan URL
 * publik dengan parameter versi (?v=) untuk membatalkan cache browser.
 */
export async function saveUploadedImage(
  buffer: Buffer,
  baseName: string
): Promise<string> {
  const ext = detectImageType(buffer)
  if (!ext) {
    throw new Error('File bukan gambar yang valid (PNG/JPG/GIF/WebP/SVG/ICO)')
  }

  fs.mkdirSync(UPLOAD_DIR, { recursive: true })

  if (ext === 'svg') {
    fs.writeFileSync(
      path.join(UPLOAD_DIR, `${baseName}.svg`),
      sanitizeSvg(buffer.toString('utf8')),
      'utf8'
    )
  } else {
    fs.writeFileSync(path.join(UPLOAD_DIR, `${baseName}.${ext}`), buffer)
  }

  // Hapus varian ekstensi lain dari baseName yang sama
  for (const e of IMAGE_EXTS) {
    if (e === ext) continue
    const p = path.join(UPLOAD_DIR, `${baseName}.${e}`)
    if (fs.existsSync(p)) {
      try {
        fs.unlinkSync(p)
      } catch {
        // abaikan kegagalan penghapusan file lama
      }
    }
  }

  return `/uploads/${baseName}.${ext}?v=${Date.now()}`
}

/**
 * Hapus semua file gambar untuk baseName tertentu (best-effort).
 */
export function removeUploadedImage(baseName: string): void {
  for (const e of IMAGE_EXTS) {
    const p = path.join(UPLOAD_DIR, `${baseName}.${e}`)
    if (fs.existsSync(p)) {
      try {
        fs.unlinkSync(p)
      } catch {
        // abaikan
      }
    }
  }
}
