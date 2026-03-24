function normalizeCell(value) {
  if (value === null || value === undefined) return ''
  return String(value)
}

export function asCsvCell(value) {
  const text = normalizeCell(value)
  const escaped = text.replace(/"/g, '""')
  return `"${escaped}"`
}

export function toCsv(headers, rows) {
  const allRows = [headers, ...rows]
  return allRows.map((row) => row.map(asCsvCell).join(',')).join('\n')
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
