// Query-string keys whose values are secrets.
const SENSITIVE_PARAMS = new Set([
  'token', 'access_token', 'refresh_token', 'invite', 'splittoken', 'split_token',
  'code', 'state', 'id_token', 'apikey',
])

// Path segments that are themselves the secret (e.g. `/join/<token>`).
const SENSITIVE_PATH_PREFIXES = [
  '/join/',
  '/splitwise/join/',
]

// Supabase API calls carry the user's search text and filters in the query
// string, so their whole query string is dropped.
const API_PATH_RE = /\/(rest|functions|auth|storage)\/v1\//

const PLACEHOLDER_BASE = 'http://kosha.local'

// Take a path or path+search string and return a copy with token-bearing
// query params and path segments replaced by `<redacted>`. Always returns a
// string; never throws.
export function sanitizeRoute(rawRoute) {
  if (typeof rawRoute !== 'string' || rawRoute.length === 0) return rawRoute || ''

  let pathname = rawRoute.split('#')[0]
  let search = ''
  const queryIndex = pathname.indexOf('?')
  if (queryIndex >= 0) {
    search = pathname.slice(queryIndex)
    pathname = pathname.slice(0, queryIndex)
  }

  for (const prefix of SENSITIVE_PATH_PREFIXES) {
    if (pathname.startsWith(prefix)) {
      pathname = `${prefix}<redacted>`
      break
    }
  }

  if (search) {
    try {
      const params = new URLSearchParams(search.slice(1))
      let changed = false
      for (const key of Array.from(params.keys())) {
        if (SENSITIVE_PARAMS.has(key.toLowerCase())) {
          params.set(key, '<redacted>')
          changed = true
        }
      }
      if (changed) {
        const next = params.toString()
        search = next ? `?${next}` : ''
      }
    } catch {
      search = '?<redacted>'
    }
  }

  return `${pathname}${search}`
}

// Absolute or relative URL. Drops the hash, redacts token path segments and
// sensitive params, and drops the query string of Supabase API calls.
export function sanitizeUrl(rawUrl) {
  if (typeof rawUrl !== 'string') return rawUrl
  const isRelative = !/^https?:\/\//i.test(rawUrl)
  try {
    const url = new URL(rawUrl, `${PLACEHOLDER_BASE}/`)
    const search = API_PATH_RE.test(url.pathname) ? '' : url.search
    const route = sanitizeRoute(`${url.pathname}${search}`)
    return isRelative ? route : `${url.origin}${route}`
  } catch {
    return String(rawUrl).split(/[?#]/)[0]
  }
}

// Sanitize every absolute URL inside a free-text string (e.g. a span
// description like "GET https://….supabase.co/rest/v1/transactions?…").
export function sanitizeUrlsInText(text) {
  if (typeof text !== 'string') return text
  return text.replace(/https?:\/\/[^\s"'<>]+/gi, (match) => sanitizeUrl(match))
}
