/**
 * Canonical error classification for the whole app. One source of truth that
 * both monitoring (what to report to Sentry) and UX (what to show the user)
 * read from, so the two never drift.
 */

export const ERROR_KIND = Object.freeze({
  VALIDATION: 'validation', // user input / business rule we threw — show message, don't report
  PERMISSION: 'permission', // 401/403 auth or RLS denial — handled by guards, don't report
  BUSY: 'busy',             // OPTIMISTIC_BUSY double-tap guard — ignore
  CONFLICT: 'conflict',     // 409 unique/constraint — show message, don't report
  NOT_FOUND: 'notFound',    // 404 incl. PGRST202 missing RPC — real gap, report
  NETWORK: 'network',       // fetch/TypeError incl. Safari "Load failed" — report
  SERVER: 'server',         // 5xx — report
  UNKNOWN: 'unknown',       // backend error we didn't special-case — report
})

// Kinds that are NORMAL outcomes (not bugs). Everything else is reported.
// To keep reporting 409s (F1's original behavior), remove ERROR_KIND.CONFLICT here.
const EXPECTED_KINDS = new Set([
  ERROR_KIND.VALIDATION,
  ERROR_KIND.PERMISSION,
  ERROR_KIND.BUSY,
  ERROR_KIND.CONFLICT,
])

export function classifyError(error) {
  if (error?.message === 'OPTIMISTIC_BUSY') return ERROR_KIND.BUSY
  if (error?.name === 'AbortError') return ERROR_KIND.BUSY

  const code = error?.code
  const status = Number(error?.status)

  // PostgREST/Postgres SQLSTATE codes (string) — not HTTP statuses.
  if (code === '23505') return ERROR_KIND.CONFLICT       // unique_violation
  if (code === '42501') return ERROR_KIND.PERMISSION     // insufficient_privilege
  if (code === 'PGRST202') return ERROR_KIND.NOT_FOUND   // missing RPC

  if (status === 401 || status === 403) return ERROR_KIND.PERMISSION
  if (status === 409) return ERROR_KIND.CONFLICT
  if (status === 404) return ERROR_KIND.NOT_FOUND
  if (Number.isFinite(status) && status >= 500) return ERROR_KIND.SERVER
  if (error instanceof TypeError) return ERROR_KIND.NETWORK

  // A backend error carrying a status/code we didn't special-case above.
  if (error?.status != null || error?.code != null) return ERROR_KIND.UNKNOWN

  // Plain client-thrown Error with no backend signature → our own validation.
  return ERROR_KIND.VALIDATION
}

export function isExpectedError(error) {
  return EXPECTED_KINDS.has(classifyError(error))
}

const GENERIC_MESSAGE = 'Something went wrong. Please try again.'

/**
 * User-safe toast text. For kinds we deliberately surface (validation,
 * permission, conflict) we trust `error.message`. For unexpected kinds we
 * return the caller-supplied fallback (or a generic message) so raw technical
 * strings (e.g. "PGRST202…") never reach the user.
 */
export function toToastMessage(error, fallback) {
  const kind = classifyError(error)
  if (kind === ERROR_KIND.VALIDATION || kind === ERROR_KIND.PERMISSION || kind === ERROR_KIND.CONFLICT) {
    return error?.message || fallback || GENERIC_MESSAGE
  }
  return fallback || GENERIC_MESSAGE
}
