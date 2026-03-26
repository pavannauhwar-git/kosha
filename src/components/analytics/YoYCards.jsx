import { useMemo } from 'react'
import { useQueries } from '@tanstack/react-query'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts'
import { supabase } from '../../lib/supabase'
import { getAuthUserId } from '../../lib/authStore'
import { fmt } from '../../lib/utils'

async function fetchYearSummary(year) {
  const userId = getAuthUserId()

  const { data: result, error } = await supabase
    .rpc('get_year_summary', { p_user_id: userId, p_year: year })
    .maybeSingle()

  if (error) throw error
  if (!result) {
    return {
      totalIncome: 0,
      totalExpense: 0,
      totalInvestment: 0,
    }
  }

  const totals = result.totals || {}

  return {
    totalIncome: Number(totals.income || 0),
    totalExpense: Number(totals.expense || 0),
    totalInvestment: Number(totals.investment || 0),
  }
}

function metricDelta(current, previous) {
  const c = Number(current || 0)
  const p = Number(previous || 0)

  if (p === 0) {
    if (c === 0) return 0
    return 100
  }

  return Math.round(((c - p) / p) * 100)
}

function YoYTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5 shadow-card">
      <p className="text-[11px] font-semibold text-ink mb-1">{label}</p>
      {payload.map((row) => (
        <div key={row.dataKey} className="flex items-center justify-between gap-3 text-[11px]">
          <span style={{ color: row.color }}>{row.name}</span>
          <span className="font-semibold text-ink tabular-nums">{fmt(Number(row.value || 0), true)}</span>
        </div>
      ))}
    </div>
  )
}

export default function YoYCards({ years, currentYear, enabled = true, rangeYears = 5 }) {
  const yearQueries = useQueries({
    queries: years.map((year) => ({
      queryKey: ['year', year],
      queryFn: () => fetchYearSummary(year),
      enabled,
      staleTime: 5 * 60 * 1000,
    })),
  })

  const isLoading = yearQueries.some((q) => q.isLoading || q.isFetching)

  const points = useMemo(() => {
    return years
      .map((year, idx) => {
        const data = yearQueries[idx]?.data
        if (!data) return {
          year,
          earned: 0,
          spent: 0,
          invested: 0,
        }
        const earned = Number(data.totalIncome || 0)
        const spent = Number(data.totalExpense || 0)
        const invested = Number(data.totalInvestment || 0)
        return {
          year,
          earned,
          spent,
          invested,
        }
        })
  }, [years, yearQueries])

  const currentPoint = useMemo(
    () => points.find((p) => p.year === currentYear) || points[points.length - 1] || null,
    [points, currentYear]
  )

  const previousPoint = useMemo(() => {
    if (!currentPoint) return null
    const idx = points.findIndex((p) => p.year === currentPoint.year)
    return idx > 0 ? points[idx - 1] : null
  }, [points, currentPoint])

  if (isLoading) {
    return (
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="section-label">Year over year trends</p>
          <span className="text-caption text-ink-3">Loading</span>
        </div>
        <p className="text-[12px] text-ink-3">Loading yearly comparison...</p>
      </div>
    )
  }

  if (points.length === 0) {
    return (
      <div className="card p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="section-label">Year over year trends</p>
          <span className="text-caption text-ink-3">No history</span>
        </div>
        <p className="text-[12px] text-ink-3">No yearly data available yet for this range.</p>
      </div>
    )
  }

  const deltas = [
    {
      label: 'Earned',
      delta: previousPoint ? metricDelta(currentPoint.earned, previousPoint?.earned) : null,
      tone: 'text-income-text',
    },
    {
      label: 'Spent',
      delta: previousPoint ? metricDelta(currentPoint.spent, previousPoint?.spent) : null,
      tone: 'text-expense-text',
    },
    {
      label: 'Invested',
      delta: previousPoint ? metricDelta(currentPoint.invested, previousPoint?.invested) : null,
      tone: 'text-invest-text',
    },
  ]

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="section-label">Year over year trends</p>
        <span className="text-caption text-ink-3">Last {rangeYears} year{rangeYears > 1 ? 's' : ''}</span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2.5">
        {deltas.map((row) => (
          <div key={row.label} className="rounded-card border border-kosha-border bg-kosha-surface p-2">
            <p className="text-[10px] text-ink-3">{row.label}</p>
            <p className={`text-[12px] font-bold tabular-nums ${row.tone}`}>
              {row.delta === null
                ? '—'
                : `${row.delta > 0 ? '+' : ''}${row.delta}%`}
            </p>
          </div>
        ))}
      </div>

      <div className="h-[230px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 8, left: -4, bottom: 2 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(88, 94, 114, 0.18)" />
            <XAxis
              dataKey="year"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: 'var(--c-text-secondary)' }}
            />
            <YAxis
              tickFormatter={(v) => `${Math.round(v / 1000)}k`}
              tickLine={false}
              axisLine={false}
              width={38}
              tick={{ fontSize: 11, fill: 'var(--c-text-secondary)' }}
            />
            <Tooltip content={<YoYTooltip />} />
            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: 6 }} />

            <Line
              type="monotone"
              dataKey="earned"
              name="Earned"
              stroke="var(--c-income)"
              strokeWidth={2.6}
              dot={{ r: 3, strokeWidth: 0, fill: 'var(--c-income)' }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="spent"
              name="Spent"
              stroke="var(--c-expense-bright)"
              strokeWidth={2.4}
              dot={{ r: 3, strokeWidth: 0, fill: 'var(--c-expense-bright)' }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="invested"
              name="Invested"
              stroke="var(--c-invest-text)"
              strokeWidth={2.4}
              dot={{ r: 3, strokeWidth: 0, fill: 'var(--c-invest-text)' }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
