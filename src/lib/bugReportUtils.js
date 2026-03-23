export function normalizeText(v) {
  return String(v || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

export function buildFingerprint({ route, severity, title, description }) {
  const base = [
    normalizeText(route),
    normalizeText(severity),
    normalizeText(title).slice(0, 120),
    normalizeText(description).slice(0, 180),
  ].join('|')

  let hash = 0
  for (let i = 0; i < base.length; i += 1) {
    hash = ((hash << 5) - hash) + base.charCodeAt(i)
    hash |= 0
  }
  return `fp_${Math.abs(hash)}`
}

export function parseTags(input) {
  return String(input || '')
    .split(',')
    .map(t => t.trim().toLowerCase().replace(/[^a-z0-9_-]/g, ''))
    .filter(Boolean)
    .slice(0, 6)
}

export function formatReportedScreen(route) {
  const clean = String(route || '').trim()
  if (!clean) return ''
  if (clean === '/') return 'Dashboard (/)' 
  return clean
}

export function fileSizeLabel(bytes) {
  if (!bytes) return '0 B'
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

export async function compressImage(file) {
  if (!file || !file.type?.startsWith('image/')) return file
  if (file.size <= 1.2 * 1024 * 1024) return file

  try {
    if (typeof createImageBitmap !== 'function') return file

    const bitmap = await createImageBitmap(file)
    const maxW = 1600
    const scale = Math.min(1, maxW / bitmap.width)
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return file
    }

    ctx.drawImage(bitmap, 0, 0, width, height)

    const blob = await new Promise(resolve => {
      canvas.toBlob(resolve, 'image/jpeg', 0.78)
    })

    bitmap.close()
    return blob || file
  } catch {
    return file
  }
}
