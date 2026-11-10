import { describe, it, expect } from 'vitest'
import { earliestPaidOn, paidOnError } from '../../../../src/lib/paidOn'

const TODAY = '2026-03-10'

describe('paidOnError', () => {
  it('accepts today and earlier dates within a year', () => {
    expect(paidOnError(TODAY, TODAY)).toBeNull()
    expect(paidOnError('2026-02-01', TODAY)).toBeNull()
    expect(paidOnError(earliestPaidOn(TODAY), TODAY)).toBeNull()
  })

  it('rejects future dates, dates over a year back and empty values', () => {
    expect(paidOnError('2026-03-11', TODAY)).toContain('future')
    expect(paidOnError('2025-03-09', TODAY)).toContain('one year back')
    expect(paidOnError('', TODAY)).toContain('Pick the date')
    expect(paidOnError(null, TODAY)).toContain('Pick the date')
  })

  it('counts a year back across a leap day', () => {
    expect(earliestPaidOn('2024-03-01')).toBe('2023-03-02')
    expect(earliestPaidOn(TODAY)).toBe('2025-03-10')
  })
})
