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

export default memo(function DailySpendTrend({ txnRows, year, month }) {
  const daysInMonth = new Date(year, month, 0).getDate()

  // Aggregate expense per day
  const dailyMap = new Map()
  for (const row of (Array.isArray(txnRows) ? txnRows : [])) {
    if (row?.type !== 'expense') continue
    const amount = Number(row?.amount || 0)
    if (!Number.isFinite(amount) || amount <= 0) continue
    const day = Number(String(row?.date || '').slice(8, 10))
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

  const peakDay = activeDays.sort((a, b) => b.amount - a.amount)[0]
  const spendDays = activeDays.length
  const zeroDays = daysInMonth - spendDays

  return (
    <div className="card p-4 border-0">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="section-label">Daily spend pattern</p>
          <p className="text-[11px] text-ink-3 mt-0.5">Expense distribution across the month with daily average</p>
        </div>
        <span className="text-[10px] px-2 py-1 rounded-pill font-semibold bg-kosha-surface-2 text-ink-2">
          {spendDays} active day{spendDays === 1 ? '' : 's'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2.5">
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">Daily average</p>
          <p className="text-[13px] font-semibold tabular-nums text-ink">{fmt(dailyAvg)}</p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">Peak day</p>
          <p className="text-[13px] font-semibold tabular-nums text-expense-text">{peakDay ? fmt(peakDay.amount) : '—'}</p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">Zero-spend days</p>
          <p className="text-[13px] font-semibold tabular-nums text-income-text">{zeroDays}</p>
        </div>
      </div>

      <div className="rounded-card bg-kosha-surface-2 p-2.5">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={seriesWithFlags} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(26,26,46,0.06)" />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 9, fill: 'rgba(107,107,128,0.9)' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={compactTick}
              tick={{ fontSize: 10, fill: 'rgba(107,107,128,0.9)' }}
              axisLine={false}
              tickLine={false}
              width={34}
            />
            <Tooltip content={<DailySpendTooltip />} />
            <ReferenceLine y={dailyAvg} stroke="rgba(26,26,46,0.35)" strokeDasharray="4 4" label={false} />
            <Bar dataKey="amount" radius={[3, 3, 0, 0]} maxBarSize={12}>
              {seriesWithFlags.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isAboveAvg ? '#C4384A' : '#1A1A2E'}
                  fillOpacity={entry.amount > 0 ? 0.78 : 0.15}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center gap-4 mt-2">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: '#1A1A2E' }} />
          <span className="text-[10px] text-ink-3">Below avg</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ background: '#C4384A' }} />
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
