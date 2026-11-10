import { createClient } from '@supabase/supabase-js'

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
  try {
    return await fetch(requestUrl, options)
  } catch (err) {
    const isLoadFailed = err instanceof TypeError && String(err.message).toLowerCase().includes('load failed')
    if (!isLoadFailed) throw err
    const method = resolveMethod(requestUrl, options)
    if (!SAFE_METHODS.has(method)) {
      console.warn(`[Kosha] Safari stale-connection error on a ${method} request — not retrying to avoid duplicate writes.`, requestUrl)
      throw err
    }
    console.warn('[Kosha] Intercepted Safari stale HTTP/2 connection error on a safe request. Retrying fetch...', requestUrl)
    return await fetch(requestUrl, options)
  }
}

export const supabase = createClient(url ?? '', key ?? '', {
  global: {
    fetch: customFetch,
  },
})
