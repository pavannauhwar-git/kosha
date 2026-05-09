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
const customFetch = async (requestUrl, options) => {
  try {
    return await fetch(requestUrl, options)
  } catch (err) {
    if (err instanceof TypeError && String(err.message).toLowerCase().includes('load failed')) {
      console.warn('[Kosha] Intercepted Safari stale HTTP/2 connection error. Retrying fetch...', requestUrl)
      return await fetch(requestUrl, options)
    }
    throw err
  }
}

export const supabase = createClient(url ?? '', key ?? '', {
  global: {
    fetch: customFetch,
  },
})
