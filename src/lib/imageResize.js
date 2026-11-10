function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = (err) => { URL.revokeObjectURL(url); reject(err) }
    img.src = url
  })
}

// Shrinks an image so its longer side is at most `maxSide` pixels and
// re-encodes it as JPEG. Returns the original file when the browser can't
// decode it, so uploads still work for formats the canvas doesn't support.
export async function downscaleImage(file, maxSide = 512, quality = 0.85) {
  if (typeof document === 'undefined' || !file) return file

  let source
  try {
    source = typeof createImageBitmap === 'function'
      ? await createImageBitmap(file)
      : await loadImageElement(file)
  } catch {
    return file
  }

  const width = source.width
  const height = source.height
  if (!width || !height) return file

  const scale = Math.min(1, maxSide / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return file

  // JPEG has no transparency; paint white behind transparent PNGs.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  source.close?.()

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
  if (!blob) return file
  return new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
}
