function normalizeCell(value) {
  if (value === null || value === undefined) return ''
  return String(value)
}

function asCsvCell(value) {
  let text = normalizeCell(value)
  if (/^[=+\-@\t\r]/.test(text)) {
    text = "'" + text
  }
  const escaped = text.replace(/"/g, '""')
  return `"${escaped}"`
}

export function toCsv(headers, rows) {
  const allRows = [headers, ...rows]
  // RFC 4180 §2.1 — rows are CRLF-terminated for maximum spreadsheet compat.
  return allRows.map((row) => row.map(asCsvCell).join(',')).join('\r\n')
}

function isIos() {
  if (typeof navigator === 'undefined') return false
  return /iP(hone|ad|od)/.test(navigator.userAgent || '')
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

// Resolves to 'shared', 'cancelled' or 'downloaded'; never rejects.
export async function downloadCsv(filename, csvContent) {
  // Prepend UTF-8 BOM for better Excel compatibility.
  const blob = new Blob(['\uFEFF', csvContent], { type: 'text/csv;charset=utf-8;' })

  // iOS home-screen apps ignore the download attribute; the share sheet
  // offers "Save to Files". It needs a recent tap, so fall back if refused.
  if (isIos() && typeof navigator.share === 'function' && typeof File !== 'undefined') {
    const file = new File([blob], filename, { type: 'text/csv' })
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: filename })
        return 'shared'
      } catch (err) {
        if (err?.name === 'AbortError') return 'cancelled'
      }
    }
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Some browsers read the blob after click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
  return 'downloaded'
}
