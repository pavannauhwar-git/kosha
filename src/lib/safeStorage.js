function getLocalStorage() {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage || null
  } catch {
    return null
  }
}

export function readLocalStorage(key, fallback = null) {
  const storage = getLocalStorage()
  if (!storage) return fallback
  try {
    const value = storage.getItem(key)
    return value == null ? fallback : value
  } catch {
    return fallback
  }
}

export function writeLocalStorage(key, value) {
  const storage = getLocalStorage()
  if (!storage) return false
  try {
    storage.setItem(key, String(value))
    return true
  } catch {
    return false
  }
}

export function removeLocalStorage(key) {
  const storage = getLocalStorage()
  if (!storage) return false
  try {
    storage.removeItem(key)
    return true
  } catch {
    return false
  }
}

export function readLocalJson(key, fallback = null) {
  const raw = readLocalStorage(key, null)
  if (raw == null) return fallback
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function writeLocalJson(key, value) {
  try {
    return writeLocalStorage(key, JSON.stringify(value))
  } catch {
    return false
  }
}
