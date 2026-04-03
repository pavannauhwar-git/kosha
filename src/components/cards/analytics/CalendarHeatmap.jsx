import { useMemo, useState, useCallback } from 'react'
import { fmt } from '../../../lib/utils'

const WEEKDAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', '']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const INTENSITY_COLORS = [
  'bg-kosha-surface-2',           // 0 — no spend
  'bg-brand/20',                  // 1
  'bg-brand/40',                  // 2
  'bg-brand/60',                  // 3
  'bg-brand/80',                  // 4
  'bg-brand',                     // 5 — max
]

export default function CalendarHeatmap({ dailyTotals = {}, year, loading }) {
  const [activeDay, setActiveDay] = useState(null)

  const handleLeave = useCallback(() => setActiveDay(null), [])

  const { weeks, monthLabels, stats } = useMemo(() => {
    const jan1 = new Date(year, 0, 1)
    const dec31 = new Date(year, 11, 31)
    const startDow = (jan1.getDay() + 6) % 7 // Mon=0

    // Build all days in the year
    const days = []
    const d = new Date(jan1)
    while (d <= dec31) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const value = Number(dailyTotals[key] || 0)
      days.push({
        key,
        value,
        month: d.getMonth(),
        dayOfMonth: d.getDate(),
        label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', weekday: 'short' }),
      })
      d.setDate(d.getDate() + 1)
    }

    // Compute intensity thresholds
    const spendDays = days.filter((day) => day.value > 0)
    const maxSpend = Math.max(...spendDays.map((d) => d.value), 1)
    const totalSpend = spendDays.reduce((s, d) => s + d.value, 0)
    const avgSpend = spendDays.length > 0 ? totalSpend / spendDays.length : 0
    const peakDay = spendDays.length > 0
      ? spendDays.reduce((best, d) => (d.value > best.value ? d : best))
      : null

    // Assign intensity levels (0-5)
    const enrichedDays = days.map((day) => {
      if (day.value <= 0) return { ...day, level: 0 }
      const ratio = day.value / maxSpend
      const level = ratio > 0.8 ? 5 : ratio > 0.6 ? 4 : ratio > 0.4 ? 3 : ratio > 0.2 ? 2 : 1
      return { ...day, level }
    })

    // Pad start to align to Monday
    const padded = [...Array(startDow).fill(null), ...enrichedDays]
    while (padded.length % 7 !== 0) padded.push(null)

    // Split into weeks (columns for GitHub style)
    const weekCols = []
    for (let i = 0; i < padded.length; i += 7) {
      weekCols.push(padded.slice(i, i + 7))
    }

    // Month label positions (find first week where a month starts)
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
      stats: {
        activeDays: spendDays.length,
        totalSpend,
        avgSpend,
        peakDay,
        maxSpend,
      },
    }
  }, [dailyTotals, year])

  if (loading) {
    return (
      <div className="card p-4">
        <p className="section-label">Spend calendar</p>
        <div className="h-[140px] flex items-center justify-center">
          <p className="text-[11px] text-ink-3">Loading daily data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-4 md:p-5 overflow-hidden">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="section-label">Spend calendar</p>
          <p className="text-[11px] text-ink-3 mt-0.5">
            Daily spending intensity across {year}. Darker = higher spend.
          </p>
        </div>
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-pill border border-kosha-border bg-kosha-surface-2 text-ink-2">
          {stats.activeDays} active days
        </span>
      </div>

      {/* Active day tooltip */}
      <div className="h-5 mb-1">
        {activeDay ? (
          <p className="text-[11px] text-ink-2 font-semibold">
            {activeDay.label}: <span className="text-ink tabular-nums">{fmt(activeDay.value)}</span>
          </p>
        ) : (
          <p className="text-[10px] text-ink-3">Hover a cell to see daily spend.</p>
        )}
      </div>

      {/* Heatmap grid */}
      <div className="overflow-x-auto -mx-1 px-1 pb-1">
        <div className="min-w-[680px]">
          {/* Month labels */}
          <div className="flex gap-[3px] mb-1 ml-[28px]">
            {(() => {
              const cells = []
              let li = 0
              for (let wi = 0; wi < weeks.length; wi++) {
                if (li < monthLabels.length && monthLabels[li].weekIndex === wi) {
                  cells.push(
                    <div key={`ml-${wi}`} className="w-[11px] shrink-0">
                      <span className="text-[8px] text-ink-3 font-semibold">{monthLabels[li].label}</span>
                    </div>
                  )
                  li++
                } else {
                  cells.push(<div key={`ml-${wi}`} className="w-[11px] shrink-0" />)
                }
              }
              return cells
            })()}
          </div>

          <div className="flex gap-0">
            {/* Weekday labels */}
            <div className="flex flex-col gap-[3px] mr-1 shrink-0" style={{ width: 24 }}>
              {WEEKDAY_LABELS.map((label, i) => (
                <div key={`wl-${i}`} className="h-[11px] flex items-center justify-end">
                  <span className="text-[8px] text-ink-3">{label}</span>
                </div>
              ))}
            </div>

            {/* Week columns */}
            <div className="flex gap-[3px]" onMouseLeave={handleLeave}>
              {weeks.map((week, wi) => (
                <div key={`week-${wi}`} className="flex flex-col gap-[3px]">
                  {week.map((day, di) => {
                    if (!day) {
                      return <div key={`e-${wi}-${di}`} className="w-[11px] h-[11px]" />
                    }
                    return (
                      <div
                        key={day.key}
                        className={`w-[11px] h-[11px] rounded-[2px] border border-black/5 cursor-pointer transition-transform hover:scale-125 ${INTENSITY_COLORS[day.level]}`}
                        title={`${day.label}: ${fmt(day.value)}`}
                        onMouseEnter={() => setActiveDay(day)}
                        onFocus={() => setActiveDay(day)}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legend + stats */}
      <div className="flex items-center justify-between gap-4 mt-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-ink-3">Less</span>
          {INTENSITY_COLORS.map((cls, i) => (
            <div key={`leg-${i}`} className={`w-[11px] h-[11px] rounded-[2px] border border-black/5 ${cls}`} />
          ))}
          <span className="text-[9px] text-ink-3">More</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[9px] text-ink-3">Total spend</p>
            <p className="text-[11px] font-semibold tabular-nums text-ink">{fmt(stats.totalSpend)}</p>
          </div>
          <div className="text-right">
            <p className="text-[9px] text-ink-3">Avg/day</p>
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
