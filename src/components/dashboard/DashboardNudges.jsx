import { memo, useMemo } from 'react'
import { Lightbulb } from 'lucide-react'
import { fmt } from '../../lib/utils'

/**
 * Synthesizes the top 2-3 actionable nudges from current financial state.
 * Shown below the hero on Dashboard for daily guidance.
 */
export default memo(function DashboardNudges({
  earned,
  spent,
  invested,
  dayOfMonth,
  daysInMonth,
  dailyExpenseTotals,
  dueSoonCount,
  dueSoonAmount,
  weeklyDigest,
}) {
  const nudges = useMemo(() => {
    const items = []

    // 1. Spending pace nudge
    if (earned > 0) {
      const daysLeft = Math.max(0, daysInMonth - dayOfMonth)
      const evenPace = (earned / daysInMonth) * dayOfMonth
      const overAmount = spent - evenPace

      if (overAmount > 0 && daysLeft > 0) {
        const dailyCut = Math.round(overAmount / daysLeft)
        items.push({
          key: 'pace',
          priority: overAmount / earned > 0.15 ? 2 : 1,
          text: `${daysLeft} day${daysLeft > 1 ? 's' : ''} left, ${fmt(Math.round(overAmount))} over pace. Trim ~${fmt(dailyCut)}/day to close on target.`,
          tone: 'warning',
        })
      }
    }

    // 2. Bills due nudge
    if (dueSoonCount > 0) {
      items.push({
        key: 'bills',
        priority: 2,
        text: `${dueSoonCount} bill${dueSoonCount > 1 ? 's' : ''} due this week${dueSoonAmount > 0 ? ` totalling ${fmt(dueSoonAmount)}` : ''}. Clear these before discretionary spend.`,
        tone: 'warning',
      })
    }

    // 3. Investment gap nudge
    if (earned > 0 && invested === 0 && dayOfMonth >= 7) {
      items.push({
        key: 'invest',
        priority: 1,
        text: `No investment logged this month yet. Even a small SIP keeps the habit alive.`,
        tone: 'info',
      })
    }

    // 4. Daily spend spike (yesterday vs 7-day average)
    if (dailyExpenseTotals && typeof dailyExpenseTotals === 'object') {
      const today = new Date()
      const yesterday = new Date(today)
      yesterday.setDate(yesterday.getDate() - 1)
      const yKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`
      const yesterdaySpend = Number(dailyExpenseTotals[yKey] || 0)

      if (yesterdaySpend > 0) {
        const values = Object.values(dailyExpenseTotals)
          .map(Number)
          .filter((v) => Number.isFinite(v) && v > 0)
        const avg = values.length > 0 ? values.reduce((s, v) => s + v, 0) / values.length : 0

        if (avg > 0 && yesterdaySpend > avg * 2) {
          items.push({
            key: 'spike',
            priority: 2,
            text: `Yesterday's spend (${fmt(yesterdaySpend)}) was ${Math.round(yesterdaySpend / avg)}× your daily average. Check if that was planned.`,
            tone: 'warning',
          })
        }
      }
    }

    // 5. Weekly spend trend nudge
    if (weeklyDigest?.spendDelta > 0 && weeklyDigest.spendPrev7 > 0) {
      const pctUp = Math.round((weeklyDigest.spendDelta / weeklyDigest.spendPrev7) * 100)
      if (pctUp > 30) {
        items.push({
          key: 'weekly-trend',
          priority: 1,
          text: `Weekly spend is up ${pctUp}% vs last week. Watch discretionary purchases today.`,
          tone: 'info',
        })
      }
    }

    // Sort by priority (higher = more urgent) and take top 3
    return items.sort((a, b) => b.priority - a.priority).slice(0, 3)
  }, [earned, spent, invested, dayOfMonth, daysInMonth, dailyExpenseTotals, dueSoonCount, dueSoonAmount, weeklyDigest])

  if (nudges.length === 0) return null

  return (
    <div className="card p-4 border-0">
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-7 h-7 rounded-lg bg-warning-bg flex items-center justify-center shrink-0">
          <Lightbulb size={14} className="text-warning-text" />
        </div>
        <p className="text-label font-semibold text-ink">What to do today</p>
      </div>

      <div className="space-y-2">
        {nudges.map((nudge, index) => (
          <div
            key={nudge.key}
            className={`rounded-card border p-2.5 flex items-start gap-2.5 ${
              nudge.tone === 'warning'
                ? 'border-warning-border bg-warning-bg/30'
                : 'border-kosha-border bg-kosha-surface-2'
            }`}
          >
            <span className="w-4 text-right text-[11px] font-bold text-brand shrink-0 mt-0.5">
              {index + 1}
            </span>
            <p className="text-[11px] text-ink-2 leading-relaxed">{nudge.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
})
