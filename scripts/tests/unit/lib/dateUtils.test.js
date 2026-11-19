import { describe, it, expect } from 'vitest'
import {
  monthInputFromDate,
  parseMonthInput,
  formatMonthInputLabel,
  parseIsoDateInput,
  formatIsoDateLabel,
} from '../../../../src/lib/dateUtils'

describe('month inputs', () => {
  it('formats and parses YYYY-MM', () => {
    expect(monthInputFromDate(new Date(2026, 0, 15))).toBe('2026-01')
    expect(parseMonthInput('2026-02')).toEqual({ year: 2026, month: 2 })
  })

  it('rejects malformed months', () => {
    expect(parseMonthInput('2026-13')).toBe(null)
    expect(parseMonthInput('2026-00')).toBe(null)
    expect(parseMonthInput('2026-2')).toBe(null)
    expect(parseMonthInput(null)).toBe(null)
    expect(formatMonthInputLabel('bad')).toBe('Specific month')
  })
})

describe('ISO date inputs', () => {
  it('accepts real calendar dates and trims spaces', () => {
    expect(parseIsoDateInput('2024-02-29')).toBe('2024-02-29')
    expect(parseIsoDateInput(' 2026-01-05 ')).toBe('2026-01-05')
  })

  it('rejects dates that do not exist or are malformed', () => {
    expect(parseIsoDateInput('2026-02-29')).toBe(null)
    expect(parseIsoDateInput('2026-04-31')).toBe(null)
    expect(parseIsoDateInput('2026-1-5')).toBe(null)
    expect(formatIsoDateLabel('bad')).toBe('Custom range')
  })
})
