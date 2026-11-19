import { describe, it, expect } from 'vitest'
import { readAuthUrlError, authUrlErrorMessage, unusedSignInCodeMessage } from '../../../../src/lib/authUrlError'

describe('readAuthUrlError', () => {
  it('reads the code from the query string or the hash', () => {
    expect(readAuthUrlError('?error=access_denied', '')).toEqual({ code: 'access_denied', description: '' })
    expect(readAuthUrlError('', '#error=x&error_code=otp_expired&error_description=Email+link+is+invalid'))
      .toEqual({ code: 'otp_expired', description: 'Email link is invalid' })
  })

  it('returns null when there is no error', () => {
    expect(readAuthUrlError('?code=abc', '')).toBeNull()
  })
})

describe('authUrlErrorMessage', () => {
  it('never shows the description from the URL', () => {
    const message = authUrlErrorMessage({ code: 'server_error', description: 'Call +1 555 0100 to unlock your account' }, false)
    expect(message).toBe('Sign-in failed. Try again.')
  })

  it('uses a fixed message for known codes', () => {
    expect(authUrlErrorMessage({ code: 'access_denied', description: 'anything' }, false))
      .toBe('Sign-in was cancelled. Try again when you’re ready.')
  })

  it('points an expired reset link at a new one', () => {
    expect(authUrlErrorMessage({ code: 'otp_expired', description: '' }, false)).toMatch(/expired/)
    expect(authUrlErrorMessage({ code: 'access_denied', description: 'Link is invalid or has expired' }, true)).toMatch(/expired/)
  })
})

describe('unusedSignInCodeMessage', () => {
  it('differs for a reset link and a sign-in link', () => {
    expect(unusedSignInCodeMessage(true)).toMatch(/reset link/)
    expect(unusedSignInCodeMessage(false)).toMatch(/Sign in below/)
  })
})
