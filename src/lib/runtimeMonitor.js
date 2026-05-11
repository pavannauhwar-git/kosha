import { captureError } from './errorReporting'

const STORE_KEY = 'kosha:runtime-monitor-v1'
const MAX_EVENTS = 40

let started = false
let _memoryStore = null

function nowIso() {
  return new Date().toISOString()
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

function pushEvent(type, detail) {
  const store = readStore()
  const events = trim([
    ...store.events,
    {
      ts: nowIso(),
      type,
      detail: String(detail || '').slice(0, 800),
      route: `${window.location.pathname}${window.location.search || ''}`,
    },
  ])
  writeStore({ ...store, events })
}

export function recordRuntimeRoute(pathname) {
  if (!pathname) return
  const store = readStore()
  const last = store.routes[store.routes.length - 1]
  if (last?.path === pathname) return

  const routes = trim([
    ...store.routes,
    { ts: nowIso(), path: String(pathname).slice(0, 220) },
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
    route: `${window.location.pathname}${window.location.search || ''}`,
    recentRoutes: trim(store.routes, 12),
    recentEvents: trim(store.events, 20),
  }
}
