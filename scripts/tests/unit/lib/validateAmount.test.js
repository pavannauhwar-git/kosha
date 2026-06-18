import { describe, it, expect } from 'vitest'
import { validateAmount } from '../../../../src/lib/validateAmount'

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
})
