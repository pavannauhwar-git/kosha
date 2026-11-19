// supabase-js keeps the session under `sb-<project>-auth-token`. It stays
// there when a token refresh fails for lack of network and is only removed
// when the session is definitely gone (sign-out, revoked or invalid refresh
// token), so its presence means "still signed in, just offline".
export function readStoredSessionUser(storage = globalThis.localStorage) {
  try {
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i)
      if (!key || !key.startsWith('sb-') || !key.endsWith('-auth-token')) continue
      const session = JSON.parse(storage.getItem(key) || 'null')
      if (session?.refresh_token && session?.user?.id) return session.user
    }
  } catch {
    // Storage unavailable or corrupt: treat as signed out.
  }
  return null
}

// The persisted query cache is one blob for the whole device; this records
// whose data it holds so a different account never sees it.
const CACHE_OWNER_KEY = 'kosha-cache-owner'

export function getCacheOwner(storage = globalThis.localStorage) {
  try { return storage.getItem(CACHE_OWNER_KEY) || null } catch { return null }
}

export function setCacheOwner(userId, storage = globalThis.localStorage) {
  try {
    if (userId) storage.setItem(CACHE_OWNER_KEY, userId)
    else storage.removeItem(CACHE_OWNER_KEY)
  } catch {
    // Storage unavailable: the sign-in purge still protects the next user.
  }
}
