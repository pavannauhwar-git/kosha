import { memo } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Cell,
} from 'recharts'
import { fmt } from '../../../lib/utils'
import Button from '../../ui/Button'

function DailySpendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload || {}

  return (
    <div className="tooltip-enter rounded-card bg-kosha-surface-2 p-3 shadow-card min-w-[160px]">
      <p className="text-[11px] font-semibold text-ink mb-1">{row.label || label}</p>
      <div className="space-y-0.5 text-[11px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-3">Day spend</span>
          <span className="font-semibold tabular-nums text-expense-text">{fmt(Number(row.amount || 0))}</span>
        </div>
        {row.isAboveAvg && (
          <p className="text-[10px] text-warning-text mt-0.5">Above daily average</p>
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

export default memo(function DailySpendTrend({ dailyTotals, year, month, onReviewExpenses, onReviewPeakDay }) {
  const daysInMonth = new Date(year, month, 0).getDate()

  // Aggregate expense per day from a pre-aggregated date=>amount map.
  const dailyMap = new Map()
  const sourceTotals = dailyTotals && typeof dailyTotals === 'object' ? dailyTotals : {}
  for (const [dateKey, amountValue] of Object.entries(sourceTotals)) {
    const amount = Number(amountValue || 0)
    if (!Number.isFinite(amount) || amount <= 0) continue
    const day = Number(String(dateKey || '').slice(8, 10))
    if (day < 1 || day > daysInMonth) continue
    dailyMap.set(day, (dailyMap.get(day) || 0) + amount)
  }

  if (dailyMap.size === 0) return null

  const series = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1
    return {
      day,
      label: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`,
      amount: Math.round(dailyMap.get(day) || 0),
    }
  })

  const activeDays = series.filter((row) => row.amount > 0)
  const dailyAvg = activeDays.length > 0
    ? Math.round(activeDays.reduce((sum, row) => sum + row.amount, 0) / activeDays.length)
    : 0

  const seriesWithFlags = series.map((row) => ({
    ...row,
    isAboveAvg: row.amount > dailyAvg,
  }))

  const peakDay = [...activeDays].sort((a, b) => b.amount - a.amount)[0]
  const peakDayDate = peakDay
    ? `${year}-${String(month).padStart(2, '0')}-${String(peakDay.day).padStart(2, '0')}`
    : null
  const spendDays = activeDays.length
  const zeroDays = daysInMonth - spendDays

  return (
    <div className="card p-4 border-0">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="section-label">Daily spend pattern</p>
          <p className="text-[11px] text-ink-3 mt-0.5">Expense distribution across the month with daily average</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] px-2 py-1 rounded-pill font-semibold bg-kosha-surface-2 text-ink-2">
            {spendDays} active day{spendDays === 1 ? '' : 's'}
          </span>
          {onReviewExpenses && (
            <Button
              variant="secondary"
              size="xs"
              onClick={onReviewExpenses}
              className="whitespace-nowrap"
            >
              Review
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2.5">
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">Daily average</p>
          <p className="text-[13px] font-semibold tabular-nums text-ink">{fmt(dailyAvg)}</p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">Peak day</p>
          <p className="text-[13px] font-semibold tabular-nums text-expense-text">{peakDay ? fmt(peakDay.amount) : '—'}</p>
          {peakDayDate && onReviewPeakDay && (
            <button
              type="button"
              onClick={() => onReviewPeakDay(peakDayDate)}
              className="text-[10px] font-semibold text-brand hover:underline mt-0.5"
            >
              Inspect day
            </button>
          )}
        </div>
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">Zero-spend days</p>
          <p className="text-[13px] font-semibold tabular-nums text-income-text">{zeroDays}</p>
        </div>
      </div>

      <div className="rounded-card bg-kosha-surface-2 p-2.5">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={seriesWithFlags} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--ds-border)" />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 9, fill: 'var(--ds-text-3)' }}
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
            <Tooltip content={<DailySpendTooltip />} />
            <ReferenceLine y={dailyAvg} stroke="rgba(0,127,255,0.35)" strokeDasharray="4 4" label={false} />
            <Bar dataKey="amount" radius={[3, 3, 0, 0]} maxBarSize={12}>
              {seriesWithFlags.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isAboveAvg ? '#E8453C' : '#007FFF'}
                  fillOpacity={entry.amount > 0 ? 0.78 : 0.15}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-4 mt-2">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: '#007FFF' }} />
          <span className="text-[10px] text-ink-3">Below avg</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: '#E8453C' }} />
          <span className="text-[10px] text-ink-3">Above avg</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-0.5 border-t border-dashed border-ink-3" />
          <span className="text-[10px] text-ink-3">Avg {fmt(dailyAvg)}/day</span>
        </div>
      </div>
    </div>
  )
})
