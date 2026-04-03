import { useMemo } from 'react'

function buildConicGradient(rows) {
  const safeRows = (Array.isArray(rows) ? rows : []).filter((row) => Number(row?.value || 0) > 0)
  if (!safeRows.length) return 'conic-gradient(rgba(16,33,63,0.08) 0% 100%)'

  const total = safeRows.reduce((sum, row) => sum + Number(row.value || 0), 0) || 1
  let cursor = 0

  const segments = safeRows.map((row) => {
    const share = (Number(row.value || 0) / total) * 100
    const start = cursor
    cursor += share
    const end = Math.min(100, cursor)
    return `${row.color} ${start.toFixed(2)}% ${end.toFixed(2)}%`
  })

  if (cursor < 100) {
    segments.push(`rgba(16,33,63,0.08) ${cursor.toFixed(2)}% 100%`)
  }

  return `conic-gradient(${segments.join(', ')})`
}

export default function PortfolioMixDonut({
  rows = [],
  centerTop = 'Total',
  centerValue = '—',
  centerBottom = 'Allocation',
  ringSize = 152,
  innerInset = 20,
}) {
  const gradient = useMemo(() => buildConicGradient(rows), [rows])

  return (
    <div
      className="relative shrink-0"
      style={{ width: ringSize, height: ringSize }}
      aria-label="Portfolio allocation donut"
      role="img"
    >
      <div
        className="w-full h-full rounded-full"
        style={{ background: gradient }}
      />
      <div
        className="absolute rounded-full bg-kosha-surface border border-kosha-border flex flex-col items-center justify-center text-center"
        style={{
          top: innerInset,
          right: innerInset,
          bottom: innerInset,
          left: innerInset,
        }}
      >
        <p className="text-[9px] text-ink-3">{centerTop}</p>
        <p className="text-[12px] font-bold tabular-nums text-ink leading-tight px-1">{centerValue}</p>
        <p className="text-[8px] text-ink-3">{centerBottom}</p>
      </div>
    </div>
  )
}
