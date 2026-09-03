export const MONTH_FILTER_MIN_YEAR = 1900
export const MONTH_FILTER_MAX_YEAR = 2100

export function monthInputFromDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function parseMonthInput(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})$/)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null

  return { year, month }
}

export function formatMonthInputLabel(value) {
  const parsed = parseMonthInput(value)
  if (!parsed) return 'Specific month'

  return new Date(parsed.year, parsed.month - 1, 1).toLocaleString(undefined, {
    month: 'short',
    year: 'numeric',
  })
}

export function parseIsoDateInput(value) {
  const trimmed = String(value || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null

  const [year, month, day] = trimmed.split('-').map(Number)
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null

  const date = new Date(`${trimmed}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  if (date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day) return null

  return trimmed
}

export function formatIsoDateLabel(value) {
  const parsed = parseIsoDateInput(value)
  if (!parsed) return 'Custom range'

  return new Date(`${parsed}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
