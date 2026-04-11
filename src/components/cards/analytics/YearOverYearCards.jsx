import { useEffect, useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts'
import { supabase } from '../../../lib/supabase'
import { getAuthUserId } from '../../../lib/authStore'
import { fmt } from '../../../lib/utils'

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

function tickCompact(value) {
  const n = Number(value || 0)
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${Math.round((n / 1_000_000) * 10) / 10}M`
  if (abs >= 1_000) return `${Math.round(n / 1_000)}k`
  return `${Math.round(n)}`
}

function deltaPct(current, previous) {
  const c = Number(current || 0)
  const p = Number(previous || 0)
  if (p === 0) return null
  return Math.round(((c - p) / p) * 100)
}

function MetricTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  return (
    <div className="tooltip-enter rounded-card bg-kosha-surface-2 p-3 shadow-card min-w-[180px]">
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

function NetTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload || {}

  return (
    <div className="tooltip-enter rounded-card bg-kosha-surface-2 p-3 shadow-card min-w-[172px]">
      <p className="text-[11px] font-semibold text-ink mb-1">{label}</p>
      <div className="flex items-center justify-between gap-3 text-[11px]">
        <span className="text-ink-3">Net</span>
        <span className={`font-semibold tabular-nums ${Number(row.net || 0) >= 0 ? 'text-income-text' : 'text-warning-text'}`}>
          {Number(row.net || 0) >= 0 ? '+' : '-'}{fmt(Math.abs(Number(row.net || 0)), true)}
        </span>
      </div>
    </div>
  )
}

export default function YearOverYearCards({ years, currentYear, enabled = true }) {
  const yearQueries = useQueries({
    queries: years.map((year) => ({
      queryKey: ['yearYoy', year],
      queryFn: () => fetchYearSummary(year),
      enabled,
      staleTime: 5 * 60 * 1000,
    })),
  })

  const isLoading = yearQueries.some((q) => q.isLoading || q.isFetching)

  const points = useMemo(() => {
    return years.map((year, idx) => {
      const payload = yearQueries[idx]?.data || {}
      const income = Number(payload.totalIncome || 0)
      const spent = Number(payload.totalExpense || 0)
      const invested = Number(payload.totalInvestment || 0)

      return {
        year,
        income,
        spent,
        invested,
        net: income - spent - invested,
      }
    })
  }, [years, yearQueries])

  const selectableYears = useMemo(
    () => points
      .map((row) => row.year)
      .filter((year) => year !== currentYear),
    [points, currentYear]
  )

  const [compareYear, setCompareYear] = useState(() => selectableYears[selectableYears.length - 1] || null)

  useEffect(() => {
    if (!selectableYears.length) {
      setCompareYear(null)
      return
    }

    if (!selectableYears.includes(compareYear)) {
      setCompareYear(selectableYears[selectableYears.length - 1])
    }
  }, [selectableYears, compareYear])

  const currentPoint = useMemo(
    () => points.find((row) => row.year === currentYear) || null,
    [points, currentYear]
  )

  const comparePoint = useMemo(() => {
    if (compareYear == null) return null
    return points.find((row) => row.year === compareYear) || null
  }, [points, compareYear])

  if (isLoading && !currentPoint) {
    return (
      <div className="card p-4 border-0">
        <div className="flex items-center justify-between mb-2">
          <p className="section-label">Year over year trends</p>
          <span className="text-caption text-ink-3">Loading</span>
        </div>
        <p className="text-[12px] text-ink-3">Loading yearly comparison...</p>
      </div>
    )
  }

  if (!currentPoint || !comparePoint) {
    return (
      <div className="card p-4 border-0">
        <div className="flex items-center justify-between mb-2">
          <p className="section-label">Year over year trends</p>
          <span className="text-caption text-ink-3">No history</span>
        </div>
        <p className="text-[12px] text-ink-3">Need at least two years of data to compare trends.</p>
      </div>
    )
  }

  const metricRows = [
    {
      label: 'Income',
      current: currentPoint.income,
      compare: comparePoint.income,
      tone: 'text-income-text',
    },
    {
      label: 'Spent',
      current: currentPoint.spent,
      compare: comparePoint.spent,
      tone: 'text-expense-text',
    },
    {
      label: 'Invested',
      current: currentPoint.invested,
      compare: comparePoint.invested,
      tone: 'text-invest-text',
    },
    {
      label: 'Net',
      current: currentPoint.net,
      compare: comparePoint.net,
      tone: currentPoint.net >= 0 ? 'text-income-text' : 'text-warning-text',
    },
  ]

  const comparisonChartRows = metricRows.map((row) => ({
    metric: row.label,
    current: row.current,
    compare: row.compare,
  }))

  const trendRows = points.map((row) => ({
    ...row,
    barColor: row.year === currentYear
      ? '#007FFF'
      : row.year === compareYear
        ? '#F9A825'
        : 'rgba(0,127,255,0.22)',
  }))

  return (
    <div className="card p-4 border-0">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <div>
          <p className="section-label">Year over year trends</p>
          <p className="text-[11px] text-ink-3 mt-0.5">Compare the selected year against another year and inspect long-term net trend.</p>
        </div>

        <label className="flex items-center gap-2 text-[11px] text-ink-3">
          Compare with
          <select
            name="yoy-compare-year"
            value={compareYear || ''}
            onChange={(event) => setCompareYear(Number(event.target.value))}
            className="h-8 px-2 rounded-card border border-kosha-border bg-kosha-surface text-ink"
          >
            {selectableYears.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2.5">
        {metricRows.map((row) => {
          const delta = deltaPct(row.current, row.compare)
          return (
            <div key={`metric-${row.label}`} className="rounded-card bg-kosha-surface-2 p-2.5">
              <p className="text-[10px] text-ink-3">{row.label}</p>
              <p className={`text-[13px] font-semibold tabular-nums ${row.tone}`}>{fmt(row.current, true)}</p>
              <p className="text-[10px] text-ink-3 mt-0.5">
                vs {compareYear}: {delta == null ? 'n/a' : `${delta >= 0 ? '+' : ''}${delta}%`}
              </p>
            </div>
          )
        })}
      </div>

      <div className="rounded-card bg-kosha-surface-2 p-3 mb-2.5">
        <p className="text-[10px] text-ink-3 mb-1.5">Metric comparison: {currentYear} vs {compareYear}</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={comparisonChartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--ds-border)" />
            <XAxis
              dataKey="metric"
              tick={{ fontSize: 10, fill: 'var(--ds-text-3)', fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={tickCompact}
              tick={{ fontSize: 10, fill: 'var(--ds-text-3)' }}
              axisLine={false}
              tickLine={false}
              width={34}
            />
            <Tooltip content={<MetricTooltip />} />
            <Bar dataKey="compare" name={String(compareYear)} fill="#F9A825" radius={[6, 6, 0, 0]} maxBarSize={20} />
            <Bar dataKey="current" name={String(currentYear)} fill="#007FFF" radius={[6, 6, 0, 0]} maxBarSize={20} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-card bg-kosha-surface-2 p-2.5">
        <p className="text-[10px] text-ink-3 mb-1.5">Net trend by year</p>
        <ResponsiveContainer width="100%" height={168}>
          <BarChart data={trendRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="var(--ds-border)" />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 10, fill: 'var(--ds-text-3)', fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={tickCompact}
              tick={{ fontSize: 10, fill: 'var(--ds-text-3)' }}
              axisLine={false}
              tickLine={false}
              width={34}
            />
            <Tooltip content={<NetTooltip />} />
            <Bar dataKey="net" radius={[6, 6, 0, 0]}>
              {trendRows.map((row) => (
                <Cell key={`net-year-${row.year}`} fill={row.barColor} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
