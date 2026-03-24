const LOCALE_KEY = 'kosha:locale'
const DEFAULT_LOCALE = 'en-IN'

export const SUPPORTED_LOCALES = [
  { id: 'en-IN', label: 'English (India)' },
]

function normalizeLocale() {
  return DEFAULT_LOCALE
}

export function getPreferredLocale() {
  return normalizeLocale()
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
  return 'INR'
}
