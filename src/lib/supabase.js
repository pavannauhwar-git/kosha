import { createClient } from '@supabase/supabase-js'
import { getActiveWalletUserId } from './walletStore'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  console.warn(
    '[Kosha] Missing Supabase env vars.\n' +
    'Copy .env.example -> .env and fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  )
  if (import.meta.env.DEV) {
    throw new Error('[Kosha] Cannot start without VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cross-user safety via URL-hash cache-namespacing
// ─────────────────────────────────────────────────────────────────────────────
// Workbox's `StaleWhileRevalidate` rule in `vite.config.js` keys cached
// entries by `request.url`. Without this layer, any Supabase query that
// relies on RLS rather than an explicit `user_id` filter (Splitwise group
// listings, primarily) would share a cache entry across users on the same
// device, leaking data after a sign-out → sign-in.
//
// To make leaks mechanically impossible, we inject the active wallet user
// id into the URL fragment (`#kosha-uid=<id>`) before calling fetch. The
// fragment IS part of the URL object Workbox sees as `request.url`, so the
// cache key naturally namespaces per user. The fragment is NOT sent to the
// server (HTTP strips it), so Supabase receives the exact same URL it
// always has.
//
// Falls back to `anon` when no wallet is known (boot window). Any request
// made then will fail at the server with 401 anyway, so the `anon`
// namespace never contains useful user data.
function withUserHash(input) {
  let uid
  try {
    uid = getActiveWalletUserId() || 'anon'
  } catch {
    uid = 'anon'
  }
  const fragment = `kosha-uid=${encodeURIComponent(uid)}`

  try {
    if (typeof input === 'string') {
      const u = new URL(input)
      u.hash = fragment
      return u.toString()
    }
    if (input instanceof URL) {
      const u = new URL(input.toString())
      u.hash = fragment
      return u.toString()
    }
    if (input && typeof input === 'object' && typeof input.url === 'string') {
      // Request object — reconstruct preserving init properties.
      const u = new URL(input.url)
      u.hash = fragment
      return new Request(u.toString(), input)
    }
  } catch (err) {
    // Malformed URL or unsupported input shape — fall through to original.
    console.warn('[Kosha] withUserHash: could not stamp cache namespace, falling back to original input.', err)
  }
  return input
}

// Safari on iOS has a known bug where it attempts to reuse stale HTTP/2 connections.
// When the server has already closed the connection, Safari's `fetch` instantly throws
// a "TypeError: Load failed". This wrapper catches that specific error and retries the
// request once on a fresh connection, making the retry completely invisible to the user.
//
// IMPORTANT: only retry idempotent methods (GET / HEAD). Retrying POST / PATCH / PUT /
// DELETE on this error class can duplicate non-idempotent writes — for example, a
// transaction insert, a `mark_liability_paid` RPC, or a loan repayment. The retry only
// runs for read-shaped requests; write-shaped requests propagate the error so the
// caller (React Query mutation) can decide how to handle it.
const SAFE_METHODS = new Set(['GET', 'HEAD'])

const resolveMethod = (requestUrl, options) => {
  const fromOptions = options && typeof options.method === 'string' ? options.method : null
  if (fromOptions) return fromOptions.toUpperCase()
  if (requestUrl && typeof requestUrl === 'object' && typeof requestUrl.method === 'string') {
    return requestUrl.method.toUpperCase()
  }
  return 'GET'
}

const customFetch = async (requestUrl, options) => {
  const stampedInput = withUserHash(requestUrl)
  try {
    return await fetch(stampedInput, options)
  } catch (err) {
    const isLoadFailed = err instanceof TypeError && String(err.message).toLowerCase().includes('load failed')
    if (!isLoadFailed) throw err
    const method = resolveMethod(requestUrl, options)
    if (!SAFE_METHODS.has(method)) {
      console.warn(`[Kosha] Safari stale-connection error on a ${method} request — not retrying to avoid duplicate writes.`, requestUrl)
      throw err
    }
    console.warn('[Kosha] Intercepted Safari stale HTTP/2 connection error on a safe request. Retrying fetch...', requestUrl)
    return await fetch(stampedInput, options)
  }
}

export const supabase = createClient(url ?? '', key ?? '', {
  global: {
    fetch: customFetch,
  },
})
