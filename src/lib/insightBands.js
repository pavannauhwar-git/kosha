export const INSIGHT_BANDS = Object.freeze({
  high: 'high',
  watch: 'watch',
  healthy: 'healthy',
})

export function scoreRiskBand(value, { high, watch }) {
  const score = Number(value)
  if (!Number.isFinite(score)) return INSIGHT_BANDS.healthy
  if (score >= high) return INSIGHT_BANDS.high
  if (score >= watch) return INSIGHT_BANDS.watch
  return INSIGHT_BANDS.healthy
}

export function scoreHealthBand(value, { healthy, watch }) {
  const score = Number(value)
  if (!Number.isFinite(score)) return INSIGHT_BANDS.watch
  if (score >= healthy) return INSIGHT_BANDS.healthy
  if (score >= watch) return INSIGHT_BANDS.watch
  return INSIGHT_BANDS.high
}

export function bandTextClass(band, fallback = 'text-ink-3') {
  if (band === INSIGHT_BANDS.high) return 'text-warning-text'
  if (band === INSIGHT_BANDS.watch) return 'text-accent-text'
  if (band === INSIGHT_BANDS.healthy) return 'text-income-text'
  return fallback
}
