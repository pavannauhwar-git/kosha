/**
 * Deterministic edge-case tests for reconciliation metrics (drift detection, alias demotion)
 */

import assert from 'assert'

// Simplified versions of metric functions for testing
function isRejected(row) {
  return String(row?.statement_line || '').startsWith('REJECTED:')
}

function calculateConfidenceMetrics(rows, timeWindowDays = 7) {
  if (!rows || rows.length === 0) {
    return { linked: 0, rejected: 0, confidence: null, sample: 0 }
  }

  const now = new Date()
  const windowMs = timeWindowDays * 24 * 60 * 60 * 1000
  const cutoffTime = new Date(now.getTime() - windowMs).toISOString()

  const windowRows = rows.filter((row) => {
    const updatedAt = String(row.updated_at || '')
    return updatedAt >= cutoffTime
  })

  const linked = windowRows.filter((row) => row?.status === 'linked' && !isRejected(row)).length
  const rejected = windowRows.filter((row) => isRejected(row)).length
  const total = linked + rejected

  const confidence = total > 0 ? Math.round((linked / total) * 100) : null

  return { linked, rejected, confidence, sample: total }
}

function detectConfidenceDrift(rows) {
  if (!rows || rows.length < 5) {
    return { drifting: false, recent: null, baseline: null, drift: null }
  }

  const recent = calculateConfidenceMetrics(rows, 7)
  const baseline = calculateConfidenceMetrics(rows, 30)

  if (recent.sample < 2 || baseline.sample < 3) {
    return { drifting: false, recent, baseline, drift: null }
  }

  if (recent.confidence === null || baseline.confidence === null) {
    return { drifting: false, recent, baseline, drift: null }
  }

  const drift = baseline.confidence - recent.confidence
  const drifting = drift > 15

  return { drifting, recent, baseline, drift }
}

function identifyDemotedAliases(rows, threshold = 2, timeWindowDays = 30) {
  if (!rows || rows.length === 0) {
    return new Set()
  }

  const now = new Date()
  const windowMs = timeWindowDays * 24 * 60 * 60 * 1000
  const cutoffTime = new Date(now.getTime() - windowMs).toISOString()

  const rejectedInWindow = rows.filter((row) => {
    const isRejectedRow = isRejected(row)
    const updatedAt = String(row.updated_at || '')
    return isRejectedRow && updatedAt >= cutoffTime
  })

  if (rejectedInWindow.length === 0) {
    return new Set()
  }

  const rejectedStatementLines = rejectedInWindow
    .map((row) => {
      const line = String(row?.statement_line || '')
      return line.startsWith('REJECTED:') ? line.slice(9).trim() : line
    })
    .filter(Boolean)

  const rejectionCounts = new Map()
  for (const line of rejectedStatementLines) {
    const merchant = line.split(/[,|]/)[0]?.trim() || line
    rejectionCounts.set(merchant, (rejectionCounts.get(merchant) || 0) + 1)
  }

  const demoted = new Set()
  for (const [merchant, count] of rejectionCounts.entries()) {
    if (count >= threshold) {
      demoted.add(merchant)
    }
  }

  return demoted
}

// ────────────────────────────────────────────────────────────────
// Edge-case tests
// ────────────────────────────────────────────────────────────────

function testEmptyRows() {
  const metrics = calculateConfidenceMetrics([])
  assert.strictEqual(metrics.confidence, null, 'Empty rows should return null confidence')
  assert.strictEqual(metrics.sample, 0, 'Empty rows should have 0 sample')

  const drift = detectConfidenceDrift([])
  assert.strictEqual(drift.drifting, false, 'Empty rows should not detect drift')
}

function testPerfectConfidence() {
  const now = new Date()
  const rows = [
    {
      status: 'linked',
      updated_at: new Date(now.getTime() - 1000).toISOString(),
      statement_line: 'Swiggy',
    },
    {
      status: 'linked',
      updated_at: new Date(now.getTime() - 2000).toISOString(),
      statement_line: 'Uber',
    },
    {
      status: 'linked',
      updated_at: new Date(now.getTime() - 3000).toISOString(),
      statement_line: 'Amazon',
    },
  ]
  const metrics = calculateConfidenceMetrics(rows, 7)
  assert.strictEqual(metrics.confidence, 100, 'All linked should be 100%')
}

function testZeroConfidence() {
  const now = new Date()
  const rows = [
    {
      status: 'reviewed',
      updated_at: new Date(now.getTime() - 1000).toISOString(),
      statement_line: 'REJECTED:Swiggy',
    },
    {
      status: 'reviewed',
      updated_at: new Date(now.getTime() - 2000).toISOString(),
      statement_line: 'REJECTED:Uber',
    },
    {
      status: 'reviewed',
      updated_at: new Date(now.getTime() - 3000).toISOString(),
      statement_line: 'REJECTED:Amazon',
    },
  ]
  const metrics = calculateConfidenceMetrics(rows, 7)
  assert.strictEqual(metrics.confidence, 0, 'All rejected should be 0%')
}

