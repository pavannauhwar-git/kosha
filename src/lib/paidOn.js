import { todayStr } from './utils.js'

// The server accepts payments dated up to a year back (catching up on an
// earlier payment) and never later than today.
export const PAID_ON_MAX_DAYS_BACK = 365

function isoDaysBefore(isoDate, days) {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(y, m - 1, d - days, 12)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function earliestPaidOn(today = todayStr()) {
  return isoDaysBefore(today, PAID_ON_MAX_DAYS_BACK)
}

// Returns an error message, or null when the date can be used.
export function paidOnError(value, today = todayStr()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return 'Pick the date you paid.'
  if (value > today) return 'The paid-on date can’t be in the future.'
  if (value < earliestPaidOn(today)) return 'Payments can be dated up to one year back.'
  return null
}
