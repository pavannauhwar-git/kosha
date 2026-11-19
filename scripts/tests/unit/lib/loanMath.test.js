import { describe, it, expect } from 'vitest'
import { accruedInterest, loanProgress } from '../../../../src/hooks/useLoans'

describe('accruedInterest', () => {
  it('charges simple interest for the time elapsed', () => {
    expect(accruedInterest(10000, 12, '2025-01-01', '2025-12-31')).toBeCloseTo(1199.18, 2)
  })

  it('accepts a timestamp as the end date', () => {
    const end = new Date('2025-07-02T00:00:00').getTime()
    const years = (end - new Date('2025-01-01T00:00:00').getTime()) / (365.25 * 86400000)
    expect(accruedInterest(10000, 10, '2025-01-01', end)).toBeCloseTo(1000 * years, 6)
  })

  it('is zero without a rate, a start date or elapsed time', () => {
    expect(accruedInterest(10000, 0, '2025-01-01', '2025-12-31')).toBe(0)
    expect(accruedInterest(10000, -5, '2025-01-01', '2025-12-31')).toBe(0)
    expect(accruedInterest(10000, 12, null, '2025-12-31')).toBe(0)
    expect(accruedInterest(10000, 12, '2025-06-01', '2025-01-01')).toBe(0)
    expect(accruedInterest(10000, 12, 'not-a-date', '2025-12-31')).toBe(0)
  })
})

describe('loanProgress', () => {
  it('rounds the share repaid to a whole percent', () => {
    expect(loanProgress(1000, 250)).toBe(25)
    expect(loanProgress('1000', '333')).toBe(33)
  })

  it('caps at 100 and handles empty loans', () => {
    expect(loanProgress(1000, 1500)).toBe(100)
    expect(loanProgress(0, 100)).toBe(0)
    expect(loanProgress(null, null)).toBe(0)
  })
})
