import { describe, it, expect } from 'vitest'
import { readStoredSessionUser, getCacheOwner, setCacheOwner } from '../../../../src/lib/storedSession'

function fakeStorage(entries = {}) {
  const map = new Map(Object.entries(entries))
  return {
    get length() { return map.size },
    key: (i) => Array.from(map.keys())[i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)) },
    removeItem: (k) => { map.delete(k) },
  }
}

const session = { access_token: 'a', refresh_token: 'r', user: { id: 'u-1' } }

describe('readStoredSessionUser', () => {
  it('returns the user of a stored session that can still refresh', () => {
    const storage = fakeStorage({ 'sb-abc-auth-token': JSON.stringify(session) })
    expect(readStoredSessionUser(storage)).toEqual({ id: 'u-1' })
  })

  it('ignores the PKCE verifier and other keys', () => {
    const storage = fakeStorage({ 'sb-abc-auth-token-code-verifier': JSON.stringify(session), other: '1' })
    expect(readStoredSessionUser(storage)).toBeNull()
  })

  it('treats a session without a refresh token or a corrupt value as signed out', () => {
    expect(readStoredSessionUser(fakeStorage({ 'sb-abc-auth-token': JSON.stringify({ user: { id: 'u-1' } }) }))).toBeNull()
    expect(readStoredSessionUser(fakeStorage({ 'sb-abc-auth-token': '{not json' }))).toBeNull()
  })
})

describe('cache owner', () => {
  it('records and clears whose data the offline cache holds', () => {
    const storage = fakeStorage()
    expect(getCacheOwner(storage)).toBeNull()
    setCacheOwner('u-1', storage)
    expect(getCacheOwner(storage)).toBe('u-1')
    setCacheOwner(null, storage)
    expect(getCacheOwner(storage)).toBeNull()
  })
})
