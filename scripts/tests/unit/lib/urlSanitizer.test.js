import { describe, it, expect } from 'vitest'
import { sanitizeRoute, sanitizeUrl, sanitizeUrlsInText } from '../../../../src/lib/urlSanitizer'
import { scrubTransaction } from '../../../../src/lib/errorReporting'

const API = 'https://abc.supabase.co'

describe('sanitizeRoute', () => {
  it('redacts invite tokens in the path', () => {
    expect(sanitizeRoute('/join/abc123')).toBe('/join/<redacted>')
    expect(sanitizeRoute('/splitwise/join/xyz?x=1')).toBe('/splitwise/join/<redacted>?x=1')
  })

  it('redacts sensitive query params and drops the hash', () => {
    expect(sanitizeRoute('/auth?code=secret&next=%2F#access_token=t')).toBe('/auth?code=%3Credacted%3E&next=%2F')
  })

  it('leaves ordinary routes alone', () => {
    expect(sanitizeRoute('/transactions?month=2026-01')).toBe('/transactions?month=2026-01')
  })
})

describe('sanitizeUrl', () => {
  it('drops the whole query string of Supabase API calls', () => {
    const url = `${API}/rest/v1/transactions?select=*&or=(description.ilike.%25rent%25)`
    expect(sanitizeUrl(url)).toBe(`${API}/rest/v1/transactions`)
  })

  it('redacts invite tokens in absolute app URLs', () => {
    expect(sanitizeUrl('https://kosha.app/join/abc#x')).toBe('https://kosha.app/join/<redacted>')
  })

  it('keeps relative URLs relative', () => {
    expect(sanitizeUrl('/splitwise/join/abc')).toBe('/splitwise/join/<redacted>')
  })
})

describe('sanitizeUrlsInText', () => {
  it('sanitizes URLs inside a span description', () => {
    expect(sanitizeUrlsInText(`GET ${API}/rest/v1/transactions?or=(notes.ilike.%25doctor%25)`))
      .toBe(`GET ${API}/rest/v1/transactions`)
  })
})

describe('scrubTransaction', () => {
  it('scrubs the transaction name, request URL and fetch spans', () => {
    const event = scrubTransaction({
      transaction: '/join/abc123',
      request: { url: 'https://kosha.app/join/abc123' },
      spans: [{
        description: `GET ${API}/rest/v1/transactions?or=(description.ilike.%25rent%25)`,
        data: { url: `${API}/rest/v1/transactions`, 'http.query': '?or=(description.ilike.%25rent%25)', 'http.fragment': '#t' },
      }],
    })
    expect(event.transaction).toBe('/join/<redacted>')
    expect(event.request.url).toBe('https://kosha.app/join/<redacted>')
    expect(event.spans[0].description).toBe(`GET ${API}/rest/v1/transactions`)
    expect(event.spans[0].data).toEqual({ url: `${API}/rest/v1/transactions` })
  })

  it('leaves non-path transaction names readable', () => {
    expect(scrubTransaction({ transaction: 'pageload' }).transaction).toBe('pageload')
  })
})
