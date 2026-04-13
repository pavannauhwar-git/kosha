function toDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
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

  for (let offset = weeksToShow - 1; offset >= 0; offset -= 1) {
    const weekStart = addDays(currentWeekStart, -offset * 7)
    const weekEnd = addDays(weekStart, 6)
    const countedEnd = offset === 0 ? today : weekEnd
    const daysToCount = Math.max(
      1,
      Math.floor((countedEnd.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000)) + 1
    )

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

  const driftPct = median4w > 0
    ? Math.round(((currentWeek.total - median4w) / median4w) * 100)
    : null

  const wowPct = previousWeek.total > 0
    ? Math.round(((currentWeek.total - previousWeek.total) / previousWeek.total) * 100)
    : null

  let status = 'healthy'
  if (driftPct != null && driftPct > 20) status = 'high'
  else if (driftPct != null && driftPct > 5) status = 'watch'

  const statusLabel = status === 'high'
    ? 'Above baseline'
    : status === 'watch'
      ? 'Slightly high'
      : 'Within baseline'

  const guidance = driftPct == null
    ? 'Build a few active weeks to establish a reliable weekly baseline.'
    : status === 'high'
      ? `This week is ${driftPct}% above your 4-week median. Freeze optional spend to avoid end-of-month pressure.`
      : status === 'watch'
        ? `This week is ${driftPct}% above baseline. Keep the next few days lighter to realign.`
        : `This week is ${Math.abs(driftPct)}% below baseline. Current weekly rhythm is controlled.`

  return {
    hasData: true,
    currentWeekTotal: currentWeek.total,
    median4w,
    driftPct,
    wowPct,
    status,
    statusLabel,
    guidance,
    weeks: weeks.map((row) => ({
      ...row,
      baseline: median4w,
    })),
  }
}
