// Image compression using native Canvas API — no external library needed.
//
// Pipeline:
//   File → createObjectURL → HTMLImageElement → Canvas (resize) → toDataURL (WebP/JPEG)
//
// Typical result: 5 MB JPEG → ~150–250 KB WebP at 1280 px / 75% quality.

const MAX_INPUT_BYTES = 15 * 1024 * 1024 // 15 MB hard cap to avoid OOM on canvas

export type CompressOptions = {
  maxPx?: number    // longest side limit in pixels (default 1280)
  quality?: number  // 0–1 (default 0.75 → 75%)
}

/**
 * Compress an image File/Blob using the browser Canvas API.
 * Returns a base64 data URL in WebP format (falls back to JPEG if WebP
 * is not supported by the browser, e.g. old Safari).
 *
 * Throws if the file is not a valid image or exceeds MAX_INPUT_BYTES.
 */
export async function compressImage(
  file: File,
  { maxPx = 1280, quality = 0.75 }: CompressOptions = {}
): Promise<string> {
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error(`Ảnh quá lớn (tối đa ${MAX_INPUT_BYTES / 1024 / 1024} MB)`)
  }

  const blobUrl = URL.createObjectURL(file)

  try {
    const img = await loadImage(blobUrl)
    const { width, height } = fitDimensions(img.naturalWidth, img.naturalHeight, maxPx)

    const canvas = document.createElement('canvas')
    canvas.width  = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas context unavailable')

    // White background so transparent PNGs don't become black in lossy formats
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0, width, height)

    // Prefer WebP; detect support by checking the produced data URL header
    const webp = canvas.toDataURL('image/webp', quality)
    if (webp.startsWith('data:image/webp')) return webp

    // Fallback: JPEG (older Safari, Firefox < 96)
    return canvas.toDataURL('image/jpeg', quality)
  } finally {
    URL.revokeObjectURL(blobUrl)
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload  = () => resolve(img)
    img.onerror = () => reject(new Error('Không thể đọc file ảnh'))
    img.src = src
  })
}

function fitDimensions(
  w: number,
  h: number,
  max: number
): { width: number; height: number } {
  if (w <= max && h <= max) return { width: w, height: h }
  const ratio = w >= h ? max / w : max / h
  return {
    width:  Math.round(w * ratio),
    height: Math.round(h * ratio),
  }
}

/**
 * Human-readable size string, e.g. "2.4 MB" or "312 KB".
 * Useful for showing before/after info.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Estimate the byte size of a base64 data URL string.
 * (approximate: ignores the header, 3/4 ratio of base64)
 */
export function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] ?? ''
  return Math.round((base64.length * 3) / 4)
}
