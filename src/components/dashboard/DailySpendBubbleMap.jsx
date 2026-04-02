import { memo, useCallback, useEffect, useState } from 'react'
import { fmt } from '../../lib/utils'

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
          <p className="section-label">Daily spend bubble map</p>
          <p className="text-caption text-ink-3 mt-0.5">Each bubble represents one day across the last {dailyVariance.lookbackDays} days</p>
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

          <span className="text-[11px] px-2 py-1 rounded-pill font-semibold bg-kosha-surface-2 text-ink-2">
            {dailyVariance.activeDays} active day{dailyVariance.activeDays === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <p className="text-[10px] text-ink-3 mb-1.5">
        {activeDay
          ? `${activeDay.label}: ${fmt(activeDay.value)}`
          : 'Hover a bubble to see exact spend for that day.'}
      </p>

      <p className="text-[10px] text-ink-3 mb-1.5">
        Absolute range: 0 to {fmt(dailyVariance.heatmapMax)} over {dailyVariance.heatmapRange}.
      </p>

      <div className="grid grid-cols-7 gap-1.5 mb-1">
        {dailyVariance.weekdayLabels.map((label) => (
          <p key={`bubble-header-${label}`} className="text-[9px] text-ink-3 text-center">{label}</p>
        ))}
      </div>

      <div className="space-y-1.5" onMouseLeave={() => setActiveDay(null)}>
        {dailyVariance.heatmapWeeks.map((week, weekIndex) => (
          <div key={`heatmap-week-${weekIndex}`} className="grid grid-cols-7 gap-1.5">
            {week.map((day, dayIndex) => {
              if (!day) {
                return <div key={`heatmap-empty-${weekIndex}-${dayIndex}`} className="h-8 rounded-card bg-transparent" aria-hidden="true" />
              }

              return (
                <button
                  key={day.key}
                  type="button"
                  title={`${day.label}: ${fmt(day.value)}`}
                  aria-label={`${day.label} spend ${fmt(day.value)}`}
                  onMouseEnter={() => handleDayActivate(day)}
                  onFocus={() => handleDayActivate(day)}
                  className="h-8 rounded-card bg-kosha-surface-2 border border-kosha-border flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <span
                    className="rounded-full border border-white/70"
                    style={{
                      width: `${day.bubbleSize}px`,
                      height: `${day.bubbleSize}px`,
                      background: day.bubbleFill,
                    }}
                  />
                </button>
              )
            })}
          </div>
        ))}
      </div>

      <p className="text-[10px] text-ink-3 mt-1.5">
        Bubble size and shade both scale with spend magnitude. Tracked spend in this window: {fmt(dailyVariance.trackedTotal)}.
      </p>
    </div>
  )
})

export default DailySpendBubbleMap
