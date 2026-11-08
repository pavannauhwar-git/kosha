function parseLocalDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`)
  return Number.isNaN(d.getTime()) ? null : d
}

function formatLocalDate(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function recurrenceStepMonths(recurrence) {
  if (recurrence === 'monthly') return 1
  if (recurrence === 'quarterly') return 3
  if (recurrence === 'yearly') return 12
  return null
}

export function addMonthsClamped(dateStr, months) {
  const d = parseLocalDate(dateStr)
  if (!d) return null
  const origDay = d.getDate()
  const next = new Date(d.getFullYear(), d.getMonth() + months, 1)
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
  next.setDate(Math.min(origDay, lastDay))
  return formatLocalDate(next)
}

export function nextRecurringDate(dateStr, recurrence) {
  const step = recurrenceStepMonths(recurrence)
  if (!dateStr || !step) return null
  return addMonthsClamped(dateStr, step)
}

export function nextRecurringDateAfter(dateStr, recurrence, todayStr) {
  const step = recurrenceStepMonths(recurrence)
  if (!dateStr || !step || !todayStr) return null
  let k = step
  let candidate = addMonthsClamped(dateStr, k)
  let guard = 0
  while (candidate && candidate <= todayStr && guard < 1200) {
    k += step
    candidate = addMonthsClamped(dateStr, k)
    guard += 1
  }
  return candidate
}
