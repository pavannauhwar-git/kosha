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
