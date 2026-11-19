import { describe, it, expect } from 'vitest'
import { fmt, splitFmtAmount, toDisplayAmount } from '../../../../src/lib/utils'

describe('amount formatting', () => {
  it('never shows a minus sign on zero', () => {
    expect(toDisplayAmount(-0.004)).toBe(0)
    expect(Object.is(toDisplayAmount(-0.004), -0)).toBe(false)
    expect(fmt(-0.004)).not.toContain('−')
    expect(fmt(-0.004)).toBe(fmt(0))
    expect(splitFmtAmount(-0.001).main).not.toContain('−')
  })

  it('keeps real negatives', () => {
    expect(fmt(-12.5)).toContain('−')
    expect(fmt(-0.01)).toContain('−')
  })

  it('rounds to paise before formatting', () => {
    expect(fmt(10.005)).toBe(fmt(10.01))
    expect(splitFmtAmount(1234.567).decimal).toBe('.57')
  })

  it('picks lakh or crore after rounding', () => {
    expect(fmt(9999999.999, true)).toContain('1.00Cr')
    expect(fmt(9999500, true)).toContain('1.00Cr')
    expect(fmt(150000, true)).toContain('1.50L')
    expect(fmt(-250000, true)).toBe('−₹\u202F2.50L')
    expect(fmt(50000, true)).not.toContain('L')
  })
})
