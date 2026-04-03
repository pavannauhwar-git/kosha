import { memo, useMemo } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts'
import { C } from '../../lib/colors'

function SavingsRateTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload || {}

  return (
    <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5 shadow-card min-w-[168px]">
      <p className="text-[11px] font-semibold text-ink mb-1">{label}</p>
      <div className="space-y-0.5 text-[11px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-3">Savings rate</span>
          <span className={`font-semibold tabular-nums ${(row.rate || 0) >= 0 ? 'text-income-text' : 'text-warning-text'}`}>
            {Math.round(row.rate || 0)}%
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-3">Invest rate</span>
          <span className="font-semibold tabular-nums text-invest-text">
            {Math.round(row.investRate || 0)}%
          </span>
        </div>
      </div>
    </div>
  )
}

function toFiniteNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export default memo(function SavingsRateTrend({ flowTrendData, monthLabels }) {
  const trendData = useMemo(() => {
    if (!flowTrendData?.length) return { series: [], hasData: false }

    const series = flowTrendData.map((row) => {
      const income = toFiniteNumber(row.Income)
      const spent = toFiniteNumber(row.Spent)
      const invested = toFiniteNumber(row.Invested)

      const savingsRate = income > 0
        ? Math.round(((income - spent - invested) / income) * 100)
        : 0
      const investRate = income > 0
        ? Math.round((invested / income) * 100)
        : 0

      return {
        name: row.name,
        rate: savingsRate,
        investRate,
        hasIncome: income > 0,
      }
    })

    const activeMonths = series.filter((row) => row.hasIncome)
    const avgRate = activeMonths.length > 0
      ? Math.round(activeMonths.reduce((sum, row) => sum + row.rate, 0) / activeMonths.length)
      : 0
    const avgInvestRate = activeMonths.length > 0
      ? Math.round(activeMonths.reduce((sum, row) => sum + row.investRate, 0) / activeMonths.length)
      : 0

    const positiveMonths = activeMonths.filter((row) => row.rate > 0).length
    const bestMonth = activeMonths.length > 0
      ? activeMonths.reduce((best, row) => row.rate > best.rate ? row : best, activeMonths[0])
      : null

    return {
      series,
      hasData: activeMonths.length > 0,
      avgRate,
      avgInvestRate,
      positiveMonths,
      totalActiveMonths: activeMonths.length,
      bestMonth,
    }
  }, [flowTrendData])

  if (!trendData.hasData) return null

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-label font-semibold text-ink">Savings rate trend</p>
          <p className="text-[11px] text-ink-3 mt-0.5">Monthly net savings as percentage of income — the single most important wealth metric.</p>
        </div>
        <span className={`text-[11px] px-2 py-1 rounded-pill font-semibold ${trendData.avgRate >= 20 ? 'bg-income-bg text-income-text' : trendData.avgRate >= 0 ? 'bg-warning-bg text-warning-text' : 'bg-expense-bg text-expense-text'}`}>
          Avg {trendData.avgRate}%
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2.5">
        <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
          <p className="text-[10px] text-ink-3">Avg savings rate</p>
          <p className={`text-[12px] font-bold tabular-nums ${trendData.avgRate >= 20 ? 'text-income-text' : trendData.avgRate >= 0 ? 'text-warning-text' : 'text-expense-text'}`}>
            {trendData.avgRate}%
          </p>
        </div>
        <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
          <p className="text-[10px] text-ink-3">Avg invest rate</p>
          <p className="text-[12px] font-bold tabular-nums text-invest-text">{trendData.avgInvestRate}%</p>
        </div>
        <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
          <p className="text-[10px] text-ink-3">Positive months</p>
          <p className="text-[12px] font-bold tabular-nums text-ink">{trendData.positiveMonths}/{trendData.totalActiveMonths}</p>
        </div>
      </div>

      <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={trendData.series} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="savingsRateGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.brand} stopOpacity={0.22} />
                <stop offset="95%" stopColor={C.brand} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(16,33,63,0.10)" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: 'rgba(94,109,143,0.95)', fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
              interval={0}
            />
            <YAxis
              domain={['dataMin - 10', 'dataMax + 10']}
              tickFormatter={(value) => `${Math.round(value)}%`}
              tick={{ fontSize: 10, fill: 'rgba(94,109,143,0.95)' }}
              axisLine={false}
              tickLine={false}
              width={34}
            />
            <Tooltip content={<SavingsRateTooltip />} />
            <ReferenceLine y={0} stroke="rgba(16,33,63,0.25)" strokeDasharray="4 4" />
            <ReferenceLine y={20} stroke="rgba(14,159,110,0.35)" strokeDasharray="4 4" />
            <Area
              type="monotone"
              dataKey="rate"
              stroke={C.brand}
              fill="url(#savingsRateGrad)"
              strokeWidth={2.4}
              dot={{ r: 3, fill: C.brand, stroke: '#fff', strokeWidth: 1.5 }}
              activeDot={{ r: 5, fill: C.brand, stroke: '#fff', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-4 mt-2">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-0.5 border-t border-dashed" style={{ borderColor: 'rgba(14,159,110,0.5)' }} />
          <span className="text-[10px] text-ink-3">20% target</span>
        </div>
        {trendData.bestMonth && (
          <span className="text-[10px] text-ink-3">
            Best: {trendData.bestMonth.name} at {trendData.bestMonth.rate}%
          </span>
        )}
      </div>
    </div>
  )
})
