import { memo, useMemo } from 'react'
import { fmt } from '../../../lib/utils'

export default memo(function InvestmentConsistencyCard({ monthlyData, year }) {
  const analysis = useMemo(() => {
    if (!monthlyData?.length) return null

    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth() // 0-indexed

    // Only count months up to current (avoid counting future months as misses)
    const activeMonths = monthlyData
      .map((m, i) => ({
        index: i,
        income: Number(m?.income || 0),
        investment: Number(m?.investment || 0),
        hasActivity: Number(m?.income || 0) > 0 || Number(m?.expense || 0) > 0 || Number(m?.investment || 0) > 0,
      }))
      .filter((m) => {
        // Only include months that have passed or are current
        if (year < currentYear) return true
        if (year === currentYear) return m.index <= currentMonth
        return false
      })

    if (activeMonths.length === 0) return null

    const monthsWithInvestment = activeMonths.filter((m) => m.investment > 0)
    const monthsWithActivity = activeMonths.filter((m) => m.hasActivity)

    const adherenceCount = monthsWithInvestment.length
    const totalMonths = monthsWithActivity.length > 0 ? monthsWithActivity.length : activeMonths.length
    const adherencePct = totalMonths > 0 ? Math.round((adherenceCount / totalMonths) * 100) : 0

    const totalInvested = monthsWithInvestment.reduce((s, m) => s + m.investment, 0)
    const avgMonthlyInvestment = adherenceCount > 0 ? Math.round(totalInvested / adherenceCount) : 0

    // Calculate current streak (from most recent month backwards)
    let streak = 0
    for (let i = activeMonths.length - 1; i >= 0; i--) {
      if (activeMonths[i].investment > 0) {
        streak += 1
      } else if (activeMonths[i].hasActivity) {
        break
      }
    }

    // Best streak
    let bestStreak = 0
    let currentRun = 0
    for (const m of activeMonths) {
      if (m.investment > 0) {
        currentRun += 1
        if (currentRun > bestStreak) bestStreak = currentRun
      } else if (m.hasActivity) {
        currentRun = 0
      }
    }

    // Per-month deploy rates for the bar display
    const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const bars = activeMonths.map((m) => ({
      label: SHORT_MONTHS[m.index],
      invested: m.investment > 0,
      amount: m.investment,
      deployRate: m.income > 0 ? Math.round((m.investment / m.income) * 100) : 0,
    }))

    const totalIncome = activeMonths.reduce((s, m) => s + m.income, 0)
    const overallDeployRate = totalIncome > 0 ? Math.round((totalInvested / totalIncome) * 100) : 0

    return {
      adherenceCount,
      totalMonths,
      adherencePct,
      streak,
      bestStreak,
      totalInvested,
      avgMonthlyInvestment,
      overallDeployRate,
      bars,
    }
  }, [monthlyData, year])

  if (!analysis || analysis.totalMonths === 0) return null

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-label font-semibold text-ink">Investment consistency</p>
          <p className="text-[11px] text-ink-3 mt-0.5">
            Monthly deployment adherence — consistency matters more than amount for wealth building.
          </p>
        </div>
        <span className={`text-[11px] px-2 py-1 rounded-pill font-semibold ${
          analysis.adherencePct >= 80
            ? 'bg-income-bg text-income-text'
            : analysis.adherencePct >= 50
              ? 'bg-warning-bg text-warning-text'
              : 'bg-expense-bg text-expense-text'
        }`}>
          {analysis.adherenceCount}/{analysis.totalMonths} months
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2.5">
        <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
          <p className="text-[10px] text-ink-3">Adherence</p>
          <p className={`text-[12px] font-bold tabular-nums ${analysis.adherencePct >= 80 ? 'text-income-text' : analysis.adherencePct >= 50 ? 'text-warning-text' : 'text-expense-text'}`}>
            {analysis.adherencePct}%
          </p>
        </div>
        <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
          <p className="text-[10px] text-ink-3">Current streak</p>
          <p className="text-[12px] font-bold tabular-nums text-brand">{analysis.streak} mo</p>
        </div>
        <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
          <p className="text-[10px] text-ink-3">Best streak</p>
          <p className="text-[12px] font-bold tabular-nums text-ink">{analysis.bestStreak} mo</p>
        </div>
        <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
          <p className="text-[10px] text-ink-3">Avg deploy</p>
          <p className="text-[12px] font-bold tabular-nums text-invest-text">{fmt(analysis.avgMonthlyInvestment, true)}</p>
        </div>
      </div>

      {/* Monthly adherence strip */}
      <div className="rounded-card border border-kosha-border bg-kosha-surface-2 p-2.5">
        <div className="flex items-end gap-1 h-16">
          {analysis.bars.map((bar) => (
            <div key={bar.label} className="flex-1 flex flex-col items-center gap-0.5">
              <div
                className={`w-full rounded-t-sm ${bar.invested ? 'bg-invest' : 'bg-kosha-border'}`}
                style={{
                  height: bar.invested
                    ? `${Math.max(12, Math.min(100, bar.deployRate * 1.2))}%`
                    : '12%',
                }}
                title={bar.invested ? `${bar.label}: ${fmt(bar.amount)} (${bar.deployRate}%)` : `${bar.label}: No investment`}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-1 mt-1">
          {analysis.bars.map((bar) => (
            <div key={`label-${bar.label}`} className="flex-1 text-center">
              <span className="text-[8px] text-ink-3">{bar.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 mt-2">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-invest" />
          <span className="text-[10px] text-ink-3">Invested</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-kosha-border" />
          <span className="text-[10px] text-ink-3">Missed</span>
        </div>
        <span className="text-[10px] text-ink-3">
          Overall deploy: {analysis.overallDeployRate}% of income
        </span>
      </div>

      <p className="text-[11px] text-ink-3 mt-2">
        {analysis.adherencePct >= 80
          ? `Strong consistency at ${analysis.adherencePct}%. This discipline is the single biggest wealth accelerator.`
          : analysis.adherencePct >= 50
            ? `Investing ${analysis.adherenceCount} of ${analysis.totalMonths} months. Set up a recurring SIP to improve adherence above 80%.`
            : `Only ${analysis.adherenceCount} of ${analysis.totalMonths} months had investment. Even small monthly amounts build compounding habit.`
        }
      </p>
    </div>
  )
})
