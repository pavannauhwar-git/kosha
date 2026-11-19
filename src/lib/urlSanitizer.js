// Query-string keys whose values are safe to report. Every other value is
// redacted: search text (`q`), repayment names and amounts, invite tokens and
// sign-in codes all travel in app URLs.
const SAFE_PARAMS = new Set([
  'focus', 'tab', 'view', 'type', 'range', 'quality', 'payment', 'month', 'filter', 'day',
  'category', 'reset', 'mode', 'next', 'source', 'repaymenttab', 'repaymenttype',
  'linked_bill', 'linked_loan', 'linked_split_expense', 'linked_split_settlement',
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

// Take a path or path+search string and return a copy with token path segments
// and every query value outside SAFE_PARAMS replaced by `<redacted>`. Always
// returns a string; never throws.
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
        if (!SAFE_PARAMS.has(key.toLowerCase())) {
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
// query values, and drops the query string of Supabase API calls.
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
