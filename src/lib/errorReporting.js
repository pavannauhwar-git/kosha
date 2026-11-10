import { isExpectedError } from './errorTaxonomy'
import { sanitizeUrl, sanitizeUrlsInText } from './urlSanitizer'
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

function isSensitiveKey(key) {
  if (typeof key !== 'string') return false
  const lower = key.toLowerCase()
  return SENSITIVE_KEY_PATTERNS.some((p) => lower.includes(p))
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
        obj[key] = sanitizeUrl(value)
      }
    } else if (value && typeof value === 'object') {
      redactInPlace(value, depth + 1)
    }
  }
}

function scrubBreadcrumb(crumb) {
  if (!crumb) return crumb
  if (crumb.data) redactInPlace(crumb.data)
  if (typeof crumb.message === 'string') crumb.message = sanitizeUrlsInText(crumb.message)
  if (typeof crumb.message === 'string' && crumb.message.length > 500) {
    // Truncate freeform breadcrumb messages so a debug log full of a JWT
    // body can't get exfiltrated whole.
    crumb.message = crumb.message.slice(0, 500) + '…'
  }
  return crumb
}

export function scrubTransaction(event) {
  if (!event) return event
  if (typeof event.transaction === 'string') {
    event.transaction = event.transaction.startsWith('/')
      ? sanitizeUrl(event.transaction)
      : sanitizeUrlsInText(event.transaction)
  }
  if (event.request?.url) event.request.url = sanitizeUrl(event.request.url)
  if (event.request?.headers) redactInPlace(event.request.headers)
  if (event.contexts) redactInPlace(event.contexts)
  if (event.tags) redactInPlace(event.tags)
  if (Array.isArray(event.spans)) {
    for (const span of event.spans) {
      if (typeof span.description === 'string') span.description = sanitizeUrlsInText(span.description)
      if (span.data) {
        // Fetch spans keep the query string and hash apart from the URL.
        delete span.data['http.query']
        delete span.data['http.fragment']
        redactInPlace(span.data)
      }
    }
  }
  return event
}

let sentry = null
let sentryLoad = null
const pendingCalls = []
const MAX_PENDING_CALLS = 30

function withSentry(fn) {
  if (!DSN) return
  if (sentry) {
    fn(sentry)
    return
  }
  if (pendingCalls.length < MAX_PENDING_CALLS) pendingCalls.push(fn)
}

// Loads and starts Sentry. main.jsx calls this once the first screen has
// rendered, so the SDK isn't part of the start-up download. Reports made
// before then are queued and sent once it loads.
export function initErrorReporting() {
  if (!DSN || sentryLoad) return sentryLoad
  sentryLoad = import('@sentry/react')
    .then((Sentry) => {
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
        ],
        tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
        beforeBreadcrumb(crumb) {
          return scrubBreadcrumb(crumb)
        },
        beforeSendTransaction(event) {
          try {
            return scrubTransaction(event)
          } catch {
            return null
          }
        },
        beforeSend(event) {
          try {
            if (event.request?.url) event.request.url = sanitizeUrl(event.request.url)
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
      sentry = Sentry
      for (const fn of pendingCalls.splice(0)) fn(Sentry)
    })
    .catch((err) => {
      console.warn('[Kosha] Error reporting failed to load', err)
    })
  return sentryLoad
}

// Supabase can hand back plain objects ({ message, code, details, hint }).
// Wrap them so Sentry shows the message and code instead of "[object Object]".
export function toReportableError(error) {
  if (error instanceof Error) return error
  if (error && typeof error === 'object') {
    const wrapped = new Error(String(error.message || error.error_description || error.error || 'Unknown error'))
    for (const field of ['code', 'status', 'details', 'hint']) {
      if (error[field] != null) wrapped[field] = error[field]
    }
    return wrapped
  }
  return new Error(String(error ?? 'Unknown error'))
}

export function captureError(error, { context = 'unknown', extra = {}, tags = {} } = {}) {
  const reportable = toReportableError(error)
  const code = reportable.code ?? reportable.status

  if (DSN) {
    withSentry((Sentry) => {
      Sentry.withScope((scope) => {
        scope.setTag('context', context)
        if (code != null) {
          scope.setTag('error_code', String(code))
          // Backend failures share a stack inside supabase-js, so group them
          // by where they happened and their code instead.
          scope.setFingerprint([String(context), String(code)])
        }
        scope.setExtras(extra)
        if (tags && typeof tags === 'object') {
          scope.setTags(tags)
        }
        Sentry.captureException(reportable)
      })
    })
    return
  }

  // Fallback — structured console output in dev
  console.error(`[Kosha] Error in ${context}:`, reportable.message, { extra, tags })
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
  withSentry((Sentry) => Sentry.setUser({ id: user.id }))
}

export function clearErrorReportingUser() {
  withSentry((Sentry) => Sentry.setUser(null))
}
