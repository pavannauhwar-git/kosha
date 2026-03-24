import { getPreferredCurrency, getPreferredLocale } from './locale'

// ── Number formatting ─────────────────────────────────────────────────────
export function fmt(n, compact = false) {
  if (n === null || n === undefined) return '—'
  const locale = getPreferredLocale()
  const currency = getPreferredCurrency()
  const abs = Math.abs(n)
  if (compact) {
    if (abs >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`
    if (abs >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`
  }
  return new Intl.NumberFormat(locale, {
    style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n)
}

export function fmtFull(n) {
  const locale = getPreferredLocale()
  const currency = getPreferredCurrency()
  return new Intl.NumberFormat(locale, {
    style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n ?? 0)
}

// ── Date helpers ──────────────────────────────────────────────────────────
export function fmtDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString(getPreferredLocale(), {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

export function monthStr(date = new Date()) {
  return date.toLocaleDateString(getPreferredLocale(), { month: 'long', year: 'numeric' })
}

export function dateLabel(dateStr) {
  const d       = new Date(dateStr)
  const today   = new Date(); today.setHours(0,0,0,0)
  const yest    = new Date(today); yest.setDate(today.getDate() - 1)
  const dLocal  = new Date(d); dLocal.setHours(0,0,0,0)
  if (dLocal.getTime() === today.getTime())  return 'Today'
  if (dLocal.getTime() === yest.getTime())   return 'Yesterday'
  return d.toLocaleDateString(getPreferredLocale(), { weekday:'short', day:'numeric', month:'short' })
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

// ── Savings rate ──────────────────────────────────────────────────────────
export function savingsRate(earned, spent) {
  if (!earned || earned === 0) return 0
  return Math.max(0, Math.min(100, Math.round(((earned - spent) / earned) * 100)))
}

// ── Bills ─────────────────────────────────────────────────────────────────
export function daysUntil(dateStr) {
  const due   = new Date(dateStr); due.setHours(0,0,0,0)
  const today = new Date();        today.setHours(0,0,0,0)
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