import { memo, useMemo } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { fmt } from '../../lib/utils'

function WeeklyDriftTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload || {}
  const baseline = Number(row?.baseline || 0)
  const spend = Number(row?.total || 0)
  const delta = baseline > 0 ? spend - baseline : null

  return (
    <div className="tooltip-enter rounded-card bg-kosha-surface p-3 shadow-card min-w-[172px]" style={{ border: '1px solid var(--ds-border)' }}>
      <p className="text-[11px] font-semibold text-ink mb-1">{row?.range || 'Week'}</p>
      <div className="space-y-0.5 text-[11px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-3">Week spend</span>
          <span className="font-semibold tabular-nums text-expense-text">{fmt(spend)}</span>
        </div>
        {baseline > 0 && (
          <>
            <div className="flex items-center justify-between gap-3">
              <span className="text-ink-3">4W median</span>
              <span className="font-semibold tabular-nums text-ink">{fmt(baseline)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-ink-3">Drift</span>
              <span className={`font-semibold tabular-nums ${delta <= 0 ? 'text-income-text' : 'text-warning-text'}`}>
                {delta <= 0 ? '-' : '+'}{fmt(Math.abs(delta))}
              </span>
            </div>
          </>
        )}
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

function toDateKey(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function startOfWeekMonday(date) {
  const start = new Date(date)
  const day = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - day)
  start.setHours(12, 0, 0, 0)
  return start
}

function formatShortDate(date) {
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b)
  if (!sorted.length) return 0
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2
  return sorted[mid]
}

export default memo(function SpendingPaceTracker({ dailyExpenseTotals, now }) {
  const driftData = useMemo(() => {
    const safeTotals = dailyExpenseTotals || {}
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12)
    const currentWeekStart = startOfWeekMonday(today)
    const weeks = []

    for (let offset = 7; offset >= 0; offset -= 1) {
      const weekStart = addDays(currentWeekStart, -offset * 7)
      const weekEnd = addDays(weekStart, 6)
      const countedEnd = offset === 0 ? today : weekEnd
      const daysToCount = Math.max(1, Math.floor((countedEnd.getTime() - weekStart.getTime()) / (24 * 60 * 60 * 1000)) + 1)

      let total = 0
      for (let dayIndex = 0; dayIndex < daysToCount; dayIndex += 1) {
        const date = addDays(weekStart, dayIndex)
        total += Number(safeTotals[toDateKey(date)] || 0)
      }

      weeks.push({
        label: formatShortDate(weekStart),
        range: `${formatShortDate(weekStart)} - ${formatShortDate(countedEnd)}`,
        total: Math.round(total),
        isCurrent: offset === 0,
      })
    }

    const hasData = weeks.some((row) => row.total > 0)
    if (!hasData) return { hasData: false }

    const currentWeek = weeks[weeks.length - 1] || { total: 0 }
    const previousWeek = weeks[weeks.length - 2] || { total: 0 }
    const baselineWindow = weeks.slice(-5, -1).map((row) => row.total).filter((value) => value > 0)
    const median4w = Math.round(median(baselineWindow))

    const driftPct = median4w > 0
      ? Math.round(((currentWeek.total - median4w) / median4w) * 100)
      : null

    const wowPct = previousWeek.total > 0
      ? Math.round(((currentWeek.total - previousWeek.total) / previousWeek.total) * 100)
      : null

    let status = 'healthy'
    if (driftPct != null && driftPct > 20) status = 'high'
    else if (driftPct != null && driftPct > 5) status = 'watch'

    const statusLabel = status === 'high'
      ? 'Above baseline'
      : status === 'watch'
        ? 'Slightly high'
        : 'Within baseline'

    const guidance = driftPct == null
      ? 'Build a few active weeks to establish a reliable weekly baseline.'
      : status === 'high'
        ? `This week is ${driftPct}% above your 4-week median. Freeze optional spend to avoid end-of-month pressure.`
        : status === 'watch'
          ? `This week is ${driftPct}% above baseline. Keep the next few days lighter to realign.`
          : `This week is ${Math.abs(driftPct)}% below baseline. Current weekly rhythm is controlled.`

    const chartRows = weeks.map((row) => ({
      ...row,
      baseline: median4w,
    }))

    return {
      hasData: true,
      currentWeekTotal: currentWeek.total,
      median4w,
      driftPct,
      wowPct,
      status,
      statusLabel,
      guidance,
      weeks: chartRows,
    }
  }, [dailyExpenseTotals, now])

  if (!driftData.hasData) return null

  const statusTone = driftData.status === 'high'
    ? 'bg-warning-bg text-warning-text'
    : driftData.status === 'watch'
      ? 'bg-brand-container text-brand'
      : 'bg-income-bg text-income-text'

  const driftTone = (driftData.driftPct ?? 0) <= 0 ? 'text-income-text' : 'text-warning-text'
  const wowTone = (driftData.wowPct ?? 0) <= 0 ? 'text-income-text' : 'text-warning-text'
  const yDomainMax = useMemo(() => {
    const maxValue = driftData.weeks.reduce((maxSoFar, row) => {
      return Math.max(maxSoFar, Number(row?.total || 0), Number(row?.baseline || 0))
    }, 0)

    if (maxValue <= 0) return 1000

    return Math.max(1000, Math.ceil((maxValue * 1.08) / 1000) * 1000)
  }, [driftData.weeks])

  return (
    <div className="card p-3.5 border-0">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="section-label">Weekly spend drift</p>
          <p className="text-caption text-ink-3 mt-0.5">Current week vs rolling 4-week median.</p>
        </div>
        <span className={`text-[10px] px-2 py-1 rounded-pill font-semibold ${statusTone}`}>
          {driftData.statusLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
        <div className="rounded-card bg-kosha-surface-2 px-3 py-2" style={{ border: '1px solid var(--ds-border)' }}>
          <p className="text-[10px] tracking-wide text-ink-3">This week</p>
          <p className="text-[12px] font-semibold tabular-nums text-expense-text mt-0.5">{fmt(driftData.currentWeekTotal)}</p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 px-3 py-2" style={{ border: '1px solid var(--ds-border)' }}>
          <p className="text-[10px] tracking-wide text-ink-3">4W median</p>
          <p className="text-[12px] font-semibold tabular-nums text-ink mt-0.5">{fmt(driftData.median4w)}</p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 px-3 py-2" style={{ border: '1px solid var(--ds-border)' }}>
          <p className="text-[10px] tracking-wide text-ink-3">Drift</p>
          <p className={`text-[12px] font-semibold tabular-nums mt-0.5 ${driftTone}`}>
            {driftData.driftPct == null
              ? '—'
              : `${driftData.driftPct >= 0 ? '+' : ''}${driftData.driftPct}%`}
          </p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 px-3 py-2" style={{ border: '1px solid var(--ds-border)' }}>
          <p className="text-[10px] tracking-wide text-ink-3">Vs last week</p>
          <p className={`text-[12px] font-semibold tabular-nums mt-0.5 ${wowTone}`}>
            {driftData.wowPct == null
              ? '—'
              : `${driftData.wowPct >= 0 ? '+' : ''}${driftData.wowPct}%`}
          </p>
        </div>
      </div>

      <div className="rounded-card bg-kosha-surface-2 px-2.5 py-2" style={{ border: '1px solid var(--ds-border)' }}>
        <div className="flex items-center justify-between mb-1 px-0.5">
          <p className="text-[10px] text-ink-3">Last 8 weeks</p>
          <p className="text-[10px] text-ink-3">Blue line = 4W median</p>
        </div>

        <ResponsiveContainer width="100%" height={132}>
          <BarChart data={driftData.weeks} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--ds-border)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: 'var(--ds-text-3)' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, yDomainMax]}
              tickFormatter={compactTick}
              tick={{ fontSize: 10, fill: 'var(--ds-text-3)' }}
              axisLine={false}
              tickLine={false}
              width={34}
            />
            <Tooltip content={<WeeklyDriftTooltip />} />
            {driftData.median4w > 0 && (
              <ReferenceLine
                y={driftData.median4w}
                stroke="#007FFF"
                strokeOpacity={0.8}
                strokeWidth={2}
                strokeDasharray="4 4"
                ifOverflow="extendDomain"
              />
            )}
            <Bar dataKey="total" radius={[6, 6, 0, 0]} maxBarSize={18}>
              {driftData.weeks.map((row, index) => (
                <Cell
                  key={`weekly-drift-bar-${row.label}-${index}`}
                  fill={row.isCurrent ? '#E8453C' : 'rgba(0,127,255,0.52)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[10px] text-ink-3 mt-1.5 leading-relaxed">
        {driftData.guidance}
      </p>
    </div>
  )
})
