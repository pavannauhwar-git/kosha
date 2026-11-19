// Supabase reports failed sign-ins and dead email links in the query string
// or the hash (`error`, `error_code`, `error_description`). Anyone can put
// those in a link, so only known codes get a message and the description
// text is never shown.
export function readAuthUrlError(search, hash) {
  const query = new URLSearchParams(search || '')
  const fragment = new URLSearchParams(String(hash || '').replace(/^#/, ''))
  const pick = (key) => query.get(key) || fragment.get(key) || ''
  const code = pick('error_code') || pick('error')
  if (!code) return null
  return { code, description: pick('error_description').replace(/\+/g, ' ') }
}

const MESSAGES = {
  access_denied: 'Sign-in was cancelled. Try again when you’re ready.',
  flow_state_expired: 'Sign-in took too long. Try again.',
  flow_state_not_found: 'Sign-in took too long. Try again.',
  bad_oauth_state: 'Sign-in couldn’t be completed. Try again.',
  bad_oauth_callback: 'Sign-in couldn’t be completed. Try again.',
  email_not_confirmed: 'Confirm your email first, using the link we sent you.',
  user_banned: 'This account can’t sign in.',
  signup_disabled: 'New sign-ups are closed.',
}

export function authUrlErrorMessage({ code, description }, isRecoveryFlow) {
  if (code === 'otp_expired' || (isRecoveryFlow && /expired|invalid/i.test(description || ''))) {
    return 'This link has expired or was already used. Request a new reset link below.'
  }
  return MESSAGES[code] || 'Sign-in failed. Try again.'
}

// With PKCE sign-in, an email link only works in the browser that asked for
// it. A `code` still in the URL once auth has settled means the exchange
// failed, usually because the link was opened somewhere else (on iPhone,
// email links open in Safari, not the home-screen app).
export function unusedSignInCodeMessage(isRecoveryFlow) {
  return isRecoveryFlow
    ? 'Open the reset link in the browser where you asked for it, or request a new link here.'
    : 'That link couldn’t sign you in on this browser. If you were confirming your email, it’s confirmed. Sign in below.'
}
