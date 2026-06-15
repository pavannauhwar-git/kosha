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

export function downloadCsv(filename, csvContent) {
  // Prepend UTF-8 BOM for better Excel compatibility.
  const blob = new Blob(['\uFEFF', csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
