/**
 * Reconciliation matching quality metrics & drift detection
 */

export function calculateConfidenceMetrics(rows, timeWindowDays = 7) {
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

  const confidence =
    total > 0 ? Math.round((linked / total) * 100) : null

  return { linked, rejected, confidence, sample: total }
}

export function detectConfidenceDrift(rows) {
  if (!rows || rows.length < 5) {
    return { drifting: false, recent: null, baseline: null, drift: null }
  }

  const recent = calculateConfidenceMetrics(rows, 7)
  const baseline = calculateConfidenceMetrics(rows, 30)

  // Need sufficient data in both windows
  if (recent.sample < 2 || baseline.sample < 3) {
    return { drifting: false, recent, baseline, drift: null }
  }

  if (recent.confidence === null || baseline.confidence === null) {
    return { drifting: false, recent, baseline, drift: null }
  }

  const drift = baseline.confidence - recent.confidence
  const drifting = drift > 15 // Threshold: >15% drop from baseline

  return { drifting, recent, baseline, drift }
}

export function isRejected(row) {
  return String(row?.statement_line || '').startsWith('REJECTED:')
}

export function getDriftMessage(drift) {
  if (!drift || !drift.drifting) return null

  const { recent, baseline, drift: driftValue } = drift
  const advice =
    driftValue > 25
      ? 'Consider resetting aliases or reviewing recent decisions to improve matching accuracy.'
      : 'Monitor upcoming decisions closely—confidence is temporarily below baseline.'

  return {
    title: 'Matching Confidence Drifting',
    message: `7-day confidence at ${recent.confidence}%, baseline ${baseline.confidence}%. ${advice}`,
    severity: driftValue > 25 ? 'warning' : 'info',
  }
}

/**
 * Identify aliases that appear in rejected matches and should be demoted
 * Returns a Set of alias statement strings to exclude from future matching
 */
export function identifyDemotedAliases(rows, transactions, threshold = 2, timeWindowDays = 30) {
  if (!rows || rows.length === 0) {
    return new Set()
  }

  const now = new Date()
  const windowMs = timeWindowDays * 24 * 60 * 60 * 1000
  const cutoffTime = new Date(now.getTime() - windowMs).toISOString()

  // Get rejected rows in the time window
  const rejectedInWindow = rows.filter((row) => {
    const isRejectedRow = isRejected(row)
    const updatedAt = String(row.updated_at || '')
    return isRejectedRow && updatedAt >= cutoffTime
  })

  if (rejectedInWindow.length === 0) {
    return new Set()
  }

  // Extract statement lines from rejected rows
  const rejectedStatementLines = rejectedInWindow
    .map((row) => {
      const line = String(row?.statement_line || '')
      return line.startsWith('REJECTED:') ? line.slice(9).trim() : line
    })
    .filter(Boolean)

  // Count occurrences by merchant (first part of statement line)
  const rejectionCounts = new Map()
  for (const line of rejectedStatementLines) {
    const merchant = line.split(/[,|]/)[0]?.trim() || line
    rejectionCounts.set(merchant, (rejectionCounts.get(merchant) || 0) + 1)
  }

  // Return merchants that exceed rejection threshold
  const demoted = new Set()
  for (const [merchant, count] of rejectionCounts.entries()) {
    if (count >= threshold) {
      demoted.add(merchant)
    }
  }

  return demoted
}

/**
 * Calculate quality score for each learned alias based on success/rejection ratio
 * Returns array of {merchant, successCount, rejectionCount, qualityScore} sorted by quality
 */
export function calculateAliasQuality(rows, transactions, timeWindowDays = 30) {
  if (!rows || rows.length === 0) {
    return []
  }

  const now = new Date()
  const windowMs = timeWindowDays * 24 * 60 * 60 * 1000
  const cutoffTime = new Date(now.getTime() - windowMs).toISOString()

  // Filter rows in time window
  const windowRows = rows.filter((row) => {
    const updatedAt = String(row.updated_at || '')
    return updatedAt >= cutoffTime
  })

  // Track success and rejection counts by merchant
  const aliasStats = new Map()

  // Count linked (successful) matches
  for (const row of windowRows) {
    if (row?.status !== 'linked' || !row?.statement_line) continue
    const merchant = row.statement_line.split(/[,|]/)[0]?.trim() || row.statement_line
    if (!aliasStats.has(merchant)) {
      aliasStats.set(merchant, { successCount: 0, rejectionCount: 0 })
    }
    aliasStats.get(merchant).successCount += 1
  }

  // Count rejected matches
  for (const row of windowRows) {
    if (!isRejected(row) || !row?.statement_line) continue
    const line = String(row.statement_line || '')
    const cleanLine = line.startsWith('REJECTED:') ? line.slice(9).trim() : line
    const merchant = cleanLine.split(/[,|]/)[0]?.trim() || cleanLine
    if (!aliasStats.has(merchant)) {
      aliasStats.set(merchant, { successCount: 0, rejectionCount: 0 })
    }
    aliasStats.get(merchant).rejectionCount += 1
  }

  // Calculate quality score and build result array
  const aliasQualities = []
  for (const [merchant, stats] of aliasStats.entries()) {
    const total = stats.successCount + stats.rejectionCount
    if (total === 0) continue
    const qualityScore = Math.round((stats.successCount / total) * 100)
    aliasQualities.push({
      merchant,
      successCount: stats.successCount,
      rejectionCount: stats.rejectionCount,
      qualityScore,
      total,
    })
  }

  // Sort by quality score descending
  return aliasQualities.sort((a, b) => b.qualityScore - a.qualityScore)
}

/**
 * Identify which demoted merchants are still in their cooldown window
 * Returns Set of merchants that cannot be re-learned yet
 */
export function identifyMerchantsInCooldown(rows, cooldownDays = 14) {
  if (!rows || rows.length === 0) {
    return new Set()
  }

  const now = new Date()
  const demoted = new Map() // merchant -> earliest_demotion_time

  // Find the earliest demotion time for each merchant (when it first reached 2 rejections)
  const rejectionCounts = new Map()
  const timelines = new Map() // merchant -> array of rejection timestamps

  for (const row of rows) {
    if (!isRejected(row) || !row?.statement_line) continue
    const line = String(row.statement_line || '')
    const cleanLine = line.startsWith('REJECTED:') ? line.slice(9).trim() : line
    const merchant = cleanLine.split(/[,|]/)[0]?.trim() || cleanLine
    const rejectedAt = new Date(row.updated_at || 0).getTime()

    if (!timelines.has(merchant)) {
      timelines.set(merchant, [])
    }
    timelines.get(merchant).push(rejectedAt)
  }

  // For each merchant, find when it first hit 2 rejections
  for (const [merchant, times] of timelines.entries()) {
    times.sort((a, b) => a - b)
    if (times.length >= 2) {
      demoted.set(merchant, times[1]) // the timestamp of the 2nd rejection (when demotion happened)
    }
  }

  // Identify merchants still in cooldown (demoted within last cooldown period)
  const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000
  const inCooldown = new Set()

  for (const [merchant, demotionTime] of demoted.entries()) {
    const elapsedMs = now.getTime() - demotionTime
    if (elapsedMs < cooldownMs) {
      inCooldown.add(merchant)
    }
  }

  return inCooldown
}
