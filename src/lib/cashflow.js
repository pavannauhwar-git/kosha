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
