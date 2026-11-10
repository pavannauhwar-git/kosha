import { describe, it, expect } from 'vitest'
import { computeWeeklySpendDrift, countsTowardWeeklyDrift } from '../../../../src/lib/weeklyDrift'

// Wednesday 14 Jan 2026; the current week starts Monday 12 Jan (3 days so far).
const NOW = new Date(2026, 0, 14, 9, 30)
// Sunday 18 Jan 2026; the whole current week has happened.
const SUNDAY = new Date(2026, 0, 18, 9, 30)
const PREVIOUS_MONDAYS = ['2026-01-05', '2025-12-29', '2025-12-22', '2025-12-15']

function totals(entries) {
  return Object.fromEntries(entries)
}

function withBaseline(currentWeekSpend, baseline = [1000, 1000, 1000, 1000]) {
  return totals([
    ...PREVIOUS_MONDAYS.map((day, i) => [day, baseline[i]]),
    ['2026-01-12', currentWeekSpend],
  ])
}

describe('computeWeeklySpendDrift', () => {
  it('reports no data for an empty history', () => {
    const r = computeWeeklySpendDrift({}, NOW)
    expect(r.hasData).toBe(false)
    expect(r.weeks).toHaveLength(8)
  })

  it('flags a full week 50% above the 4-week median as high', () => {
    const r = computeWeeklySpendDrift(withBaseline(1500), SUNDAY)
    expect(r).toMatchObject({ currentWeekTotal: 1500, currentWeekDays: 7, median4w: 1000, expectedSoFar: 1000, driftPct: 50, wowPct: 50, status: 'high' })
  })

  it('flags 6-20% above baseline as watch', () => {
    expect(computeWeeklySpendDrift(withBaseline(1100), SUNDAY).status).toBe('watch')
    expect(computeWeeklySpendDrift(withBaseline(1200), SUNDAY).status).toBe('watch')
    expect(computeWeeklySpendDrift(withBaseline(1210), SUNDAY).status).toBe('high')
  })

  it('treats 5% above or anything below as healthy, with honest wording', () => {
    const slightlyAbove = computeWeeklySpendDrift(withBaseline(1050), SUNDAY)
    expect(slightlyAbove.status).toBe('healthy')
    expect(slightlyAbove.guidance).toContain('5% above your usual pace')
    expect(slightlyAbove.guidance).not.toContain('below')

    const below = computeWeeklySpendDrift(withBaseline(800), SUNDAY)
    expect(below).toMatchObject({ driftPct: -20, status: 'healthy' })
    expect(below.guidance).toContain('20% below your usual pace')

    expect(computeWeeklySpendDrift(withBaseline(1000), SUNDAY).guidance).toContain('right on your usual pace')
  })

  it('compares a part week with the same share of a normal week', () => {
    // 3 of 7 days: a 1000 median means about 429 is normal by Wednesday.
    const r = computeWeeklySpendDrift(withBaseline(400), NOW)
    expect(r).toMatchObject({ currentWeekDays: 3, median4w: 1000, expectedSoFar: 429, driftPct: -7, status: 'healthy' })
    expect(r.guidance).toContain('so far')
    expect(r.weeks.at(-1).baseline).toBe(429)
    expect(r.weeks.at(-2).baseline).toBe(1000)

    expect(computeWeeklySpendDrift(withBaseline(600), NOW).status).toBe('high')
  })

  it('counts the current week only up to today', () => {
    const r = computeWeeklySpendDrift({ ...withBaseline(1000), '2026-01-16': 5000 }, NOW)
    expect(r.currentWeekTotal).toBe(1000)
  })

  it('ignores empty weeks when taking the median', () => {
    const r = computeWeeklySpendDrift(withBaseline(2000, [1000, 0, 3000, 2000]), SUNDAY)
    expect(r.median4w).toBe(2000)
    expect(r.wowPct).toBe(100)
  })

  it('gives no drift until there is a baseline', () => {
    const r = computeWeeklySpendDrift(totals([['2026-01-13', 700]]), NOW)
    expect(r).toMatchObject({ hasData: true, driftPct: null, wowPct: null, status: 'healthy' })
    expect(r.guidance).toContain('Build a few active weeks')
  })
})

describe('countsTowardWeeklyDrift', () => {
  it('keeps everyday spending', () => {
    expect(countsTowardWeeklyDrift({ category: 'food', is_repayment: false })).toBe(true)
    expect(countsTowardWeeklyDrift({ category: null })).toBe(true)
  })

  it('leaves out repayments and fixed monthly outgoings', () => {
    expect(countsTowardWeeklyDrift({ category: 'food', is_repayment: true })).toBe(false)
    for (const category of ['rent', 'emi', 'bills', 'insurance', 'loans', 'credit_card', 'taxes']) {
      expect(countsTowardWeeklyDrift({ category })).toBe(false)
    }
    expect(countsTowardWeeklyDrift(null)).toBe(false)
  })
})
