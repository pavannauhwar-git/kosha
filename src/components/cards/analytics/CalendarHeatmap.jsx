import { memo, useMemo, useState, useCallback, useRef } from 'react'
import { fmt } from '../../../lib/utils'
import { dayKey } from '../../../lib/dayKey'

/* ── Constants ─────────────────────────────────────────────────────────── */
const WEEKDAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', '']
const MONTH_SHORT    = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** CSS variable–based palette so it adapts to light and dark mode automatically.
 *  Level 0 = no spend (muted surface), 1-5 = spend intensity (brand blue ramp). */
const CELL_STYLES = [
  { bg: 'var(--ds-surface-bright)',         border: 'var(--ds-border)' },         // 0 — empty
  { bg: 'rgba(var(--ds-primary-rgb), 0.12)', border: 'rgba(var(--ds-primary-rgb), 0.20)' }, // 1
  { bg: 'rgba(var(--ds-primary-rgb), 0.28)', border: 'rgba(var(--ds-primary-rgb), 0.38)' }, // 2
  { bg: 'rgba(var(--ds-primary-rgb), 0.50)', border: 'rgba(var(--ds-primary-rgb), 0.60)' }, // 3
  { bg: 'rgba(var(--ds-primary-rgb), 0.72)', border: 'rgba(var(--ds-primary-rgb), 0.80)' }, // 4
  { bg: 'var(--ds-primary)',               border: 'var(--ds-primary-dark)' },    // 5 — max
]

const CELL_SIZE    = 13  // px — slightly bigger than the old 11px
const CELL_GAP     = 3   // px

/* ── HeatmapCell ──────────────────────────────────────────────────────── */
const HeatmapCell = memo(function HeatmapCell({ day, onHover, onLeave }) {
  const { bg, border } = CELL_STYLES[day.level]
  return (
    <div
      role="gridcell"
      aria-label={`${day.label}: ${fmt(day.value)}`}
      style={{
        width: CELL_SIZE,
        height: CELL_SIZE,
        borderRadius: 3,
        border: `1px solid ${border}`,
        backgroundColor: bg,
        cursor: 'default',
        transition: 'transform 120ms cubic-bezier(0.2,0,0,1)',
        flexShrink: 0,
      }}
      className="hover:scale-125 hover:z-10 relative"
      onMouseEnter={(e) => onHover(day, e)}
      onMouseLeave={onLeave}
      onFocus={(e) => onHover(day, e)}
      onBlur={onLeave}
    />
  )
})

/* ── Month sparkline bar ──────────────────────────────────────────────── */
function MonthSparkline({ monthTotals }) {
  const max = Math.max(...monthTotals.map((m) => m.total), 1)
  return (
    <div className="flex items-end gap-[3px] mt-3" style={{ height: 32 }}>
      {monthTotals.map((m) => {
        const pct = Math.max(2, Math.round((m.total / max) * 100))
        const hasSpend = m.total > 0
        return (
          <div
            key={m.month}
            className="flex-1 flex flex-col items-center justify-end gap-0.5 group"
            title={`${MONTH_SHORT[m.month]}: ${fmt(Math.round(m.total))}`}
          >
            <div
              style={{
                height: `${pct}%`,
                minHeight: hasSpend ? 3 : 0,
                borderRadius: 3,
                backgroundColor: hasSpend
                  ? 'var(--ds-primary)'
                  : 'var(--ds-surface-bright)',
                border: `1px solid ${hasSpend ? 'var(--ds-primary-dark)' : 'var(--ds-border)'}`,
                opacity: hasSpend ? 0.85 : 0.4,
                transition: 'height 300ms cubic-bezier(0.05,0.7,0.1,1)',
                width: '100%',
              }}
            />
          </div>
        )
      })}
    </div>
  )
}



