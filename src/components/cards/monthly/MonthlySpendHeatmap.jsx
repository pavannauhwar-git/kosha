import { memo, useMemo, useState, useCallback } from 'react'
import { fmt } from '../../../lib/utils'

const WEEKDAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun']

const INTENSITY_CLASSES = [
  'bg-kosha-surface-2',           // 0 — no spend
  'bg-brand/20',                  // 1
  'bg-brand/40',                  // 2
  'bg-brand/60',                  // 3
  'bg-brand/80',                  // 4
  'bg-brand',                     // 5 — max
]

const DayCell = memo(function DayCell({ day, maxSpend, onHover }) {
  const level = intensityLevel(day.value, maxSpend)
  return (
    <div
      className={`h-7 rounded-[4px] border border-black/5 cursor-pointer transition-transform hover:scale-105 flex items-center justify-center ${INTENSITY_CLASSES[level]}`}
      title={`${day.label}: ${fmt(day.value)}`}
      onMouseEnter={() => onHover(day)}
      onFocus={() => onHover(day)}
      tabIndex={0}
      role="button"
      aria-label={`${day.label} spend ${fmt(day.value)}`}
    >
      <span className={`text-[9px] font-semibold tabular-nums ${level >= 4 ? 'text-white' : 'text-ink-3'}`}>
        {day.day}
      </span>
    </div>
  )
})

function intensityLevel(value, maxValue) {
  if (value <= 0) return 0
  const ratio = value / maxValue
  if (ratio > 0.8) return 5
  if (ratio > 0.6) return 4
  if (ratio > 0.4) return 3
  if (ratio > 0.2) return 2
  return 1
}

export default memo(function MonthlySpendHeatmap({ txnRows, year, month }) {
  const [activeDay, setActiveDay] = useState(null)
  const handleLeave = useCallback(() => setActiveDay(null), [])
  const handleCellHover = useCallback((day) => setActiveDay(day), [])

  const { weeks, stats } = useMemo(() => {
    // Aggregate daily expense totals from txnRows
    const dailyTotals = new Map()
    for (const row of txnRows) {
      if (row.type !== 'expense') continue
      const amt = Number(row.amount || 0)
      if (!Number.isFinite(amt) || amt <= 0) continue
      const key = String(row.date || '').slice(0, 10)
      if (!key) continue
      dailyTotals.set(key, (dailyTotals.get(key) || 0) + amt)
    }

    const daysInMonth = new Date(year, month, 0).getDate()
    const days = []
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(year, month - 1, d)
      const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const value = dailyTotals.get(key) || 0
      days.push({
        key,
        value,
        day: d,
        weekday: date.toLocaleDateString('en-IN', { weekday: 'short' }),
        label: date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', weekday: 'short' }),
      })
    }

    const spendDays = days.filter((d) => d.value > 0)
    const maxSpend = Math.max(...spendDays.map((d) => d.value), 1)
    const totalSpend = spendDays.reduce((s, d) => s + d.value, 0)
    const avgSpend = spendDays.length > 0 ? totalSpend / spendDays.length : 0
    const peakDay = spendDays.length > 0
      ? spendDays.reduce((best, d) => (d.value > best.value ? d : best))
      : null
    const zeroDays = days.length - spendDays.length

    // Calendar grid: rows = weekdays (Mon-Sun), cols = weeks
    const firstDow = (new Date(year, month - 1, 1).getDay() + 6) % 7 // Mon=0
    const padded = [...Array(firstDow).fill(null), ...days]
    while (padded.length % 7 !== 0) padded.push(null)

    const weekCols = []
    for (let i = 0; i < padded.length; i += 7) {
      weekCols.push(padded.slice(i, i + 7))
    }

    return {
      weeks: weekCols,
      stats: {
        activeDays: spendDays.length,
        zeroDays,
        totalSpend,
        avgSpend,
        maxSpend,
        peakDay,
      },
    }
  }, [txnRows, year, month])

  if (stats.activeDays === 0) return null

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-label font-semibold text-ink">Spend heatmap</p>
          <p className="text-[11px] text-ink-3 mt-0.5">
            Daily spending intensity this month. Darker = higher spend.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {stats.zeroDays > 0 && (
            <span className="text-[10px] px-2 py-1 rounded-pill font-semibold bg-income-bg text-income-text">
              {stats.zeroDays} zero-spend day{stats.zeroDays !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Active day tooltip */}
      <div className="h-5 mb-1.5">
        {activeDay ? (
          <p className="text-[11px] text-ink-2 font-semibold">
            {activeDay.label}: <span className="text-ink tabular-nums">{fmt(activeDay.value)}</span>
          </p>
        ) : (
          <p className="text-[10px] text-ink-3">Hover a cell to see daily spend.</p>
        )}
      </div>

      {/* Heatmap grid: weekday rows × week columns */}
      <div className="flex gap-0">
        {/* Weekday labels */}
        <div className="flex flex-col gap-[5px] mr-1.5 shrink-0" style={{ width: 24 }}>
          {WEEKDAY_LABELS.map((label, i) => (
            <div key={`wl-${i}`} className="h-7 flex items-center justify-end">
              <span className="text-[9px] text-ink-3">{label}</span>
            </div>
          ))}
        </div>

        {/* Week columns */}
        <div className="flex gap-[5px] flex-1" onMouseLeave={handleLeave}>
          {weeks.map((week, wi) => (
            <div key={`week-${wi}`} className="flex flex-col gap-[5px] flex-1">
              {week.map((day, di) => {
                if (!day) {
                  return <div key={`e-${wi}-${di}`} className="h-7 rounded-[4px]" />
                }
                return (
                  <DayCell key={day.key} day={day} maxSpend={stats.maxSpend} onHover={handleCellHover} />
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend + stats */}
      <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-ink-3">Less</span>
          {INTENSITY_CLASSES.map((cls, i) => (
            <div key={`leg-${i}`} className={`w-[11px] h-[11px] rounded-[2px] border border-black/5 ${cls}`} />
          ))}
          <span className="text-[9px] text-ink-3">More</span>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[9px] text-ink-3">Avg/day</p>
            <p className="text-[11px] font-semibold tabular-nums text-ink">{fmt(Math.round(stats.avgSpend))}</p>
          </div>
          {stats.peakDay && (
            <div className="text-right">
              <p className="text-[9px] text-ink-3">Peak</p>
              <p className="text-[11px] font-semibold tabular-nums text-expense-text">
                {stats.peakDay.weekday} {stats.peakDay.day} · {fmt(stats.maxSpend)}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
})
