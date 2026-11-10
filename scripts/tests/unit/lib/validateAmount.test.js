import { describe, it, expect } from 'vitest'
import { MAX_AMOUNT, sanitizeAmountInput, validateAmount } from '../../../../src/lib/validateAmount'

describe('validateAmount', () => {
  it('rejects null or undefined', () => {
    expect(validateAmount(null)).toEqual({ ok: false, error: 'Amount is required' })
    expect(validateAmount(undefined)).toEqual({ ok: false, error: 'Amount is required' })
  })

  it('rejects empty strings', () => {
    expect(validateAmount('')).toEqual({ ok: false, error: 'Amount is required' })
    expect(validateAmount('   ')).toEqual({ ok: false, error: 'Amount is required' })
  })

  it('rejects scientific notation and explicit positive signs', () => {
    expect(validateAmount('1e5')).toEqual({ ok: false, error: 'Invalid amount format' })
    expect(validateAmount('+100')).toEqual({ ok: false, error: 'Invalid amount format' })
  })

  it('allows and strips grouping commas correctly', () => {
    const result = validateAmount('1,234.56')
    expect(result.ok).toBe(true)
    expect(result.paise).toBe(123456n)

    const indianFormat = validateAmount('1,23,456.78')
    expect(indianFormat.ok).toBe(true)
    expect(indianFormat.paise).toBe(12345678n)
  })

  it('rejects more than two decimal places', () => {
    expect(validateAmount('12.345')).toEqual({ ok: false, error: 'Maximum 2 decimal places allowed' })
  })

  it('rejects multiple decimal points', () => {
    expect(validateAmount('12.34.56')).toEqual({ ok: false, error: 'Invalid amount format' })
  })

  it('rejects completely invalid characters', () => {
    expect(validateAmount('abc')).toEqual({ ok: false, error: 'Invalid number' })
  })

  it('respects allowZero option', () => {
    expect(validateAmount('0', { allowZero: false })).toEqual({ ok: false, error: 'Amount cannot be zero' })
    
    const res = validateAmount('0', { allowZero: true })
    expect(res.ok).toBe(true)
    expect(res.paise).toBe(0n)
  })

  it('respects min and max constraints', () => {
    expect(validateAmount('5', { min: 10 })).toEqual({ ok: false, error: 'Amount cannot be less than 10' })
    expect(validateAmount('50', { max: 20 })).toEqual({ ok: false, error: 'Amount cannot be greater than 20' })
  })

  it('correctly converts valid amounts to paise', () => {
    expect(validateAmount('12.50')).toEqual({ ok: true, paise: 1250n })
    expect(validateAmount('-5.00')).toEqual({ ok: true, paise: -500n })
  })

  it('rejects amounts that do not fit numeric(12,2)', () => {
    expect(validateAmount(String(MAX_AMOUNT)).ok).toBe(true)
    expect(validateAmount('10000000000')).toEqual({ ok: false, error: 'Amount is too large (the limit is ₹999 crore)' })
  })
})

describe('sanitizeAmountInput', () => {
  it('strips rupee prefixes, grouping commas and spaces from pasted amounts', () => {
    expect(sanitizeAmountInput('1,23,456.50')).toBe('123456.50')
    expect(sanitizeAmountInput('₹1,250')).toBe('1250')
    expect(sanitizeAmountInput('₹ 1,250.00')).toBe('1250.00')
    expect(sanitizeAmountInput('Rs. 999')).toBe('999')
    expect(sanitizeAmountInput('INR 45')).toBe('45')
    expect(sanitizeAmountInput(' 1 250 ')).toBe('1250')
    expect(sanitizeAmountInput('+75')).toBe('75')
  })

  it('keeps partial input the user is still typing', () => {
    expect(sanitizeAmountInput('')).toBe('')
    expect(sanitizeAmountInput('12.')).toBe('12.')
    expect(sanitizeAmountInput('.5')).toBe('.5')
  })

  it('returns null for anything that is not a plain amount', () => {
    expect(sanitizeAmountInput('1e5')).toBeNull()
    expect(sanitizeAmountInput('-50')).toBeNull()
    expect(sanitizeAmountInput('12.3.4')).toBeNull()
    expect(sanitizeAmountInput('abc')).toBeNull()
  })
})
