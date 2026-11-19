// Chart axis label in the Indian system: 950, 12k, 1.2L, 3.4Cr.
export function compactTick(value) {
  const n = Number(value || 0)
  const abs = Math.abs(n)
  if (abs >= 10_000_000) return `${Math.round((n / 10_000_000) * 10) / 10}Cr`
  if (abs >= 100_000) return `${Math.round((n / 100_000) * 10) / 10}L`
  if (abs >= 1_000) return `${Math.round(n / 1_000)}k`
  return `${Math.round(n)}`
}