function testDriftThreshold() {
  const now = new Date()
  
  // To get 80% baseline (30 days) and 60% recent (7 days), we'll create:
  // - 8-12 days ago: 8 linked, 4 rejected (sample of 12, confidence 67%)
  // - 1-3 days ago: 3 linked, 2 rejected (sample of 5, confidence 60%)
  // Combined 30-day: 11 linked, 6 rejected = 65%, which triggers drift if recent is lower
  // Actually let's make it simpler: many old perfect rows + recent bad rows
  
  // 8-30 days ago: 16 linked, 2 rejected (17 total) = 94%
  const oldRows = Array.from({ length: 18 }, (_, i) => ({
    status: i < 16 ? 'linked' : 'reviewed',
    updated_at: new Date(now.getTime() - (15 * 24 * 60 * 60 * 1000) - i * 1000).toISOString(),
    statement_line: i < 16 ? `Old${i}` : `REJECTED:Old${i}`,
  }))

  // 1-3 days ago: 3 linked, 2 rejected (5 total) = 60%
  const recentRows = Array.from({ length: 5 }, (_, i) => ({
    status: i < 3 ? 'linked' : 'reviewed',
    updated_at: new Date(now.getTime() - (2 * 24 * 60 * 60 * 1000) - i * 1000).toISOString(),
    statement_line: i < 3 ? `Recent${i}` : `REJECTED:Recent${i}`,
  }))

  const allRows = [...oldRows, ...recentRows]
  const drift = detectConfidenceDrift(allRows)

  // Debug output
  console.log(`  Debug drift test:`)
  console.log(`    Recent: linked=${drift.recent?.linked}, rejected=${drift.recent?.rejected}, confidence=${drift.recent?.confidence}%`)
  console.log(`    Baseline: linked=${drift.baseline?.linked}, rejected=${drift.baseline?.rejected}, confidence=${drift.baseline?.confidence}%`)
  console.log(`    Drift value: ${drift.drift}, Drifting: ${drift.drifting}`)

  // 30-day: 19 linked, 4 rejected = 83%
  // 7-day: 3 linked, 2 rejected = 60%
  // Drift = 83 - 60 = 23 > 15, so drifting should be true
  assert.strictEqual(drift.drifting, true, 'Should detect drift when >15% drop')
}

function testDriftNoTrigger() {
  const now = new Date()
  // Both periods at 80%, no drift
  const rows = Array.from({ length: 20 }, (_, i) => ({
    status: i % 5 !== 4 ? 'linked' : 'reviewed',
    updated_at: new Date(now.getTime() - (i < 10 ? 20 * 24 * 60 * 60 * 1000 : 0) - i * 1000).toISOString(),
    statement_line: i % 5 !== 4 ? `Item${i}` : `REJECTED:Item${i}`,
  }))

  const drift = detectConfidenceDrift(rows)
  assert.strictEqual(drift.drifting, false, 'Should not drift when stable')
}

function testDemotionThreshold() {
  const now = new Date()
  // Swiggy rejected 2 times → should be demoted
  // Uber rejected 3 times → should be demoted
  // Amazon rejected 1 time → should NOT be demoted
  const rows = [
    { status: 'reviewed', updated_at: new Date(now.getTime() - 1000).toISOString(), statement_line: 'REJECTED:Swiggy, 100' },
    { status: 'reviewed', updated_at: new Date(now.getTime() - 2000).toISOString(), statement_line: 'REJECTED:Swiggy, 100' },
    { status: 'reviewed', updated_at: new Date(now.getTime() - 3000).toISOString(), statement_line: 'REJECTED:Uber, 200' },
    { status: 'reviewed', updated_at: new Date(now.getTime() - 4000).toISOString(), statement_line: 'REJECTED:Uber, 200' },
    { status: 'reviewed', updated_at: new Date(now.getTime() - 5000).toISOString(), statement_line: 'REJECTED:Uber, 200' },
    { status: 'reviewed', updated_at: new Date(now.getTime() - 6000).toISOString(), statement_line: 'REJECTED:Amazon, 300' },
  ]

  const demoted = identifyDemotedAliases(rows, 2, 30)
  assert.strictEqual(demoted.has('Swiggy'), true, 'Swiggy should be demoted (2 rejections)')
  assert.strictEqual(demoted.has('Uber'), true, 'Uber should be demoted (3 rejections)')
  assert.strictEqual(demoted.has('Amazon'), false, 'Amazon should NOT be demoted (1 rejection)')
}

function testDemotionTimeWindow() {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const thirtyOneDaysAgo = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000)

  const rows = [
    // Old rejection (outside 30-day window)
    { status: 'reviewed', updated_at: thirtyOneDaysAgo.toISOString(), statement_line: 'REJECTED:Swiggy, 100' },
    // Recent rejections (inside 30-day window)
    { status: 'reviewed', updated_at: new Date(thirtyDaysAgo.getTime() + 1000).toISOString(), statement_line: 'REJECTED:Swiggy, 100' },
    { status: 'reviewed', updated_at: new Date(thirtyDaysAgo.getTime() + 2000).toISOString(), statement_line: 'REJECTED:Swiggy, 100' },
  ]

  const demoted = identifyDemotedAliases(rows, 2, 30)
  assert.strictEqual(demoted.has('Swiggy'), true, 'Swiggy should be demoted (2 rejections within window)')
}

function testDemotionEmpty() {
  const demoted = identifyDemotedAliases([])
  assert.strictEqual(demoted.size, 0, 'Empty rows should return empty set')
}

// Run all tests
console.log('Running reconciliation metrics edge-case tests...\n')

try {
  testEmptyRows()
  console.log('✓ Empty rows handled correctly')

  testPerfectConfidence()
  console.log('✓ Perfect confidence (100%) calculated')

  testZeroConfidence()
  console.log('✓ Zero confidence (0%) calculated')

  testDriftThreshold()
  console.log('✓ Drift threshold (>15%) detected')

  testDriftNoTrigger()
  console.log('✓ Drift not triggered when stable')

  testDemotionThreshold()
  console.log('✓ Demotion threshold (≥2 rejections) applied')

  testDemotionTimeWindow()
  console.log('✓ Demotion respects 30-day time window')

  testDemotionEmpty()
  console.log('✓ Empty rows handled in demotion')

  console.log('\nPASS: reconciliation metrics edge cases are solid.')
} catch (error) {
  console.error('FAIL:', error.message)
  process.exit(1)
}
