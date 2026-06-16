import * as Sentry from '@sentry/react'
import { isExpectedError } from './errorTaxonomy'
import { useEffect } from 'react'
import {
  useLocation,
  useNavigationType,
  createRoutesFromChildren,
  matchRoutes,
} from 'react-router-dom'

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
  const isRelative = !/^https?:\/\//i.test(rawUrl)
  try {
    // Relative URLs (react-router breadcrumbs like `/auth/callback#token=…`)
    // throw in `new URL()` without a base. Parse against a placeholder origin
    // so query/hash scrubbing always runs, then strip the placeholder back off.
    const base = 'http://kosha.local/'
    const url = new URL(rawUrl, base)
    const params = url.searchParams
    for (const key of Array.from(params.keys())) {
      if (SENSITIVE_URL_PARAMS.has(key.toLowerCase())) {
        params.set(key, '[redacted]')
      }
    }
    // The hash can carry tokens too (OAuth implicit flow, our own
    // `#kosha-uid=...` per-user cache key, etc). Drop it wholesale.
    if (url.hash) url.hash = ''
    const out = url.toString()
    return isRelative ? out.slice(base.length - 1) : out
  } catch {
    // Last-ditch: guarantee the hash never escapes even if parsing fails.
    return String(rawUrl).split('#')[0]
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
      Sentry.reactRouterV6BrowserTracingIntegration({
        useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
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
      scope.setExtras(extra)
      if (tags && typeof tags === 'object') {
        scope.setTags(tags)
      }
      Sentry.captureException(error)
    })
    return
  }

  // Fallback — structured console output in dev
  console.error(`[Kosha] Error in ${context}:`, error.message, { extra, tags })
}

/**
 * Classifies a mutation (write-path) error as "expected" (a normal user-facing
 * outcome we deliberately throw, or one the UX already handles) vs.
 * "unexpected" (a real backend / network / programming failure worth a Sentry
 * event).
 *
 * Expected → NOT reported:
 *   - status 401 / 403        → auth + RLS denials, handled by AuthGuard / view-only UX
 *   - message 'OPTIMISTIC_BUSY' → rapid double-tap guard (see mutationGuard.js)
 *   - plain client Errors      → our own validation throws ('Amount must be
 *                                positive', 'Shared wallets are view-only', …)
 *                                which carry no backend status/code
 *
 * Unexpected → reported:
 *   - any error with a backend status/code (PostgREST/Postgres: missing RPC
 *     e.g. PGRST202, constraint violations, 5xx, …)
 *   - network / programming errors (TypeError, incl. Safari "Load failed")
 */
// Delegates to the canonical taxonomy so monitoring + UX never diverge.
// NOTE: this now treats HTTP 409 (conflict) as EXPECTED (was reported under
// F1). See src/lib/errorTaxonomy.js EXPECTED_KINDS to change that.
export function isExpectedMutationError(error) {
  return isExpectedError(error)
}

/**
 * Reports an unexpected mutation failure to Sentry. No-ops for expected errors
 * so the dashboard stays signal-rich. Mutations in this app are plain async
 * functions (not React Query `useMutation`), so the MutationCache.onError hook
 * never fires — without this, write-path failures are invisible in monitoring.
 *
 * Call from a mutation catch block BEFORE showing the user-facing toast:
 *
 *   } catch (err) {
 *     captureMutationError(err, { context: 'splitwise:saveExpense' })
 *     setToast(err?.message || 'Could not save expense.')
 *   }
 */
export function captureMutationError(error, { context = 'mutation', extra = {}, tags = {} } = {}) {
  if (isExpectedMutationError(error)) return
  captureError(error, { context, extra, tags: { source: 'mutation', ...tags } })
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
