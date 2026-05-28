import * as Sentry from '@sentry/react'

const DSN = import.meta.env.VITE_SENTRY_DSN

// Fields whose values must be redacted before leaving the browser, no matter
// where they appear in the event payload (extras, contexts, breadcrumbs).
// We match on substring (case-insensitive) so e.g. "access_token", "userToken",
// "refresh_token" are all caught by "token".
const SENSITIVE_KEY_PATTERNS = [
  'token', 'secret', 'password', 'apikey', 'api_key', 'authorization',
  'auth', 'cookie', 'session', 'pin', 'otp',
  // Project-specific keys that hold invite material:
  'invite', 'splittoken', 'split_token',
]

// Query / URL fragment params that often carry auth material. Stripped from
// any URL we serialize into the event.
const SENSITIVE_URL_PARAMS = new Set([
  'token', 'access_token', 'refresh_token', 'invite', 'splittoken', 'split_token',
  'code', 'state', 'id_token', 'apikey',
])

function isSensitiveKey(key) {
  if (typeof key !== 'string') return false
  const lower = key.toLowerCase()
  return SENSITIVE_KEY_PATTERNS.some((p) => lower.includes(p))
}

function scrubUrl(rawUrl) {
  if (typeof rawUrl !== 'string') return rawUrl
  try {
    const url = new URL(rawUrl)
    // Strip query params we know carry secrets, keep the rest so we can still
    // see which page errored.
    const params = url.searchParams
    for (const key of Array.from(params.keys())) {
      if (SENSITIVE_URL_PARAMS.has(key.toLowerCase())) {
        params.set(key, '[redacted]')
      }
    }
    // The hash can carry tokens too (OAuth implicit flow, our own
    // `#kosha-uid=...` per-user cache key, etc). Drop it wholesale.
    if (url.hash) url.hash = ''
    return url.toString()
  } catch {
    return rawUrl
  }
}

// Recursively walk an arbitrary object graph and redact any value whose key
// matches our sensitive list. Bounded depth so a circular or pathological
// object can't hang the beforeSend hook.
function redactInPlace(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 6) return
  if (Array.isArray(obj)) {
    for (const item of obj) redactInPlace(item, depth + 1)
    return
  }
  for (const key of Object.keys(obj)) {
    const value = obj[key]
    if (isSensitiveKey(key)) {
      obj[key] = '[redacted]'
      continue
    }
    if (typeof value === 'string') {
      // Catch the case where a sensitive value is stored under a benign key
      // (e.g. extras.url = "https://...?invite=abc"). Only run URL scrub when
      // the string looks like a URL — avoids accidentally rewriting prose.
      if (/^https?:\/\//i.test(value) || value.startsWith('/')) {
        obj[key] = scrubUrl(value)
      }
    } else if (value && typeof value === 'object') {
      redactInPlace(value, depth + 1)
    }
  }
}

function scrubBreadcrumb(crumb) {
  if (!crumb) return crumb
  if (crumb.data) redactInPlace(crumb.data)
  if (typeof crumb.message === 'string' && crumb.message.length > 500) {
    // Truncate freeform breadcrumb messages so a debug log full of a JWT
    // body can't get exfiltrated whole.
    crumb.message = crumb.message.slice(0, 500) + '…'
  }
  return crumb
}

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.MODE,            // 'development' | 'production'
    release: import.meta.env.VITE_APP_VERSION,    // optional — set in vite.config.js define block
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,     // financial data — always mask
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    replaysOnErrorSampleRate: 1.0,   // capture replay on every error in prod
    replaysSessionSampleRate: 0.0,   // no session replays — privacy first
    beforeBreadcrumb(crumb) {
      return scrubBreadcrumb(crumb)
    },
    beforeSend(event) {
      try {
        if (event.request?.url) event.request.url = scrubUrl(event.request.url)
        if (event.request?.headers) redactInPlace(event.request.headers)
        if (event.request?.data) redactInPlace(event.request.data)
        if (event.extra) redactInPlace(event.extra)
        if (event.contexts) redactInPlace(event.contexts)
        if (event.tags) redactInPlace(event.tags)
        if (Array.isArray(event.breadcrumbs)) {
          event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb)
        }
        // User identity is set explicitly by setErrorReportingUser to only
        // the user id — defensively strip anything else that might have
        // crept in (email, ip, username).
        if (event.user) {
          event.user = { id: event.user.id }
        }
      } catch {
        // If scrubbing itself throws, drop the event rather than risk
        // leaking the unscrubbed version.
        return null
      }
      return event
    },
  })
}

export function captureError(error, { context = 'unknown', extra = {}, tags = {} } = {}) {
  if (!(error instanceof Error)) {
    error = new Error(String(error ?? 'Unknown error'))
  }

  if (DSN) {
    Sentry.withScope((scope) => {
      scope.setTag('context', context)
      Object.entries(tags).forEach(([key, val]) => {
        scope.setTag(key, val)
      })
      scope.setExtras(extra)
      Sentry.captureException(error)
    })
    return
  }

  // Fallback — structured console output in dev
  console.error(`[Kosha] Error in ${context}:`, error.message, { ...extra, ...tags })
}

export function setErrorReportingUser(user) {
  if (!user?.id) return
  if (DSN) {
    Sentry.setUser({ id: user.id })
  }
}

export function clearErrorReportingUser() {
  if (DSN) {
    Sentry.setUser(null)
  }
}
