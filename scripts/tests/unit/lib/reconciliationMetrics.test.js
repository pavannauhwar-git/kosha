import { describe, it, expect } from 'vitest'
import {
  calculateConfidenceMetrics,
  detectConfidenceDrift,
  identifyDemotedAliases,
  identifyMerchantsInCooldown,
  calculateConfidenceTrend,
} from '../../../../src/lib/reconciliationMetrics'

function row({ status = 'linked', daysAgo = 1, statementLine = 'Merchant, 100' } = {}) {
  return {
    status,
    updated_at: new Date(Date.now() - (daysAgo * 24 * 60 * 60 * 1000)).toISOString(),
    statement_line: statementLine,
  }
}

describe('reconciliationMetrics', () => {
  it('returns empty results for no rows', () => {
    expect(calculateConfidenceMetrics([])).toMatchObject({ confidence: null, sample: 0 })
    expect(detectConfidenceDrift([]).drifting).toBe(false)
    expect(calculateConfidenceTrend([], 10)).toHaveLength(0)
  })

  it('scores all-linked as 100 and all-rejected as 0', () => {
    const allLinked = [row(), row(), row()]
    const allRejected = [
      row({ status: 'reviewed', statementLine: 'REJECTED:A, 10' }),
      row({ status: 'reviewed', statementLine: 'REJECTED:B, 20' }),
    ]
    expect(calculateConfidenceMetrics(allLinked, 7).confidence).toBe(100)
    expect(calculateConfidenceMetrics(allRejected, 7).confidence).toBe(0)
  })

  it('detects drift only when recent confidence drops', () => {
    const oldGood = [
      ...Array.from({ length: 16 }, (_, i) => row({ daysAgo: 15 + i * 0.01, statementLine: `OldGood${i}, 100` })),
      ...Array.from({ length: 2 }, (_, i) => row({ status: 'reviewed', daysAgo: 15 + i * 0.01, statementLine: `REJECTED:OldBad${i}, 100` })),
    ]
    const recentPoor = [
      row({ daysAgo: 2, statementLine: 'RecentGood0, 100' }),
      row({ daysAgo: 2, statementLine: 'RecentGood1, 100' }),
      row({ status: 'reviewed', daysAgo: 2, statementLine: 'REJECTED:RecentBad0, 100' }),
      row({ status: 'reviewed', daysAgo: 2, statementLine: 'REJECTED:RecentBad1, 100' }),
      row({ status: 'reviewed', daysAgo: 2, statementLine: 'REJECTED:RecentBad2, 100' }),
    ]
    expect(detectConfidenceDrift([...oldGood, ...recentPoor]).drifting).toBe(true)

    const stable = Array.from({ length: 20 }, (_, i) => (i % 5 === 0
      ? row({ status: 'reviewed', daysAgo: i < 10 ? 2 : 18, statementLine: `REJECTED:Stable${i}, 100` })
      : row({ daysAgo: i < 10 ? 2 : 18, statementLine: `Stable${i}, 100` })))
    expect(detectConfidenceDrift(stable).drifting).toBe(false)
  })

  it('demotes aliases after repeated rejections and puts them in cooldown', () => {
    // Statement lines are "date, description, amount".
    const rows = [
      row({ status: 'reviewed', daysAgo: 2, statementLine: 'REJECTED:2026-01-05, Swiggy, 100' }),
      row({ status: 'reviewed', daysAgo: 1, statementLine: 'REJECTED:2026-01-06, Swiggy, 120' }),
      row({ status: 'reviewed', daysAgo: 3, statementLine: 'REJECTED:2026-01-04, Uber, 300' }),
      row({ status: 'reviewed', daysAgo: 2, statementLine: 'REJECTED:2026-01-05, Uber, 320' }),
      row({ status: 'reviewed', daysAgo: 25, statementLine: 'REJECTED:2025-12-10, Amazon, 500' }),
    ]
    const demoted = identifyDemotedAliases(rows, [], 2, 30)
    expect([demoted.has('Swiggy'), demoted.has('Uber'), demoted.has('Amazon')]).toEqual([true, true, false])
    const cooldown = identifyMerchantsInCooldown(rows, 14)
    expect([cooldown.has('Swiggy'), cooldown.has('Uber')]).toEqual([true, true])
  })

  it('builds one trend point per day', () => {
    const rows = [
      row({ daysAgo: 0, statementLine: 'TodayGood, 100' }),
      row({ status: 'reviewed', daysAgo: 0, statementLine: 'REJECTED:TodayBad, 100' }),
      row({ daysAgo: 1, statementLine: 'YesterdayGood, 200' }),
      row({ daysAgo: 1, statementLine: 'YesterdayGood2, 220' }),
    ]
    const trend = calculateConfidenceTrend(rows, 7)
    expect(trend).toHaveLength(7)
    const latest = trend[trend.length - 1]
    expect(typeof latest.date).toBe('string')
    expect(latest.total).toBe(2)
    expect(latest.confidence).toBe(50)
  })
})
