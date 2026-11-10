import { dayKey as toDateKey } from './dayKey.js'

// Fixed outgoings that land on one day a month. Left out of weekly drift so a
// rent or EMI week doesn't read as overspending.
export const FIXED_SPEND_CATEGORIES = new Set(['rent', 'emi', 'bills', 'insurance', 'loans', 'credit_card', 'taxes'])

export function countsTowardWeeklyDrift(row) {
  if (!row || row.is_repayment) return false
  return !FIXED_SPEND_CATEGORIES.has(String(row.category || ''))
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function startOfWeekMonday(date) {
  const start = new Date(date)
  const day = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - day)
  start.setHours(12, 0, 0, 0)
  return start
}

function formatShortDate(date) {
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  if (!sorted.length) return 0
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2
  return sorted[mid]
}

export function computeWeeklySpendDrift(dailyExpenseTotals, now, options = {}) {
  const safeTotals = dailyExpenseTotals || {}
  const refDate = now instanceof Date ? now : new Date()
  const today = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 12)
  const weeksToShow = Math.max(4, Number(options.weeksToShow) || 8)
  const baselineWeeks = Math.max(2, Number(options.baselineWeeks) || 4)
  const currentWeekStart = startOfWeekMonday(today)
  const weeks = []
  let currentWeekDays = 7

  for (let offset = weeksToShow - 1; offset >= 0; offset -= 1) {
    const weekStart = addDays(currentWeekStart, -offset * 7)
    const weekEnd = addDays(weekStart, 6)
    const countedEnd = offset === 0 ? today : weekEnd
    const daysToCount = Math.max(
      1,
      Math.floor((countedEnd.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000)) + 1
    )
    if (offset === 0) currentWeekDays = Math.min(7, daysToCount)

    let total = 0
    for (let dayIndex = 0; dayIndex < daysToCount; dayIndex += 1) {
      const date = addDays(weekStart, dayIndex)
      total += Number(safeTotals[toDateKey(date)] || 0)
    }

    weeks.push({
      label: formatShortDate(weekStart),
      range: `${formatShortDate(weekStart)} - ${formatShortDate(countedEnd)}`,
      total: Math.round(total),
      isCurrent: offset === 0,
    })
  }

  const hasData = weeks.some((row) => row.total > 0)
  if (!hasData) return { hasData: false, weeks }

  const currentWeek = weeks[weeks.length - 1] || { total: 0 }
  const previousWeek = weeks[weeks.length - 2] || { total: 0 }

  const baselineWindow = weeks
    .slice(-(baselineWeeks + 1), -1)
    .map((row) => row.total)
    .filter((value) => value > 0)

  const median4w = Math.round(median(baselineWindow))
  // Compare the days so far with the same share of a normal week, so a
  // Monday isn't measured against seven days of spending.
  const expectedSoFar = Math.round((median4w * currentWeekDays) / 7)
  const expectedLastWeekSoFar = Math.round((previousWeek.total * currentWeekDays) / 7)

  const driftPct = expectedSoFar > 0
    ? Math.round(((currentWeek.total - expectedSoFar) / expectedSoFar) * 100)
    : null

  const wowPct = expectedLastWeekSoFar > 0
    ? Math.round(((currentWeek.total - expectedLastWeekSoFar) / expectedLastWeekSoFar) * 100)
    : null

  let status = 'healthy'
  if (driftPct != null && driftPct > 20) status = 'high'
  else if (driftPct != null && driftPct > 5) status = 'watch'

  const statusLabel = status === 'high'
    ? 'Above baseline'
    : status === 'watch'
      ? 'Slightly high'
      : 'Within baseline'

  const soFar = currentWeekDays < 7 ? ' so far' : ''
  const guidance = driftPct == null
    ? 'Build a few active weeks to establish a reliable weekly baseline.'
    : status === 'high'
      ? `This week${soFar} is ${driftPct}% above your usual pace. Hold back on optional spend to avoid end-of-month pressure.`
      : status === 'watch'
        ? `This week${soFar} is ${driftPct}% above your usual pace. Keep the next few days lighter to realign.`
        : driftPct > 0
          ? `This week${soFar} is ${driftPct}% above your usual pace, which is within your normal range.`
          : driftPct === 0
            ? `This week${soFar} is right on your usual pace.`
            : `This week${soFar} is ${Math.abs(driftPct)}% below your usual pace.`

  return {
    hasData: true,
    currentWeekTotal: currentWeek.total,
    currentWeekDays,
    median4w,
    expectedSoFar,
    driftPct,
    wowPct,
    status,
    statusLabel,
    guidance,
    weeks: weeks.map((row) => ({
      ...row,
      baseline: row.isCurrent ? expectedSoFar : median4w,
    })),
  }
}
