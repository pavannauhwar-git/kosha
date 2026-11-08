import { describe, it, expect } from 'vitest'
import { addMonthsClamped, nextRecurringDate, nextRecurringDateAfter } from '../../../../src/lib/recurrence'

describe('recurrence', () => {
  it('clamps months correctly', () => {
    expect(addMonthsClamped('2026-01-31', 1)).toBe('2026-02-28')
  })

  it('calculates nextRecurringDate for monthly', () => {
    expect(nextRecurringDate('2026-03-15', 'monthly')).toBe('2026-04-15')
  })

  it('calculates nextRecurringDate for yearly', () => {
    expect(nextRecurringDate('2026-03-15', 'yearly')).toBe('2027-03-15')
  })

  it('calculates nextRecurringDateAfter for monthly schedule past today', () => {
    expect(nextRecurringDateAfter('2026-01-31', 'monthly', '2026-11-08')).toBe('2026-11-30')
  })

  it('calculates nextRecurringDateAfter for quarterly schedule past today', () => {
    expect(nextRecurringDateAfter('2026-01-10', 'quarterly', '2026-11-08')).toBe('2027-01-10')
  })
})
