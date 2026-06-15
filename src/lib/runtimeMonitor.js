import { captureError } from './errorReporting.js'

const STORE_KEY = 'kosha:runtime-monitor-v1'
const MAX_EVENTS = 40

// Query-string keys whose values are secrets and must never be persisted to
// sessionStorage / sent to Sentry as part of route history. Matches the
// list in errorReporting.js — keep them in sync.
const SENSITIVE_PARAMS = new Set([
  'token', 'access_token', 'refresh_token', 'invite', 'splittoken', 'split_token',
  'code', 'state', 'id_token', 'apikey',
])

// Path segments that are themselves the secret (e.g. `/join/<token>`,
// `/splitwise/join/<token>`). Anything after these prefixes is replaced
// with `<redacted>` so we don't leak the invite token through diagnostics.
const SENSITIVE_PATH_PREFIXES = [
  '/join/',
  '/splitwise/join/',
]

let started = false
let _memoryStore = null

function nowIso() {
  return new Date().toISOString()
}

// Take a path or path+search string and return a copy with token-bearing
// query params and path segments replaced by `<redacted>`. Always returns a
// string; never throws. Safe to call on partial input.
function sanitizeRoute(rawRoute) {
  if (typeof rawRoute !== 'string' || rawRoute.length === 0) return rawRoute || ''

  let pathname = rawRoute
  let search = ''
  const queryIndex = rawRoute.indexOf('?')
  if (queryIndex >= 0) {
    pathname = rawRoute.slice(0, queryIndex)
    search = rawRoute.slice(queryIndex)
  }

  for (const prefix of SENSITIVE_PATH_PREFIXES) {
    if (pathname.startsWith(prefix)) {
      pathname = `${prefix}<redacted>`
      break
    }
  }

  if (search) {
    try {
      const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
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
      // Malformed query string — drop it entirely rather than risk leaking.
      search = '?<redacted>'
    }
  }

  return `${pathname}${search}`
}

function currentSanitizedRoute() {
  if (typeof window === 'undefined' || !window.location) return ''
  return sanitizeRoute(`${window.location.pathname}${window.location.search || ''}`)
}

function readStore() {
  if (_memoryStore) return _memoryStore
  try {
    const raw = sessionStorage.getItem(STORE_KEY)
    if (!raw) {
      _memoryStore = { events: [], routes: [] }
      return _memoryStore
    }
    _memoryStore = JSON.parse(raw)
    return _memoryStore
  } catch {
    _memoryStore = { events: [], routes: [] }
    return _memoryStore
  }
}

let _writeTimeout = null
function writeStore(next) {
  _memoryStore = next
  if (_writeTimeout) return
  _writeTimeout = setTimeout(() => {
    _writeTimeout = null
    try {
      sessionStorage.setItem(STORE_KEY, JSON.stringify(_memoryStore))
    } catch { }
  }, 1000)
}

function trim(list, max = MAX_EVENTS) {
  if (!Array.isArray(list)) return []
  return list.slice(Math.max(0, list.length - max))
}

const SENSITIVE_DETAIL_RE = /(bearer\s+[a-z0-9._-]+|eyJ[a-z0-9._-]{10,}|access_token=[^&\s]+|refresh_token=[^&\s]+|invite=[^&\s]+|(?:^|[?&])token=[^&\s]+|apikey=[^&\s]+)/gi

function sanitizeDetail(value) {
  return String(value || '').replace(SENSITIVE_DETAIL_RE, '<redacted>').slice(0, 800)
}

function pushEvent(type, detail) {
  const store = readStore()
  const events = trim([
    ...store.events,
    {
      ts: nowIso(),
      type,
      detail: sanitizeDetail(detail),
      route: currentSanitizedRoute(),
    },
  ])
  writeStore({ ...store, events })
}

export function recordRuntimeRoute(pathname) {
  if (!pathname) return
  const sanitized = sanitizeRoute(String(pathname))
  const store = readStore()
  const last = store.routes[store.routes.length - 1]
  if (last?.path === sanitized) return

  const routes = trim([
    ...store.routes,
    { ts: nowIso(), path: sanitized.slice(0, 220) },
  ])
  writeStore({ ...store, routes })
}

export function startRuntimeMonitor() {
  if (started || typeof window === 'undefined') return
  started = true

  window.addEventListener('error', (event) => {
    const message = event?.message || event?.error?.message || 'Unknown script error'
    pushEvent('window.error', message)
    captureError(event?.error || new Error(message), { context: 'window.error' })
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason
    const message = reason?.message || reason || 'Unhandled promise rejection'
    pushEvent('window.unhandledrejection', message)
    captureError(reason instanceof Error ? reason : new Error(String(message)), { context: 'unhandledrejection' })
  })
}

export function getRuntimeDiagnostics() {
  const store = readStore()
  return {
    capturedAt: nowIso(),
    route: currentSanitizedRoute(),
    recentRoutes: trim(store.routes, 12),
    recentEvents: trim(store.events, 20),
  }
}
