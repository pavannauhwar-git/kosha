import { captureError } from './errorReporting.js'

// All Kosha-owned device-local storage keys MUST start with this prefix.
// This lets `purgeUserScopedKeys()` clean up everything we wrote without
// touching keys owned by Supabase (e.g. `sb-<ref>-auth-token`), other apps,
// or the PWA service worker.
const KOSHA_USER_KEY_PREFIX = 'kosha:'

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
  } catch (err) {
    if (err?.name === 'QuotaExceededError') {
      try { captureError(err, { context: 'safeStorage.write', tags: { key: String(key).slice(0, 60) } }) } catch { /* never throw from storage */ }
    }
    return false
  }
}

function removeLocalStorage(key) {
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

// Remove every device-local key we own. Called on sign-out so the next person
// to sign in on the same device does not see the previous user's review
// state, drafts, or filters. Returns the number of keys removed.
//
// IMPORTANT: this only removes keys with the `kosha:` prefix. It will NEVER
// touch Supabase's auth-token storage (which uses an `sb-…` prefix) — that
// belongs to the auth library and `supabase.auth.signOut()` handles it.
export function purgeUserScopedKeys() {
  const storage = getLocalStorage()
  if (!storage) return 0
  try {
    try { localStorage.removeItem('kosha:avatar-urls') } catch {}
    const keysToRemove = []
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i)
      if (key && key.startsWith(KOSHA_USER_KEY_PREFIX)) {
        keysToRemove.push(key)
      }
    }
    for (const key of keysToRemove) {
      try { storage.removeItem(key) } catch { /* keep going */ }
    }
    return keysToRemove.length
  } catch {
    return 0
  }
}

// Delete the Workbox runtime caches owned by the service worker. Called on
// sign-out so any cached Supabase REST response from the previous user is
// gone before the next user starts a session.
//
// This is a best-effort cleanup: if `caches` is unavailable (Safari private
// mode, no SW installed yet) it resolves to 0 without throwing.
export async function purgeServiceWorkerCaches() {
  if (typeof caches === 'undefined') return 0
  // These cache names match `vite.config.js` runtimeCaching entries plus the
  // workbox auto-generated names. We delete by exact name where possible and
  // sweep anything starting with `supabase-` or `kosha-` as a safety net.
  const explicit = ['supabase-data']
  try {
    const names = await caches.keys()
    const toDelete = new Set(explicit)
    for (const name of names) {
      if (name.startsWith('supabase-') || name.startsWith('kosha-')) {
        toDelete.add(name)
      }
    }
    let count = 0
    for (const name of toDelete) {
      try {
        const ok = await caches.delete(name)
        if (ok) count += 1
      } catch { /* keep going */ }
    }
    return count
  } catch {
    return 0
  }
}
