import { memo, useMemo } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import { fmt } from '../../lib/utils'

function PaceTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload || {}

  return (
    <div className="tooltip-enter rounded-card bg-kosha-surface p-3 shadow-card min-w-[172px]" style={{ border: '1px solid var(--ds-border)' }}>
      <p className="text-[11px] font-semibold text-ink mb-1">Day {label}</p>
      <div className="space-y-0.5 text-[11px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-3">Actual spend</span>
          <span className="font-semibold tabular-nums text-expense-text">{fmt(Number(row.actual || 0))}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-3">Even pace</span>
          <span className="font-semibold tabular-nums text-ink">{fmt(Number(row.pace || 0))}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-3">Gap</span>
          <span className={`font-semibold tabular-nums ${(row.actual || 0) <= (row.pace || 0) ? 'text-income-text' : 'text-warning-text'}`}>
            {(row.actual || 0) <= (row.pace || 0) ? 'Under' : 'Over'} by {fmt(Math.abs((row.actual || 0) - (row.pace || 0)))}
          </span>
        </div>
      </div>
    </div>
  )
}

function compactTick(value) {
  const n = Number(value || 0)
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${Math.round((n / 1_000_000) * 10) / 10}M`
  if (abs >= 1_000) return `${Math.round(n / 1_000)}k`
  return `${Math.round(n)}`
}

export default memo(function SpendingPaceTracker({ dailyExpenseTotals, now, earned, spent }) {
  const paceData = useMemo(() => {
    const year = now.getFullYear()
    const month = now.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const today = now.getDate()

    // Monthly budget = last month's income (earned) as the spend ceiling
    const monthlyBudget = Number(earned || 0)
    if (monthlyBudget <= 0) return { series: [], hasData: false }

    const dailyPace = monthlyBudget / daysInMonth
    let cumActual = 0
    const series = []

    for (let d = 1; d <= Math.min(today, daysInMonth); d++) {
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const daySpend = Number(dailyExpenseTotals?.[key] || 0)
      cumActual += daySpend
      const cumPace = dailyPace * d

      series.push({
        day: d,
        actual: Math.round(cumActual),
        pace: Math.round(cumPace),
      })
    }

    const latestActual = series[series.length - 1]?.actual || 0
    const latestPace = series[series.length - 1]?.pace || 0
    const variance = latestActual - latestPace
    const variancePct = latestPace > 0 ? Math.round((variance / latestPace) * 100) : 0
    const onTrack = variance <= 0

    const daysLeft = daysInMonth - today
    const projectedTotal = today > 0 ? Math.round((cumActual / today) * daysInMonth) : 0
    const projectedOvershoot = projectedTotal - monthlyBudget

    return {
      series,
      hasData: series.some((row) => row.actual > 0),
      variance,
      variancePct,
      onTrack,
      daysLeft,
      projectedTotal,
      projectedOvershoot,
      monthlyBudget,
      today,
    }
  }, [dailyExpenseTotals, now, earned])

  if (!paceData.hasData) return null

  return (
    <div className="card p-4 border-0">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="section-label">Spending pace</p>
          <p className="text-caption text-ink-3 mt-0.5">Cumulative daily spend vs even monthly pace</p>
        </div>
        <span className={`text-[10px] px-2 py-1 rounded-pill font-semibold ${paceData.onTrack ? 'bg-income-bg text-income-text' : 'bg-warning-bg text-warning-text'}`}>
          {paceData.onTrack ? 'Under pace' : 'Over pace'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2.5">
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] tracking-wide text-ink-3">Spent so far</p>
          <p className="text-[13px] font-semibold tabular-nums text-expense-text mt-0.5">{fmt(spent || 0)}</p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] tracking-wide text-ink-3">Projected end</p>
          <p className={`text-[13px] font-semibold tabular-nums mt-0.5 ${paceData.projectedOvershoot <= 0 ? 'text-income-text' : 'text-warning-text'}`}>
            {fmt(paceData.projectedTotal)}
          </p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] tracking-wide text-ink-3">Days left</p>
          <p className="text-[13px] font-semibold tabular-nums text-ink mt-0.5">{paceData.daysLeft}</p>
        </div>
      </div>

      <div className="rounded-card bg-kosha-surface-2 p-3" style={{ border: '1px solid var(--ds-border)' }}>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={paceData.series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="spendAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#E8453C" stopOpacity={0.18} />
                <stop offset="95%" stopColor="#E8453C" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--ds-border)" />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 10, fill: 'var(--ds-text-3)' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={compactTick}
              tick={{ fontSize: 10, fill: 'var(--ds-text-3)' }}
              axisLine={false}
              tickLine={false}
              width={34}
            />
            <Tooltip content={<PaceTooltip />} />
            <Area
              type="monotone"
              dataKey="actual"
              stroke="#E8453C"
              fill="url(#spendAreaGrad)"
              strokeWidth={2.2}
              dot={false}
              activeDot={{ r: 4, fill: '#E8453C', stroke: '#fff', strokeWidth: 2 }}
            />
            <Line
              type="monotone"
              dataKey="pace"
              stroke="rgba(0,127,255,0.35)"
              strokeWidth={1.8}
              strokeDasharray="5 4"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[11px] text-ink-3 mt-2">
        {paceData.onTrack
          ? `You're ${fmt(Math.abs(paceData.variance))} under even pace. Keep this discipline to close the month comfortably.`
          : `You're ${fmt(Math.abs(paceData.variance))} over even pace (${Math.abs(paceData.variancePct)}%). Slow daily spend over the next ${paceData.daysLeft} day${paceData.daysLeft === 1 ? '' : 's'} to recover.`
        }
      </p>
    </div>
  )
})
