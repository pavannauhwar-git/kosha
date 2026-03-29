import { fmt } from '../../../lib/utils'
import { C } from '../../../lib/colors'

export default function BreakdownCard({ earned, spent, invested, totalLabel = 'Total income' }) {
  const saved = Math.max(0, earned - spent - invested)
  const spentPct = earned > 0 ? Math.round((spent / earned) * 100) : 0
  const investedPct = earned > 0 ? Math.round((invested / earned) * 100) : 0
  const savedPct = Math.max(0, 100 - spentPct - investedPct)

  const SIZE = 120
  const SW = 8
  const R = (SIZE / 2) - SW
  const CX = SIZE / 2
  const CY = SIZE / 2
  const CIRC = 2 * Math.PI * R

  const LEFTOVER_COLOR = C.bills

  const segs = [
    { pct: spentPct, color: C.expense },
    { pct: investedPct, color: C.investText },
    { pct: savedPct, color: LEFTOVER_COLOR },
  ].filter(s => s.pct > 0)

  let offset = 0

  if (earned === 0) return null

  return (
    <div className="card p-5">
      <p className="section-label mb-3">Budget Breakdown</p>
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
            <span style={{ fontSize: 15, fontWeight: 700, color: LEFTOVER_COLOR, lineHeight: 1.1 }}>
              {savedPct}%
            </span>
            <span style={{ fontSize: 9, color: C.inkMuted }}>
              leftover
            </span>
          </div>
        </div>

        <div className="flex-1 space-y-3 pt-1">
          {[
            { label: 'Spent', val: spent, pct: spentPct, dot: C.expense, color: C.expense },
            { label: 'Invested', val: invested, pct: investedPct, dot: C.investText, color: C.investText },
            { label: 'Leftover', val: saved, pct: savedPct, dot: LEFTOVER_COLOR, color: LEFTOVER_COLOR },
          ].map(s => (
            <div key={s.label}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.dot }} />
                <span className="text-caption text-ink-3 flex-1">{s.label}</span>
                <span className="text-caption font-bold tabular-nums" style={{ color: s.color }}>
                  {s.pct}%
                </span>
              </div>
              <p className="text-caption text-ink-3 tabular-nums pl-4">{fmt(s.val)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-kosha-border">
        <div className="flex justify-between">
          <span className="text-caption text-ink-3">{totalLabel}</span>
          <span className="text-caption font-bold text-income-text tabular-nums">{fmt(earned)}</span>
        </div>
      </div>
    </div>
  )
}