/* ── CalendarHeatmap ──────────────────────────────────────────────────── */
export default function CalendarHeatmap({ dailyTotals = {}, year, loading }) {
  const [activeDay, setActiveDay] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const gridRef = useRef(null)

  const handleLeave = useCallback(() => setActiveDay(null), [])

  const handleCellHover = useCallback((day, e) => {
    setActiveDay(day)
    if (e && gridRef.current) {
      const rect = gridRef.current.getBoundingClientRect()
      setTooltipPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
    }
  }, [])

  const { weeks, monthLabels, stats, monthTotals } = useMemo(() => {
    const jan1  = new Date(year, 0, 1, 12, 0, 0)
    const dec31 = new Date(year, 11, 31, 12, 0, 0)
    const startDow = (jan1.getDay() + 6) % 7   // Mon = 0

    /* Build all days of the year */
    const days = []
    const monthSums = Array.from({ length: 12 }, (_, i) => ({ month: i, total: 0 }))
    const cursor = new Date(jan1)
    while (cursor <= dec31) {
      const key = dayKey(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate(), 12, 0, 0))
      const value = Number(dailyTotals[key] || 0)
      monthSums[cursor.getMonth()].total += value
      days.push({
        key,
        value,
        month: cursor.getMonth(),
        dayOfMonth: cursor.getDate(),
        label: cursor.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', weekday: 'short' }),
      })
      cursor.setDate(cursor.getDate() + 1)
    }

    /* Compute percentile thresholds for intensity */
    const spendDays  = days.filter((d) => d.value > 0)
    const maxSpend   = Math.max(...spendDays.map((d) => d.value), 1)
    const totalSpend = spendDays.reduce((s, d) => s + d.value, 0)
    const avgSpend   = spendDays.length > 0 ? totalSpend / spendDays.length : 0
    const peakDay    = spendDays.length > 0
      ? spendDays.reduce((best, d) => (d.value > best.value ? d : best))
      : null

    const sorted = spendDays.map((d) => d.value).sort((a, b) => a - b)
    const quantile = (q) => {
      if (!sorted.length) return 0
      const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * q)))
      return sorted[idx]
    }
    const q20 = quantile(0.2), q40 = quantile(0.4), q60 = quantile(0.6), q80 = quantile(0.8)
    const hasSpread = q80 > q20

    /* Assign 0-5 intensity levels */
    const enriched = days.map((day) => {
      if (day.value <= 0) return { ...day, level: 0 }
      let level = 1
      if (hasSpread) {
        level = day.value >= q80 ? 5 : day.value >= q60 ? 4 : day.value >= q40 ? 3 : day.value >= q20 ? 2 : 1
      } else {
        const ratio = day.value / maxSpend
        level = ratio >= 0.75 ? 5 : ratio >= 0.55 ? 4 : ratio >= 0.35 ? 3 : ratio >= 0.18 ? 2 : 1
      }
      return { ...day, level }
    })

    /* Pad & split into week columns (GitHub orientation: weeks = columns) */
    const padded = [...Array(startDow).fill(null), ...enriched]
    while (padded.length % 7 !== 0) padded.push(null)
    const weekCols = []
    for (let i = 0; i < padded.length; i += 7) weekCols.push(padded.slice(i, i + 7))

    /* Month label positions */
    const labels = []
    let lastMonth = -1
    weekCols.forEach((week, wi) => {
      for (const day of week) {
        if (day && day.month !== lastMonth) {
          labels.push({ weekIndex: wi, label: MONTH_SHORT[day.month] })
          lastMonth = day.month
          break
        }
      }
    })

    return {
      weeks: weekCols,
      monthLabels: labels,
      stats: { activeDays: spendDays.length, totalSpend, avgSpend, peakDay, maxSpend },
      monthTotals: monthSums,
    }
  }, [dailyTotals, year])

  /* Computed dimensions for the grid */
  const gridWidth  = weeks.length * (CELL_SIZE + CELL_GAP) - CELL_GAP
  const weekdayLabelWidth = 26

  if (loading) {
    return (
      <div className="card p-4">
        <p className="section-label">Spend calendar</p>
        <div className="h-[148px] flex items-center justify-center">
          <p className="text-[11px] text-ink-3">Loading daily data…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-4 md:p-5 overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="section-label">Spend calendar</p>
          <p className="text-[11px] text-ink-3 mt-0.5">
            Daily spending intensity across {year}. Darker = higher spend.
          </p>
        </div>
        <span className="text-[10px] font-semibold px-2.5 py-1 rounded-pill border border-kosha-border bg-kosha-surface-2 text-ink-2 shrink-0">
          {stats.activeDays} active days
        </span>
      </div>

      {/* ── Heatmap grid ───────────────────────────────────────────── */}
      <div className="overflow-x-auto -mx-1 px-1 pb-1" ref={gridRef} style={{ position: 'relative' }}>
        {/* Floating tooltip */}
        {activeDay && (
          <div
            className="pointer-events-none absolute z-20 px-2.5 py-1.5 rounded-card text-[11px] font-semibold text-ink shadow-card-md"
            style={{
              left: tooltipPos.x + 10,
              top: tooltipPos.y - 36,
              background: 'var(--ds-surface)',
              border: '1px solid var(--ds-border-strong)',
              whiteSpace: 'nowrap',
              boxShadow: 'var(--ds-shadow-md)',
              transform: 'translateX(var(--tooltip-shift, 0))',
            }}
          >
            <span className="text-ink-3">{activeDay.label}:&nbsp;</span>
            <span className="tabular-nums text-ink">{fmt(activeDay.value)}</span>
          </div>
        )}

        <div style={{ minWidth: weekdayLabelWidth + gridWidth }}>
          {/* Month labels row */}
          <div
            className="flex mb-1"
            style={{ marginLeft: weekdayLabelWidth, gap: CELL_GAP }}
          >
            {(() => {
              const cells = []
              let li = 0
              for (let wi = 0; wi < weeks.length; wi++) {
                if (li < monthLabels.length && monthLabels[li].weekIndex === wi) {
                  cells.push(
                    <div
                      key={`ml-${wi}`}
                      style={{ width: CELL_SIZE, flexShrink: 0 }}
                    >
                      <span className="text-[8px] text-ink-3 font-semibold leading-none">
                        {monthLabels[li].label}
                      </span>
                    </div>
                  )
                  li++
                } else {
                  cells.push(<div key={`ml-${wi}`} style={{ width: CELL_SIZE, flexShrink: 0 }} />)
                }
              }
              return cells
            })()}
          </div>

          {/* Weekday labels + week columns */}
          <div className="flex" style={{ gap: 0 }}>
            {/* Day-of-week labels */}
            <div
              className="flex flex-col shrink-0 mr-1"
              style={{ width: weekdayLabelWidth - 4, gap: CELL_GAP }}
            >
              {WEEKDAY_LABELS.map((label, i) => (
                <div
                  key={`wl-${i}`}
                  style={{ height: CELL_SIZE }}
                  className="flex items-center justify-end"
                >
                  <span className="text-[8px] text-ink-3 leading-none">{label}</span>
                </div>
              ))}
            </div>

            {/* Week columns */}
            <div
              className="flex"
              style={{ gap: CELL_GAP }}
              onMouseLeave={handleLeave}
            >
              {weeks.map((week, wi) => (
                <div key={`wk-${wi}`} className="flex flex-col" style={{ gap: CELL_GAP }}>
                  {week.map((day, di) => {
                    if (!day) {
                      return (
                        <div
                          key={`e-${wi}-${di}`}
                          style={{ width: CELL_SIZE, height: CELL_SIZE, flexShrink: 0 }}
                        />
                      )
                    }
                    return (
                      <HeatmapCell
                        key={day.key}
                        day={day}
                        onHover={handleCellHover}
                        onLeave={handleLeave}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Month sparkline ────────────────────────────────────────── */}
      <div className="mt-2">
        <MonthSparkline monthTotals={monthTotals} />
        <div className="flex justify-between mt-1">
          {MONTH_SHORT.map((m) => (
            <span key={m} className="text-[8px] text-ink-3 flex-1 text-center">{m}</span>
          ))}
        </div>
      </div>

      {/* ── Legend + stats row ─────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 mt-3 flex-wrap">
        {/* Legend */}
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-ink-3">Less</span>
          {CELL_STYLES.map(({ bg, border }, i) => (
            <div
              key={`leg-${i}`}
              style={{
                width: CELL_SIZE,
                height: CELL_SIZE,
                borderRadius: 3,
                backgroundColor: bg,
                border: `1px solid ${border}`,
                flexShrink: 0,
              }}
            />
          ))}
          <span className="text-[9px] text-ink-3">More</span>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[9px] text-ink-3">Total spend</p>
            <p className="text-[11px] font-semibold tabular-nums text-ink">{fmt(stats.totalSpend)}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-ink-3">Avg / active day</p>
            <p className="text-[11px] font-semibold tabular-nums text-ink">{fmt(Math.round(stats.avgSpend))}</p>
          </div>
          {stats.peakDay && (
            <div className="text-right">
              <p className="text-[9px] text-ink-3">Peak</p>
              <p className="text-[11px] font-semibold tabular-nums text-expense-text">{fmt(stats.maxSpend)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
