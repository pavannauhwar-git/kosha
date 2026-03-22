/**
 * authStore — module-level auth state singleton
 *
 * WHY THIS EXISTS:
 * Supabase mutations were calling getSession() independently on every
 * mutation. On cold start, the stored JWT is expired and getSession()
 * returns null during the ~200–500ms token refresh window — even though
 * the user IS authenticated. This caused "Not signed in" errors on the
 * very first action after opening the app.
 *
 * FIX:
 * useAuth writes the current user to this store on every onAuthStateChange
 * event (including TOKEN_REFRESHED). Mutations read synchronously from here
 * instead of going through getSession(). Since TOKEN_REFRESHED fires before
 * the app is interactive enough for a mutation to succeed, this store always
 * holds a valid user ID by the time any mutation runs.
 *
 * This is a standard pattern for making auth available outside of React
 * (in non-component async functions). It is intentionally NOT a React
 * context — contexts cannot be read inside standalone async functions.
 */

let _userId = null
let _sessionReady = false

/**
 * Called by useAuth on every auth state change.
 * Sets the current user and marks session as ready.
 */
export function setAuthUser(user) {
  _userId = user?.id ?? null
  _sessionReady = true
}

/**
 * Called by useAuth on SIGNED_OUT.
 */
export function clearAuthUser() {
  _userId = null
  _sessionReady = true
}

/**
 * Synchronous — no network call, no async, no race window.
 * Returns the current user ID or throws a clear error.
 *
 * Use this in ALL mutation functions instead of getSession().
 */
export function getAuthUserId() {
  if (!_sessionReady) {
    throw new Error('Session initialising — please try again in a moment.')
  }
  if (!_userId) {
    throw new Error('Not signed in')
  }
  return _userId
}

/**
 * True once the first INITIAL_SESSION event has fired.
 * Useful for gating UI before auth has bootstrapped.
 */
export function isAuthReady() {
  return _sessionReady
}
