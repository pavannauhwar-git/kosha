import { getPreferredCurrency, getPreferredLocale } from './locale.js'

const _locale = getPreferredLocale()
export { round2 } from './paise.js'

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
  if (n === null || n === undefined || !Number.isFinite(n)) return '−'
  const abs = Math.abs(n)
  if (compact) {
    const sign = n < 0 ? '−' : ''
    if (abs >= 1_00_00_000) return `${sign}₹\u202F${(abs / 1_00_00_000).toFixed(2)}Cr`
    if (abs >= 1_00_000) return `${sign}₹\u202F${(abs / 1_00_000).toFixed(2)}L`
    if (abs >= 1_000) return `${sign}₹\u202F${(abs / 1_000).toFixed(1)}K`
  }
  return _currencyFmt.format(n).replace('-', '−').replace('₹', '₹\u202F')
}

// Splits a currency amount into rupee and paise parts using Intl
// .formatToParts so the result is locale-correct (any currency, not just INR).
//   splitFmtAmount(12345.67) → { main: '₹\u202F12,345', decimal: '.67', totalLength: 12 }
//   splitFmtAmount(null)     → { main: '—',              decimal: '',     totalLength: 1  }
export function splitFmtAmount(n) {
  if (n === null || n === undefined || !Number.isFinite(n)) {
    return { main: '—', decimal: '', totalLength: 1 }
  }
  const parts = _currencyFmt.formatToParts(n)
  const before = []
  const after = []
  let crossed = false
  for (const p of parts) {
    if (p.type === 'decimal') {
      crossed = true
      after.push(p.value)
      continue
    }
    if (crossed) after.push(p.value)
    else before.push(p.value)
  }
  const main = before.join('').replace('-', '−').replace('₹', '₹\u202F')
  const decimal = after.join('')
  return { main, decimal, totalLength: (main + decimal).length }
}

export function fmtFull(n) {
  const safe = Number.isFinite(n) ? n : 0
  return _currencyFmt.format(safe)
}

function safeParseDate(dateStr) {
  if (!dateStr) return null
  const [y, m, d] = String(dateStr).split('-').map(Number)
  if (y && m && d) return new Date(y, m - 1, d)
  const parsed = new Date(dateStr)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function fmtDate(dateStr) {
  const d = safeParseDate(dateStr)
  if (!d) return ''
  return _dateFmt.format(d)
}

export function fmtFrequency(freq) {
  if (!freq) return ''
  const f = String(freq).toLowerCase()
  if (f === 'monthly') return 'Monthly'
  if (f === 'quarterly') return 'Quarterly'
  if (f === 'yearly') return 'Yearly'
  if (f === 'weekly') return 'Weekly'
  if (f === 'daily') return 'Daily'
  return `Every ${freq}`
}

export function todayStr() {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const _monthYearFmt = new Intl.DateTimeFormat(_locale, { month: 'long', year: 'numeric' })

export function monthStr(date = new Date()) {
  return _monthYearFmt.format(date)
}

export function dateLabel(dateStr) {
  const d = safeParseDate(dateStr)
  if (!d) return ''

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yest = new Date(today); yest.setDate(today.getDate() - 1)
  const dLocal = new Date(d); dLocal.setHours(0, 0, 0, 0)

  if (dLocal.getTime() === today.getTime()) return 'Today'
  if (dLocal.getTime() === yest.getTime()) return 'Yesterday'
  return _dateLabelFmt.format(d)
}

export { groupByDate } from './dayKey.js'

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
  if (!earned || earned <= 0) return 0
  return Math.max(0, Math.min(100, Math.round(((earned - spent) / earned) * 100)))
}

// ── Bills ─────────────────────────────────────────────────────────────────
export function daysUntil(dateStr) {
  const d = safeParseDate(dateStr)
  if (!d) return NaN
  const due = new Date(d)
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
  return 'bg-repay-bg text-repay-text'
}