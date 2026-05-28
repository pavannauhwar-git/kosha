import { useMemo } from 'react'

/** Build a conic-gradient with a 1-degree gap between segments for clarity */
function buildConicGradient(rows) {
  const safeRows = (Array.isArray(rows) ? rows : []).filter((row) => row != null && Number(row.value || 0) > 0)
  if (!safeRows.length) return 'conic-gradient(var(--ds-border) 0% 100%)'

  const total      = safeRows.reduce((sum, row) => sum + Number(row.value || 0), 0) || 1
  const GAP_DEG    = 1.2   // visual gap in degrees between segments
  const TOTAL_DEGS = 360
  let cursor = 0

  const segments = []
  safeRows.forEach((row, i) => {
    const share   = (Number(row.value || 0) / total) * TOTAL_DEGS
    const isLast  = i === safeRows.length - 1
    const start   = cursor
    const end     = isLast ? TOTAL_DEGS : Math.max(0, cursor + share - GAP_DEG)

    // Gap fill using surface color
    if (i > 0) {
      segments.push(`var(--ds-surface) ${cursor - GAP_DEG / 2}deg ${cursor}deg`)
    }

    segments.push(`${row.color} ${start.toFixed(2)}deg ${Math.max(start + 0.5, end).toFixed(2)}deg`)
    cursor += share
  })

  return `conic-gradient(from -90deg, ${segments.join(', ')})`
}

export default function PortfolioMixDonut({
  rows = [],
  centerTop    = 'Total',
  centerValue  = '—',
  centerBottom = 'Allocation',
  ringSize     = 128,
  innerInset   = 18,
}) {
  const gradient = useMemo(() => buildConicGradient(rows), [rows])
  const hasData  = rows.some((r) => Number(r?.value || 0) > 0)

  return (
    <div
      className="relative shrink-0"
      style={{ width: ringSize, height: ringSize }}
      aria-label="Portfolio allocation donut chart"
      role="img"
    >
      {/* Ring */}
      <div
        className="w-full h-full rounded-full"
        style={{
          background: gradient,
          boxShadow: hasData ? 'var(--ds-shadow-sm)' : 'none',
        }}
      />

      {/* Inner hole */}
      <div
        className="absolute rounded-full flex flex-col items-center justify-center text-center overflow-hidden"
        style={{
          top: innerInset,
          right: innerInset,
          bottom: innerInset,
          left: innerInset,
          background: 'var(--ds-surface)',
          border: '1px solid var(--ds-border)',
        }}
      >
        <p className="text-[9px] text-ink-3 leading-none mb-0.5">{centerTop}</p>
        <p className="text-[12px] font-bold tabular-nums text-ink leading-tight px-1">{centerValue}</p>
        <p className="text-[8px] text-ink-3 leading-none mt-0.5">{centerBottom}</p>
      </div>
    </div>
  )
}
