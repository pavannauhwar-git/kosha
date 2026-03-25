import { fmt } from '../../lib/utils'
import { C } from '../../lib/colors'

const PORTFOLIO_COLORS = C.portfolio

export default function PortfolioAllocation({ vehicleData }) {
  const total = vehicleData.reduce((s, [, v]) => s + (Number(v) || 0), 0)
  if (!vehicleData.length || total === 0) return null

  const SIZE = 120
  const SW = 8
  const R = SIZE / 2 - SW
  const CX = SIZE / 2
  const CY = SIZE / 2
  const CIRC = 2 * Math.PI * R

  const segs = vehicleData
    .map(([name, value], i) => ({
      name,
      value: Number(value) || 0,
      pct: total > 0 ? Math.round(((Number(value) || 0) / total) * 100) : 0,
      color: PORTFOLIO_COLORS[i % PORTFOLIO_COLORS.length],
    }))
    .filter(s => s.value > 0)

  let offset = 0

  return (
    <div className="card p-5">
      <p className="section-label mb-3">Portfolio Allocation</p>
      <div className="flex gap-4 items-center">
        <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            <circle cx={CX} cy={CY} r={R} fill="none" stroke={C.brandBorder} strokeWidth={SW} />
            {segs.map((seg, i) => {
              const dashLen = Math.max(0, (seg.pct / 100) * CIRC)
              const currentOffset = offset
              offset += seg.pct
              return (
                <circle
                  key={i}
                  cx={CX}
                  cy={CY}
                  r={R}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={SW}
                  strokeLinecap="butt"
                  strokeDasharray={`${dashLen} ${CIRC}`}
                  strokeDashoffset={-currentOffset * CIRC / 100}
                  transform={`rotate(-90 ${CX} ${CY})`}
                />
              )
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span style={{ fontSize: 12, fontWeight: 700, color: C.ink, lineHeight: 1.1 }}>{fmt(total, true)}</span>
            <span style={{ fontSize: 9, color: C.inkMuted }}>total</span>
          </div>
        </div>

        <div className="flex-1 space-y-3 pt-1 min-w-0">
          {segs.map(seg => (
            <div key={seg.name}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: seg.color }} />
                <span className="text-caption text-ink-3 flex-1 truncate">{seg.name}</span>
                <span className="text-caption font-bold tabular-nums text-ink">{seg.pct}%</span>
              </div>
              <p className="text-caption text-ink-3 tabular-nums pl-4">{fmt(seg.value)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
