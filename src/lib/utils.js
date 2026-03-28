import { getPreferredCurrency, getPreferredLocale } from './locale'

const _locale = getPreferredLocale()
const _currency = getPreferredCurrency()

const _currencyFmt = new Intl.NumberFormat(_locale, {
  style: 'currency', currency: _currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
})

const _dateFmt = new Intl.DateTimeFormat(_locale, {
  day: 'numeric', month: 'short', year: 'numeric',
})

const _dateLabelFmt = new Intl.DateTimeFormat(_locale, {
  weekday: 'short', day: 'numeric', month: 'short',
})

export function fmt(n, compact = false) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '-'
  const abs = Math.abs(n)
  if (compact) {
    const sign = n < 0 ? '-' : ''
    if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(1)}L`
    if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)}K`
  }
  return _currencyFmt.format(n)
}

export function fmtFull(n) {
  const safe = Number.isFinite(n) ? n : 0
  return _currencyFmt.format(safe)
}

export function fmtDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  return _dateFmt.format(d)
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

const _monthYearFmt = new Intl.DateTimeFormat(_locale, { month: 'long', year: 'numeric' })

export function monthStr(date = new Date()) {
  return _monthYearFmt.format(date)
}

export function dateLabel(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  const today    = new Date(); today.setHours(0,0,0,0)
  const yest     = new Date(today); yest.setDate(today.getDate() - 1)
  const dLocal   = new Date(d); dLocal.setHours(0,0,0,0)
  if (dLocal.getTime() === today.getTime())  return 'Today'
  if (dLocal.getTime() === yest.getTime())   return 'Yesterday'
  return _dateLabelFmt.format(d)
}

export function groupByDate(transactions) {
  const groups = {}
  for (const t of transactions) {
    const key = t.date
    if (!groups[key]) groups[key] = []
    groups[key].push(t)
  }
  return Object.entries(groups).sort(([a],[b]) => b.localeCompare(a))
}

// ── Transaction helpers ───────────────────────────────────────────────────
export function amountPrefix(type) {
  if (type === 'expense')    return '-'
  if (type === 'investment') return '↗\u202F'
  return '+'
}

export function amountClass(type, isRepayment = false) {
  if (type === 'expense')    return 'amt-expense'
  if (type === 'investment') return 'amt-invest'
  if (isRepayment)           return 'amt-repay'
  return 'amt-income'
}

export function stripClass(type, isRepayment = false) {
  if (type === 'expense')    return 'strip-expense'
  if (type === 'investment') return 'strip-invest'
  if (isRepayment)           return 'strip-repay'
  return 'strip-income'
}

export function chipClass(type, isRepayment = false) {
  if (type === 'expense')    return 'chip-expense'
  if (type === 'investment') return 'chip-invest'
  if (isRepayment)           return 'chip-repay'
  return 'chip-income'
}

// ── Surplus rate ──────────────────────────────────────────────────────────
export function surplusRate(earned, spent, invested = 0) {
  if (!earned || earned === 0) return 0
  return Math.max(0, Math.min(100, Math.round(((earned - spent - invested) / earned) * 100)))
}

// ── Bills ─────────────────────────────────────────────────────────────────
export function daysUntil(dateStr) {
  if (!dateStr) return NaN
  const due = new Date(dateStr)
  if (Number.isNaN(due.getTime())) return NaN
  due.setHours(0,0,0,0)
  const today = new Date(); today.setHours(0,0,0,0)
  return Math.round((due - today) / (1000 * 60 * 60 * 24))
}

export function dueLabel(days) {
  if (days < 0)   return `Overdue ${Math.abs(days)}d`
  if (days === 0) return 'Due today'
  return `Due in ${days}d`
}

export function dueShadow(days) {
  if (days < 0)   return 'card-urgent'
  if (days === 0) return 'card-warn'
  if (days <= 3)  return 'card-warn'
  return 'card'
}

export function dueChipClass(days) {
  if (days < 0)   return 'bg-expense-bg text-expense-text'
  if (days === 0) return 'bg-warning-bg text-warning-text'
  if (days <= 3)  return 'bg-warning-bg text-warning-text'
  return 'bg-brand-container text-brand-on'
}