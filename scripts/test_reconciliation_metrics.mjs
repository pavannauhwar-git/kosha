import assert from 'assert'
import {
  calculateConfidenceMetrics,
  detectConfidenceDrift,
  identifyDemotedAliases,
  identifyMerchantsInCooldown,
  calculateConfidenceTrend,
} from '../src/lib/reconciliationMetrics.js'

function row({ status = 'linked', daysAgo = 1, statementLine = 'Merchant, 100' } = {}) {
  return {
    status,
    updated_at: new Date(Date.now() - (daysAgo * 24 * 60 * 60 * 1000)).toISOString(),
    statement_line: statementLine,
  }
}

function testEmptyRows() {
  const metrics = calculateConfidenceMetrics([])
  assert.strictEqual(metrics.confidence, null, 'Empty rows should return null confidence')
  assert.strictEqual(metrics.sample, 0, 'Empty rows should have 0 sample')

  const drift = detectConfidenceDrift([])
  assert.strictEqual(drift.drifting, false, 'Empty rows should not detect drift')

  const trend = calculateConfidenceTrend([], 10)
  assert.strictEqual(trend.length, 0, 'Empty rows should return empty trend')
}

function testConfidenceBoundaries() {
  const allLinked = [row({ status: 'linked' }), row({ status: 'linked' }), row({ status: 'linked' })]
  const allRejected = [
    row({ status: 'reviewed', statementLine: 'REJECTED:A, 10' }),
    row({ status: 'reviewed', statementLine: 'REJECTED:B, 20' }),
  ]

  assert.strictEqual(calculateConfidenceMetrics(allLinked, 7).confidence, 100, 'All linked should be 100%')
  assert.strictEqual(calculateConfidenceMetrics(allRejected, 7).confidence, 0, 'All rejected should be 0%')
}

function testDriftDetection() {
  const oldGood = [
    ...Array.from({ length: 16 }, (_, i) => row({ status: 'linked', daysAgo: 15 + i * 0.01, statementLine: `OldGood${i}, 100` })),
    ...Array.from({ length: 2 }, (_, i) => row({ status: 'reviewed', daysAgo: 15 + i * 0.01, statementLine: `REJECTED:OldBad${i}, 100` })),
  ]

  const recentPoor = [
    row({ status: 'linked', daysAgo: 2, statementLine: 'RecentGood0, 100' }),
    row({ status: 'linked', daysAgo: 2, statementLine: 'RecentGood1, 100' }),
    row({ status: 'reviewed', daysAgo: 2, statementLine: 'REJECTED:RecentBad0, 100' }),
    row({ status: 'reviewed', daysAgo: 2, statementLine: 'REJECTED:RecentBad1, 100' }),
    row({ status: 'reviewed', daysAgo: 2, statementLine: 'REJECTED:RecentBad2, 100' }),
  ]

  const drift = detectConfidenceDrift([...oldGood, ...recentPoor])
  assert.strictEqual(drift.drifting, true, 'Should detect drift when recent confidence drops materially')

  const stable = Array.from({ length: 20 }, (_, i) =>
    i % 5 === 0
      ? row({ status: 'reviewed', daysAgo: i < 10 ? 2 : 18, statementLine: `REJECTED:Stable${i}, 100` })
      : row({ status: 'linked', daysAgo: i < 10 ? 2 : 18, statementLine: `Stable${i}, 100` })
  )

  assert.strictEqual(detectConfidenceDrift(stable).drifting, false, 'Should not drift when confidence stays similar')
}

function testDemotionAndCooldown() {
  const rows = [
    row({ status: 'reviewed', daysAgo: 2, statementLine: 'REJECTED:Swiggy, 100' }),
    row({ status: 'reviewed', daysAgo: 1, statementLine: 'REJECTED:Swiggy, 120' }),
    row({ status: 'reviewed', daysAgo: 3, statementLine: 'REJECTED:Uber, 300' }),
    row({ status: 'reviewed', daysAgo: 2, statementLine: 'REJECTED:Uber, 320' }),
    row({ status: 'reviewed', daysAgo: 25, statementLine: 'REJECTED:Amazon, 500' }),
  ]

  const demoted = identifyDemotedAliases(rows, [], 2, 30)
  assert.strictEqual(demoted.has('Swiggy'), true, 'Swiggy should be demoted at 2 rejections')
  assert.strictEqual(demoted.has('Uber'), true, 'Uber should be demoted at 2+ rejections')
  assert.strictEqual(demoted.has('Amazon'), false, 'Amazon should not be demoted with one rejection')

  const inCooldown = identifyMerchantsInCooldown(rows, 14)
  assert.strictEqual(inCooldown.has('Swiggy'), true, 'Swiggy should be in cooldown after recent demotion')
  assert.strictEqual(inCooldown.has('Uber'), true, 'Uber should be in cooldown after recent demotion')
}

function testTrendSeries() {
  const rows = [
    row({ status: 'linked', daysAgo: 0, statementLine: 'TodayGood, 100' }),
    row({ status: 'reviewed', daysAgo: 0, statementLine: 'REJECTED:TodayBad, 100' }),
    row({ status: 'linked', daysAgo: 1, statementLine: 'YesterdayGood, 200' }),
    row({ status: 'linked', daysAgo: 1, statementLine: 'YesterdayGood2, 220' }),
  ]

  const trend = calculateConfidenceTrend(rows, 7)
  assert.strictEqual(trend.length, 7, 'Trend should include one point per requested day')

  const latest = trend[trend.length - 1]
  assert.strictEqual(typeof latest.date, 'string', 'Trend row should include date')
  assert.strictEqual(latest.total, 2, 'Latest day should include two total signals')
  assert.strictEqual(latest.confidence, 50, 'Latest day confidence should be linked/(linked+rejected)')
}

console.log('Running reconciliation metrics tests...\n')

try {
  testEmptyRows()
  console.log('✓ Empty rows and null confidence behavior')

  testConfidenceBoundaries()
  console.log('✓ Confidence boundaries (0% and 100%)')

  testDriftDetection()
  console.log('✓ Drift threshold behavior')

  testDemotionAndCooldown()
  console.log('✓ Alias demotion and cooldown logic')

  testTrendSeries()
  console.log('✓ Daily confidence trend generation')

  console.log('\nPASS: reconciliation metrics test suite is healthy.')
} catch (error) {
  console.error('FAIL:', error.message)
  process.exit(1)
}
