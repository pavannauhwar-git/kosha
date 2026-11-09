import { describe, it, expect } from 'vitest'
import { computeWeeklySpendDrift } from '../../../../src/lib/weeklyDrift'

// Wednesday 14 Jan 2026; the current week starts Monday 12 Jan.
const NOW = new Date(2026, 0, 14, 9, 30)
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

  it('flags a week 50% above the 4-week median as high', () => {
    const r = computeWeeklySpendDrift(withBaseline(1500), NOW)
    expect(r).toMatchObject({ currentWeekTotal: 1500, median4w: 1000, driftPct: 50, wowPct: 50, status: 'high' })
  })

  it('flags 6-20% above baseline as watch', () => {
    expect(computeWeeklySpendDrift(withBaseline(1100), NOW).status).toBe('watch')
    expect(computeWeeklySpendDrift(withBaseline(1200), NOW).status).toBe('watch')
    expect(computeWeeklySpendDrift(withBaseline(1210), NOW).status).toBe('high')
  })

  it('treats 5% above or anything below as healthy', () => {
    expect(computeWeeklySpendDrift(withBaseline(1050), NOW).status).toBe('healthy')
    const below = computeWeeklySpendDrift(withBaseline(800), NOW)
    expect(below).toMatchObject({ driftPct: -20, status: 'healthy' })
    expect(below.guidance).toContain('20% below baseline')
  })

  it('counts the current week only up to today', () => {
    const r = computeWeeklySpendDrift({ ...withBaseline(1000), '2026-01-16': 5000 }, NOW)
    expect(r.currentWeekTotal).toBe(1000)
  })

  it('ignores empty weeks when taking the median', () => {
    const r = computeWeeklySpendDrift(withBaseline(2000, [1000, 0, 3000, 2000]), NOW)
    expect(r.median4w).toBe(2000)
    expect(r.wowPct).toBe(100)
  })

  it('gives no drift until there is a baseline', () => {
    const r = computeWeeklySpendDrift(totals([['2026-01-13', 700]]), NOW)
    expect(r).toMatchObject({ hasData: true, driftPct: null, wowPct: null, status: 'healthy' })
    expect(r.guidance).toContain('Build a few active weeks')
  })
})
