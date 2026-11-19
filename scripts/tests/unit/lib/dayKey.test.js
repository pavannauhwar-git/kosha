import { describe, it, expect } from 'vitest'
import { dayKey, dateDistanceDays, groupByDate } from '../../../../src/lib/dayKey'

describe('dayKey', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    expect(dayKey('2026-03-05T10:00:00')).toBe('2026-03-05')
    expect(dayKey(new Date(2026, 0, 9, 23, 59))).toBe('2026-01-09')
  })

  it('returns null for empty or invalid input', () => {
    expect(dayKey(null)).toBe(null)
    expect(dayKey('')).toBe(null)
    expect(dayKey('not-a-date')).toBe(null)
  })
})

describe('dateDistanceDays', () => {
  it('counts whole days in either direction', () => {
    expect(dateDistanceDays('2026-03-01T00:00:00', '2026-03-31T23:00:00')).toBe(30)
    expect(dateDistanceDays('2026-03-31T00:00:00', '2026-03-01T00:00:00')).toBe(-30)
    expect(dateDistanceDays('2026-03-01T08:00:00', '2026-03-01T22:00:00')).toBe(0)
  })

  it('is NaN when a date is invalid', () => {
    expect(Number.isNaN(dateDistanceDays('bad', '2026-03-01'))).toBe(true)
  })
})

describe('groupByDate', () => {
  it('groups rows by day, newest day first, and skips rows without a date', () => {
    const a = { id: 'a', date: '2026-03-02' }
    const b = { id: 'b', date: '2026-03-01' }
    const c = { id: 'c', date: '2026-03-02' }
    expect(groupByDate([a, b, null, { id: 'x' }, c])).toEqual([
      ['2026-03-02', [a, c]],
      ['2026-03-01', [b]],
    ])
  })

  it('returns an empty list for non-array input', () => {
    expect(groupByDate(undefined)).toEqual([])
  })
})
