import { netCashflow } from './cashflow.js'
import { sanitizeAmountInput } from './validateAmount.js'

function num(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

// A month with no money in or out (a future month, or before you started)
// says nothing about how the year went, so it is left out of month counts.
export function isActiveMonth(row) {
  if (!row) return false
  return num(row.income) !== 0 || num(row.repayments) !== 0 || num(row.expense) !== 0 || num(row.investment) !== 0
}

export function positiveMonthCount(rows) {
  const active = (Array.isArray(rows) ? rows : []).filter(isActiveMonth)
  return {
    positive: active.filter((row) => netCashflow(row) >= 0).length,
    active: active.length,
  }
}

// Outflow as a share of income. Null when there is no income, so the screen
// can show "—" instead of a reassuring 0%.
export function outflowSharePct(outflow, income) {
  const safeIncome = num(income)
  if (safeIncome <= 0) return null
  return Math.round((num(outflow) / safeIncome) * 100)
}

// Spending categories, biggest first. Fewer than `minCategories` returns null:
// with one or two categories the top one is always a big share, which is not
// a warning sign.
export function rankedCategoryShare(byCategory, { minCategories = 3, top = 1 } = {}) {
  const rows = Object.entries(byCategory || {})
    .map(([categoryId, amount]) => [categoryId, num(amount)])
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1])
  if (rows.length < minCategories) return null
  const total = rows.reduce((sum, [, amount]) => sum + amount, 0)
  const topRows = rows.slice(0, top)
  const topAmount = topRows.reduce((sum, [, amount]) => sum + amount, 0)
  return {
    rows,
    total,
    categoryId: topRows[0][0],
    amount: topRows[0][1],
    sharePct: Math.round((topAmount / total) * 100),
  }
}

// `months` is oldest-first, each with an `investment` amount. When the last
// month is still running and has no investment yet, it is not a miss: it is
// left out of the current streak instead of resetting it.
export function investmentStreaks(months, { lastMonthInProgress = false } = {}) {
  const list = Array.isArray(months) ? months : []
  const invested = list.map((m) => num(m?.investment) > 0)
  const pendingLast = lastMonthInProgress && invested.length > 0 && !invested[invested.length - 1]
  const settled = pendingLast ? invested.slice(0, -1) : invested

  let current = 0
  for (let i = settled.length - 1; i >= 0 && settled[i]; i--) current += 1

  let best = 0
  let run = 0
  for (const hit of settled) {
    run = hit ? run + 1 : 0
    if (run > best) best = run
  }
  return { current, best, pendingLast }
}

export function runwayMonths(reserve, monthlyOutflow, multiplier = 1) {
  const burn = num(monthlyOutflow) * num(multiplier)
  if (burn <= 0) return 0
  return Math.max(0, num(reserve)) / burn
}

// Reads what someone typed into an amount box: "1,00,000", "₹ 2,500.50".
export function parseAmountText(text) {
  const clean = sanitizeAmountInput(text)
  if (!clean) return 0
  return num(clean)
}
