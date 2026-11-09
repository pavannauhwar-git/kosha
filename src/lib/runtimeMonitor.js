import { captureError } from './errorReporting.js'
import { sanitizeRoute } from './urlSanitizer.js'

const STORE_KEY = 'kosha:runtime-monitor-v1'
const MAX_EVENTS = 40

let started = false
let _memoryStore = null

function nowIso() {
  return new Date().toISOString()
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
