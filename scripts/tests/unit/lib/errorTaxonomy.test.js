import { describe, it, expect } from 'vitest'
import { ERROR_KIND, classifyError, isExpectedError } from '../../../../src/lib/errorTaxonomy'
import { toReportableError } from '../../../../src/lib/errorReporting'

describe('classifyError', () => {
  it('treats a plain Error as our own validation message', () => {
    expect(classifyError(new Error('Amount must be positive'))).toBe(ERROR_KIND.VALIDATION)
    expect(isExpectedError(new Error('Amount must be positive'))).toBe(true)
  })

  it('reports programming errors instead of hiding them as validation', () => {
    expect(classifyError(new RangeError('Invalid time value'))).toBe(ERROR_KIND.UNKNOWN)
    expect(classifyError(new ReferenceError('x is not defined'))).toBe(ERROR_KIND.UNKNOWN)
    expect(classifyError('something odd')).toBe(ERROR_KIND.UNKNOWN)
    expect(isExpectedError(new RangeError('Invalid time value'))).toBe(false)
  })

  it('classifies backend codes and statuses', () => {
    expect(classifyError({ code: '23505', message: 'duplicate key' })).toBe(ERROR_KIND.CONFLICT)
    expect(classifyError({ code: '42501', message: 'permission denied' })).toBe(ERROR_KIND.PERMISSION)
    expect(classifyError({ status: 403 })).toBe(ERROR_KIND.PERMISSION)
    expect(classifyError({ code: 'PGRST116', message: 'no rows' })).toBe(ERROR_KIND.UNKNOWN)
    expect(classifyError(new TypeError('Load failed'))).toBe(ERROR_KIND.NETWORK)
  })
})

describe('toReportableError', () => {
  it('keeps the message and code of a plain Supabase error object', () => {
    const wrapped = toReportableError({ message: 'JSON object requested', code: 'PGRST116', details: 'x', hint: null })
    expect(wrapped).toBeInstanceOf(Error)
    expect(wrapped.message).toBe('JSON object requested')
    expect(wrapped.code).toBe('PGRST116')
    expect(wrapped.details).toBe('x')
    expect('hint' in wrapped).toBe(false)
  })

  it('passes real Errors through and stringifies anything else', () => {
    const original = new Error('boom')
    expect(toReportableError(original)).toBe(original)
    expect(toReportableError('plain text').message).toBe('plain text')
    expect(toReportableError(null).message).toBe('Unknown error')
  })
})
