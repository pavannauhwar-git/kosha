import { memo, useCallback, useEffect, useState } from 'react'
import { fmt } from '../../lib/utils'

const INTENSITY_CLASSES = [
  'bg-kosha-surface-2',           // 0 — no spend
  'bg-brand/20',                  // 1
  'bg-brand/40',                  // 2
  'bg-brand/60',                  // 3
  'bg-brand/80',                  // 4
  'bg-brand',                     // 5 — max
]

function intensityLevel(value, maxValue) {
  if (value <= 0) return 0
  const ratio = value / maxValue
  if (ratio > 0.8) return 5
  if (ratio > 0.6) return 4
  if (ratio > 0.4) return 3
  if (ratio > 0.2) return 2
  return 1
}

const DailySpendBubbleMap = memo(function DailySpendBubbleMap({ dailyVariance, selectedWindowDays, onWindowDaysChange }) {
  const [activeDay, setActiveDay] = useState(null)

  const handleDayActivate = useCallback((day) => {
    setActiveDay((prev) => (prev?.key === day?.key ? prev : day))
  }, [])

  const handleWindowToggle = useCallback((days) => {
    setActiveDay(null)
    if (typeof onWindowDaysChange === 'function') onWindowDaysChange(days)
  }, [onWindowDaysChange])

  useEffect(() => {
    setActiveDay(null)
  }, [selectedWindowDays])

  return (
    <div className="card p-4 border-0">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="section-label">Daily spend heatmap</p>
          <p className="text-caption text-ink-3 mt-0.5">Spending intensity over the last {dailyVariance.lookbackDays} days</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center rounded-pill border border-kosha-border bg-kosha-surface-2 p-0.5">
            {[7, 14].map((days) => {
              const isActive = selectedWindowDays === days
              return (
                <button
                  key={`variance-window-${days}`}
                  type="button"
                  onClick={() => handleWindowToggle(days)}
                  aria-pressed={isActive}
                  className={`h-6 px-2 rounded-pill text-[10px] font-semibold transition ${isActive ? 'bg-brand text-white' : 'text-ink-2 hover:bg-kosha-surface'}`}
                >
                  {days}d
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="h-5 mb-1">
        {activeDay ? (
          <p className="text-[11px] text-ink-2 font-semibold">
            {activeDay.label}: <span className="text-ink tabular-nums">{fmt(activeDay.value)}</span>
          </p>
        ) : (
          <p className="text-[10px] text-ink-3">Hover a cell to see daily spend.</p>
        )}
      </div>

      <div className="grid grid-cols-7 gap-[5px] mb-1">
        {dailyVariance.weekdayLabels.map((label) => (
          <p key={`heatmap-header-${label}`} className="text-[8px] text-ink-3 text-center">{label}</p>
        ))}
      </div>

      <div className="space-y-[5px]" onMouseLeave={() => setActiveDay(null)}>
        {dailyVariance.heatmapWeeks.map((week, weekIndex) => (
          <div key={`heatmap-week-${weekIndex}`} className="grid grid-cols-7 gap-[5px]">
            {week.map((day, dayIndex) => {
              if (!day) {
                return <div key={`heatmap-empty-${weekIndex}-${dayIndex}`} className="aspect-square rounded-[3px] bg-transparent" aria-hidden="true" />
              }

              const level = intensityLevel(day.value, dailyVariance.heatmapMax)

              return (
                <button
                  key={day.key}
                  type="button"
                  title={`${day.label}: ${fmt(day.value)}`}
                  aria-label={`${day.label} spend ${fmt(day.value)}`}
                  onMouseEnter={() => handleDayActivate(day)}
                  onFocus={() => handleDayActivate(day)}
                  className={`aspect-square rounded-[3px] border border-black/5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${INTENSITY_CLASSES[level]}`}
                />
              )
            })}
          </div>
        ))}
      </div>

      {/* Legend + stats */}
      <div className="flex items-center justify-between gap-3 mt-2.5 flex-wrap">
        <div className="flex items-center gap-1">
          <span className="text-[8px] text-ink-3">Less</span>
          {INTENSITY_CLASSES.map((cls, i) => (
            <div key={`leg-${i}`} className={`w-[11px] h-[11px] rounded-[2px] border border-black/5 ${cls}`} />
          ))}
          <span className="text-[8px] text-ink-3">More</span>
        </div>
        <p className="text-[10px] text-ink-3 tabular-nums">
          {dailyVariance.activeDays} active · {fmt(dailyVariance.trackedTotal)} total
        </p>
      </div>
    </div>
  )
})

export default DailySpendBubbleMap
