const LOCALE_KEY = 'kosha:locale'
const DEFAULT_LOCALE = 'en-IN'

export const SUPPORTED_LOCALES = [
  { id: 'en-IN', label: 'English (India)' },
  { id: 'hi-IN', label: 'Hindi (India)' },
  { id: 'en-US', label: 'English (US)' },
]

const SUPPORTED_LOCALE_SET = new Set(SUPPORTED_LOCALES.map((item) => item.id))

function safeNavigatorLocale() {
  try {
    return String(navigator?.language || '').trim()
  } catch {
    return ''
  }
}

function normalizeLocale(raw) {
  const locale = String(raw || '').trim()
  if (!locale) return DEFAULT_LOCALE
  if (SUPPORTED_LOCALE_SET.has(locale)) return locale

  const languageOnly = locale.split('-')[0]
  const byLanguage = SUPPORTED_LOCALES.find((item) => item.id.startsWith(`${languageOnly}-`))
  return byLanguage?.id || DEFAULT_LOCALE
}

export function getPreferredLocale() {
  try {
    const stored = localStorage.getItem(LOCALE_KEY)
    if (stored) return normalizeLocale(stored)
  } catch {
    // Ignore localStorage privacy mode failures.
  }

  return normalizeLocale(safeNavigatorLocale())
}

export function setPreferredLocale(nextLocale) {
  const normalized = normalizeLocale(nextLocale)
  try {
    localStorage.setItem(LOCALE_KEY, normalized)
  } catch {
    // Ignore localStorage privacy mode failures.
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('kosha:locale-changed', { detail: { locale: normalized } }))
  }

  return normalized
}

export function getPreferredCurrency() {
  const locale = getPreferredLocale()
  if (locale === 'en-US') return 'USD'
  return 'INR'
}
