/**
 * Clamp a date to the last valid day of its month.
 * If a recurring transaction is set to day 31, months with fewer days
 * will be clamped to the last day (e.g., Feb 28/29, Apr 30).
 *
 * @param {Date|string} date — a Date object or ISO string
 * @returns {Date} — clamped Date
 */
export function clampToMonthEnd(date) {
  const d = typeof date === 'string' ? new Date(date) : new Date(date)
  const year = d.getFullYear()
  const month = d.getMonth()
  const day = d.getDate()
  const lastDay = new Date(year, month + 1, 0).getDate()
  if (day > lastDay) {
    d.setDate(lastDay)
  }
  return d
}

/**
 * Get the next occurrence date for a recurring transaction.
 * @param {Date|string} fromDate — the base date
 * @param {'monthly'|'quarterly'|'yearly'} recurrence
 * @returns {Date}
 */
export function getNextRecurrenceDate(fromDate, recurrence) {
  const d = typeof fromDate === 'string' ? new Date(fromDate) : new Date(fromDate)
  const originalDay = d.getDate()

  switch (recurrence) {
    case 'monthly':
      d.setMonth(d.getMonth() + 1)
      break
    case 'quarterly':
      d.setMonth(d.getMonth() + 3)
      break
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1)
      break
    default:
      d.setMonth(d.getMonth() + 1)
  }

  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(originalDay, lastDay))

  return d
}
