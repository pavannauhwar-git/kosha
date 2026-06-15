/**
 * Reconciliation matching quality metrics & drift detection
 */

export function calculateConfidenceMetrics(rows, timeWindowDays = 7) {
  if (!rows || rows.length === 0) {
    return { linked: 0, rejected: 0, confidence: null, sample: 0 }
  }

  const now = new Date()
  const windowMs = timeWindowDays * 24 * 60 * 60 * 1000
  const cutoffTime = new Date(now.getTime() - windowMs)

  const windowRows = rows.filter((row) => {
    if (!row.updated_at) return false
    const updatedAt = new Date(row.updated_at)
    if (Number.isNaN(updatedAt.getTime())) return false
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

function isRejected(row) {
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

export function identifyDemotedAliases(rows, transactions, threshold = 2, timeWindowDays = 30) {
  if (!rows || rows.length === 0) {
    return new Set()
  }

  const now = new Date()
  const windowMs = timeWindowDays * 24 * 60 * 60 * 1000
  const cutoffTime = new Date(now.getTime() - windowMs)

  const rejectedInWindow = rows.filter((row) => {
    if (!isRejected(row) || !row.updated_at) return false
    const updatedAt = new Date(row.updated_at)
    if (Number.isNaN(updatedAt.getTime())) return false
    return updatedAt >= cutoffTime
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

export function calculateAliasQuality(rows, transactions, timeWindowDays = 30) {
  if (!rows || rows.length === 0) {
    return []
  }

  const now = new Date()
  const windowMs = timeWindowDays * 24 * 60 * 60 * 1000
  const cutoffTime = new Date(now.getTime() - windowMs)

  const windowRows = rows.filter((row) => {
    if (!row.updated_at) return false
    const updatedAt = new Date(row.updated_at)
    if (Number.isNaN(updatedAt.getTime())) return false
    return updatedAt >= cutoffTime
  })

  const aliasStats = new Map()

  for (const row of windowRows) {
    if (row?.status !== 'linked' || !row?.statement_line) continue
    const merchant = row.statement_line.split(/[,|]/)[0]?.trim() || row.statement_line
    if (!aliasStats.has(merchant)) {
      aliasStats.set(merchant, { successCount: 0, rejectionCount: 0 })
    }
    aliasStats.get(merchant).successCount += 1
  }

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

  return aliasQualities.sort((a, b) => b.qualityScore - a.qualityScore)
}

export function identifyMerchantsInCooldown(rows, cooldownDays = 14) {
  if (!rows || rows.length === 0) {
    return new Set()
  }

  const now = new Date()
  const demoted = new Map()
  const timelines = new Map()

  for (const row of rows) {
    if (!isRejected(row) || !row?.statement_line) continue
    const line = String(row.statement_line || '')
    const cleanLine = line.startsWith('REJECTED:') ? line.slice(9).trim() : line
    const merchant = cleanLine.split(/[,|]/)[0]?.trim() || cleanLine
    
    // Instead of defaulting to epoch zero, ignore invalid dates for cooldown tracking
    if (!row.updated_at) continue
    const date = new Date(row.updated_at)
    if (Number.isNaN(date.getTime())) continue
    
    const rejectedAt = date.getTime()

    if (!timelines.has(merchant)) {
      timelines.set(merchant, [])
    }
    timelines.get(merchant).push(rejectedAt)
  }

  for (const [merchant, times] of timelines.entries()) {
    times.sort((a, b) => a - b)
    if (times.length >= 2) {
      demoted.set(merchant, times[1])
    }
  }

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

export function calculateConfidenceTrend(rows, trendDays = 30) {
  if (!rows || rows.length === 0) {
    return []
  }

  const now = new Date()
  const dailyStats = new Map()

  for (const row of rows) {
    const updatedAt = String(row.updated_at || '')
    const date = new Date(updatedAt)
    const dayKey = (!updatedAt || Number.isNaN(date.getTime())) ? 'unknown' : date.toISOString().split('T')[0]

    if (!dailyStats.has(dayKey)) {
      dailyStats.set(dayKey, { linked: 0, rejected: 0 })
    }

    const stats = dailyStats.get(dayKey)
    if (row?.status === 'linked' && !isRejected(row)) {
      stats.linked += 1
    } else if (isRejected(row)) {
      stats.rejected += 1
    }
  }

  const trend = []
  
  if (dailyStats.has('unknown')) {
    const stats = dailyStats.get('unknown')
    const total = stats.linked + stats.rejected
    if (total > 0) {
      const confidence = Math.round((stats.linked / total) * 100)
      trend.push({
        date: 'unknown',
        dateShort: 'Unknown',
        confidence,
        linked: stats.linked,
        rejected: stats.rejected,
        total,
      })
    }
  }
  
  for (let i = trendDays - 1; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)
    const dayKey = date.toISOString().split('T')[0]

    const stats = dailyStats.get(dayKey) || { linked: 0, rejected: 0 }
    const total = stats.linked + stats.rejected
    const confidence = total > 0
      ? Math.round((stats.linked / total) * 100)
      : null

    trend.push({
      date: dayKey,
      dateShort: dayKey.slice(5),
      confidence,
      linked: stats.linked,
      rejected: stats.rejected,
      total,
    })
  }

  return trend
}
