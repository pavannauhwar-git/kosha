import { useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import {
  LineChart,
  Line,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
  Legend,
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

function metricDelta(current, previous) {
  const c = Number(current || 0)
  const p = Number(previous || 0)

  if (p === 0) return null

  return Math.round(((c - p) / p) * 100)
}

function mean(values) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function stdDev(values, avg) {
  if (values.length < 2) return 0
  const variance = values.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / values.length
  return Math.sqrt(variance)
}

const ANOMALY_SENSITIVITY = {
  strict: {
    label: 'Strict',
    threshold: 1.45,
    bandMultiplier: 0.9,
  },
  balanced: {
    label: 'Balanced',
    threshold: 1.15,
    bandMultiplier: 1.1,
  },
  sensitive: {
    label: 'Sensitive',
    threshold: 0.9,
    bandMultiplier: 1.35,
  },
}

const ANOMALY_SENSITIVITY_ORDER = ['strict', 'balanced', 'sensitive']

function yAxisTickFormatter(value) {
  const n = Number(value || 0)
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${Math.round((n / 1_000_000) * 10) / 10}M`
  if (abs >= 1_000) return `${Math.round(n / 1_000)}k`
  return `${Math.round(n)}`
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

export default function YoYCards({ years, currentYear, enabled = true, rangeYears = 3, onRangeChange }) {
  const [showAnomalies, setShowAnomalies] = useState(true)
  const [showConfidenceBand, setShowConfidenceBand] = useState(true)
  const [anomalySensitivity, setAnomalySensitivity] = useState('balanced')

  const sensitivity = ANOMALY_SENSITIVITY[anomalySensitivity] || ANOMALY_SENSITIVITY.balanced

  const yearQueries = useQueries({
    queries: years.map((year) => ({
      // Use a dedicated cache key to avoid colliding with useYearSummary(['year', year])
      // which returns a richer payload (monthly/category/top5) for the Analytics page.
      queryKey: ['yearYoy', year],
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

  const chartPoints = useMemo(() => {
    if (!points.length) return []

    const earnedValues = points.map((point) => Number(point?.earned || 0))
    const spentValues = points.map((point) => Number(point?.spent || 0))
    const investedValues = points.map((point) => Number(point?.invested || 0))

    const earnedAvg = mean(earnedValues)
    const spentAvg = mean(spentValues)
    const investedAvg = mean(investedValues)

    const earnedStd = stdDev(earnedValues, earnedAvg)
    const spentStd = stdDev(spentValues, spentAvg)
    const investedStd = stdDev(investedValues, investedAvg)

    return points.map((point, index) => {
      const windowStart = Math.max(0, index - 1)
      const windowEnd = Math.min(points.length - 1, index + 1)
      const localWindow = points.slice(windowStart, windowEnd + 1)
      const localEarned = localWindow.map((item) => Number(item?.earned || 0))
      const localAvg = mean(localEarned)
      const localStd = stdDev(localEarned, localAvg)
      const bandRadius = Math.max(500, localStd * sensitivity.bandMultiplier)
      const bandLow = Math.max(0, localAvg - bandRadius)
      const bandHigh = localAvg + bandRadius

      const earnedZ = earnedStd > 0 ? Math.abs((point.earned - earnedAvg) / earnedStd) : 0
      const spentZ = spentStd > 0 ? Math.abs((point.spent - spentAvg) / spentStd) : 0
      const investedZ = investedStd > 0 ? Math.abs((point.invested - investedAvg) / investedStd) : 0

      return {
        ...point,
        earnedBandLow: bandLow,
        earnedBandRange: Math.max(0, bandHigh - bandLow),
        anomalies: {
          earned: earnedStd > 0 && earnedZ >= sensitivity.threshold,
          spent: spentStd > 0 && spentZ >= sensitivity.threshold,
          invested: investedStd > 0 && investedZ >= sensitivity.threshold,
        },
      }
    })
  }, [points, sensitivity.bandMultiplier, sensitivity.threshold])

  const currentPoint = useMemo(
    () => chartPoints.find((p) => p.year === currentYear) || chartPoints[chartPoints.length - 1] || null,
    [chartPoints, currentYear]
  )

  const previousPoint = useMemo(() => {
    if (!currentPoint) return null
    const idx = chartPoints.findIndex((p) => p.year === currentPoint.year)
    return idx > 0 ? chartPoints[idx - 1] : null
  }, [chartPoints, currentPoint])

  const anomalySummary = useMemo(() => {
    const metricLabel = {
      earned: 'Earned',
      spent: 'Spent',
      invested: 'Invested',
    }

    return chartPoints
      .flatMap((point) => Object.entries(point?.anomalies || {})
        .filter(([, flagged]) => flagged)
        .map(([metric]) => ({
          metric,
          year: point.year,
          value: Number(point?.[metric] || 0),
        })))
      .sort((a, b) => b.value - a.value)
      .slice(0, 3)
      .map((row) => `${metricLabel[row.metric]} spike in ${row.year} (${fmt(row.value)})`)
  }, [chartPoints])

  const renderDot = (metricKey, color) => ({ cx, cy, payload }) => {
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null
    const isAnomaly = !!payload?.anomalies?.[metricKey]

    if (showAnomalies && isAnomaly) {
      return (
        <g>
          <circle cx={cx} cy={cy} r={7} fill="rgba(244, 63, 94, 0.17)" />
          <circle cx={cx} cy={cy} r={3.8} fill={color} stroke="#FFFFFF" strokeWidth={1.4} />
        </g>
      )
    }

    return <circle cx={cx} cy={cy} r={3} fill={color} />
  }

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

  if (chartPoints.length === 0) {
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
    <div className="card p-4 w-full transition-transform duration-150 hover:-translate-y-0.5">
      <div className="flex items-center justify-between mb-2">
        <p className="section-label">Year over year trends</p>
        {onRangeChange ? (
          <div className="inline-flex rounded-full border border-kosha-border bg-kosha-surface p-0.5">
            {[3, 5, 7, 9, 11].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => onRangeChange(value)}
                className={`h-7 min-w-[2rem] px-2 text-[10px] sm:text-[10.5px] font-semibold rounded-full transition-colors ${
                  value === rangeYears
                    ? 'bg-brand text-white'
                    : 'text-ink-2 hover:bg-kosha-surface-2'
                }`}
              >
                {value}
              </button>
            ))}
          </div>
        ) : (
        <span className="text-caption text-ink-3">Last {rangeYears} year{rangeYears > 1 ? 's' : ''}</span>
        )}
      </div>

      <div className="flex flex-wrap justify-end gap-1.5 mb-2.5">
        <button
          type="button"
          onClick={() => setShowAnomalies((value) => !value)}
          className={`chip-control chip-control-sm ${showAnomalies ? 'chip-control-active' : 'chip-control-muted'}`}
        >
          Anomaly markers
        </button>
        <button
          type="button"
          onClick={() => setShowConfidenceBand((value) => !value)}
          className={`chip-control chip-control-sm ${showConfidenceBand ? 'chip-control-active' : 'chip-control-muted'}`}
        >
          Confidence band
        </button>
      </div>

      {showAnomalies && (
        <div className="flex items-center justify-end gap-1.5 mb-2.5">
          <span className="text-[10px] text-ink-3">Sensitivity</span>
          <div className="inline-flex rounded-pill border border-kosha-border bg-kosha-surface p-0.5">
            {ANOMALY_SENSITIVITY_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setAnomalySensitivity(id)}
                className={`h-6 px-2 rounded-pill text-[10px] font-semibold transition-colors ${anomalySensitivity === id ? 'bg-brand text-white' : 'text-ink-2 hover:bg-kosha-surface-2'}`}
              >
                {ANOMALY_SENSITIVITY[id].label}
              </button>
            ))}
          </div>
        </div>
      )}

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

      <div className="h-[228px] sm:h-[238px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartPoints} margin={{ top: 10, right: 14, left: 6, bottom: 2 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(88, 94, 114, 0.18)" />
            <XAxis
              dataKey="year"
              padding={{ left: 12, right: 12 }}
              interval="preserveStartEnd"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: 'var(--c-text-secondary)' }}
            />
            <YAxis
              tickFormatter={yAxisTickFormatter}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={42}
              tickMargin={4}
              tickCount={5}
              tick={{ fontSize: 11, fill: 'var(--c-text-secondary)' }}
            />
            <Tooltip content={<YoYTooltip />} />
            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: 6 }} />

            {showConfidenceBand && (
              <>
                <Area
                  type="monotone"
                  dataKey="earnedBandLow"
                  stackId="earned-band"
                  stroke="none"
                  fill="transparent"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="earnedBandRange"
                  stackId="earned-band"
                  stroke="none"
                  fill="rgba(34, 197, 139, 0.14)"
                  fillOpacity={1}
                  isAnimationActive={false}
                  name="Earned confidence"
                />
              </>
            )}

            <Line
              type="monotone"
              dataKey="earned"
              name="Earned"
              stroke="var(--c-income)"
              strokeWidth={2.6}
              dot={renderDot('earned', 'var(--c-income)')}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="spent"
              name="Spent"
              stroke="var(--c-expense-bright)"
              strokeWidth={2.4}
              dot={renderDot('spent', 'var(--c-expense-bright)')}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="invested"
              name="Invested"
              stroke="var(--c-invest-text)"
              strokeWidth={2.4}
              dot={renderDot('invested', 'var(--c-invest-text)')}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {showAnomalies && (
        <div className="pt-2 space-y-1">
          {anomalySummary.length > 0 ? (
            anomalySummary.map((line) => (
              <p key={line} className="text-[11px] text-ink-3">{line}</p>
            ))
          ) : (
            <p className="text-[11px] text-ink-3">No anomaly points at {sensitivity.label.toLowerCase()} sensitivity.</p>
          )}
        </div>
      )}
    </div>
  )
}
