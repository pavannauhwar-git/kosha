import { round2 } from './paise.js'

// Savings rate = (income − expenses) ÷ income. Investments count as saved;
// repayments are not income. Returns null when there is no income.
export function savingsRate(income, expense) {
  const inc = Number(income) || 0
  if (inc <= 0) return null
  return Math.min(100, Math.round(((inc - (Number(expense) || 0)) / inc) * 100))
}

export function formatSavingsRate(rate) {
  if (rate == null) return '—'
  if (rate < 0) return 'Overspent'
  return `${rate}%`
}

export function averageSavingsRate(monthlyRows) {
  const rates = (Array.isArray(monthlyRows) ? monthlyRows : [])
    .map((row) => savingsRate(row?.income, row?.expense))
    .filter((rate) => rate != null)
  if (!rates.length) return null
  return Math.round(rates.reduce((sum, rate) => sum + rate, 0) / rates.length)
}

// Net = income + repayments received − expenses − investments.
export function netCashflow({ income = 0, repayments = 0, expense = 0, investment = 0 } = {}) {
  return round2((Number(income) || 0) + (Number(repayments) || 0) - (Number(expense) || 0) - (Number(investment) || 0))
}

export function endOfMonthISO(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Unpaid bills that are overdue or due on/before the last day of `now`'s month.
export function billsDueByMonthEnd(bills, now = new Date()) {
  const cutoff = endOfMonthISO(now)
  return (Array.isArray(bills) ? bills : []).filter(
    (bill) => bill && !bill.paid && bill.due_date && String(bill.due_date).slice(0, 10) <= cutoff
  )
}

export function sumAmounts(rows) {
  return round2((Array.isArray(rows) ? rows : []).reduce((sum, row) => sum + (Number(row?.amount) || 0), 0))
}

export const FIXED_EXPENSE_CATEGORIES = new Set([
  'rent', 'emi', 'insurance', 'bills', 'subscription', 'utilities',
  'internet', 'mobile_recharge', 'taxes', 'loans', 'credit_card', 'education',
])

export const PROJECTION_MIN_DAYS = 7

export function projectMonthClose({
  income = 0,
  repayments = 0,
  expense = 0,
  investment = 0,
  byCategory = {},
  unpaidBillsDue = 0,
  daysElapsed = 1,
  daysInMonth = 30,
} = {}) {
  const days = Math.max(1, Number(daysInMonth) || 1)
  const elapsed = Math.min(days, Math.max(1, Number(daysElapsed) || 1))
  let fixedSpent = 0
  for (const [categoryId, amount] of Object.entries(byCategory || {})) {
    if (FIXED_EXPENSE_CATEGORIES.has(categoryId)) fixedSpent += Number(amount) || 0
  }
  const variableSpent = Math.max(0, (Number(expense) || 0) - fixedSpent)
  const projectedVariable = (variableSpent / elapsed) * days
  const projectedOutflow = round2(fixedSpent + (Number(investment) || 0) + projectedVariable + (Number(unpaidBillsDue) || 0))
  const inflow = round2((Number(income) || 0) + (Number(repayments) || 0))
  return {
    inflow,
    fixedSpent: round2(fixedSpent),
    variableSpent: round2(variableSpent),
    projectedOutflow,
    netAtClose: round2(inflow - projectedOutflow),
    early: elapsed < PROJECTION_MIN_DAYS,
  }
}
