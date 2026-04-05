import { memo, useEffect, useMemo, useState } from 'react'
import {
  BarChart, Bar,
  AreaChart, Area,
  LineChart, Line,
  CartesianGrid,
  XAxis, YAxis, Tooltip, ReferenceLine,
  ResponsiveContainer, Cell,
} from 'recharts'
import { fmt } from '../../lib/utils'
import { C } from '../../lib/colors'

function toFiniteNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function mean(values) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function standardDeviation(values, avg) {
  if (values.length < 2) return 0
  const variance = values.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / values.length
  return Math.sqrt(variance)
}

function computeVolatility(values) {
  const clean = (Array.isArray(values) ? values : [])
    .map(toFiniteNumber)
    .filter((value) => value > 0)

  if (clean.length < 2) {
    return {
      score: null,
      cv: null,
      mean: mean(clean),
      sampleSize: clean.length,
    }
  }

  const avg = mean(clean)
  const deviation = standardDeviation(clean, avg)
  const cv = avg > 0 ? deviation / avg : null
  const score = clampNumber(Math.round(100 - ((cv || 0) * 95)), 0, 100)

  return {
    score,
    cv,
    mean: avg,
    sampleSize: clean.length,
  }
}

function scoreTone(score) {
  if (score == null) {
    return {
      label: 'Insufficient data',
      color: 'rgba(26,26,46,0.72)',
      fill: 'rgba(157,170,198,0.5)',
    }
  }

  if (score >= 75) {
    return {
      label: 'Stable',
      color: C.brand,
      fill: C.brand,
    }
  }

  if (score >= 50) {
    return {
      label: 'Moderate',
      color: C.bills,
      fill: C.accent,
    }
  }

  return {
    label: 'Volatile',
    color: C.bills,
    fill: C.bills,
  }
}

// ── Tooltips ──────────────────────────────────────────────────────────────

const PulseTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null

  const point = payload?.[0]?.payload || {}
  const income = toFiniteNumber(point?.Income)
  const spent = toFiniteNumber(point?.Spent)
  const invested = toFiniteNumber(point?.Invested)
  const outflow = toFiniteNumber(point?.Outflow)
  const pulse = toFiniteNumber(point?.Pulse)
  const pulsePct = income > 0 ? Math.round((pulse / income) * 100) : 0
  const pulseColor = pulse >= 0 ? C.brandMid : C.accent

  return (
    <div className="tooltip-enter" style={{
      background: '#FFFFFF',
      borderRadius: 12,
      padding: '10px 12px',
      boxShadow: '0 8px 18px rgba(26,26,46,0.14)',
      minWidth: 176,
      border: '1px solid rgba(187,217,255,0.85)',
    }}>
      <p style={{
        fontSize: 11,
        fontWeight: 700,
        color: '#1D355F',
        letterSpacing: '0.03em',
        marginBottom: 6,
        textTransform: 'uppercase',
      }}>
        {label}
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: '#5E6D8F' }}>Income</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.chartIncome }}>{fmt(income)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: '#5E6D8F' }}>Spent</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.chartExpense }}>{fmt(spent)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: '#5E6D8F' }}>Invested</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.invest }}>{fmt(invested)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: '#5E6D8F' }}>Outflow</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.heroAccentSolid }}>{fmt(outflow)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <span style={{ fontSize: 12, color: '#5E6D8F' }}>Pulse</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: pulseColor }}>
          {pulse >= 0 ? '+' : '-'}{fmt(Math.abs(pulse))} ({pulsePct}%)
        </span>
      </div>
    </div>
  )
}

const NetTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const netPayload = payload.find((point) => point?.dataKey === 'Net') || payload[0]
  const val        = Number(netPayload?.value || 0)
  const valueColor = val >= 0 ? C.brandMid : C.bills
  return (
    <div className="tooltip-enter" style={{
      background: 'rgba(34,43,109,0.96)',
      borderRadius: 12,
      padding: '10px 14px',
      boxShadow: '0px 4px 8px 3px rgba(0,0,0,0.15)',
      minWidth: 140,
      border: '0.5px solid rgba(255,255,255,0.10)',
    }}>
      <p style={{
        fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.5)',
        letterSpacing: '0.04em', marginBottom: 6, textTransform: 'uppercase',
      }}>
        {label}
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)' }}>Leftover</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: valueColor }}>{fmt(val)}</span>
      </div>
    </div>
  )
}

// ── CashFlow chart ─────────────────────────────────────────────────────────

export const CashFlowChart = memo(function CashFlowChart({ chartData, totalIncome }) {
  const safeData = (Array.isArray(chartData) ? chartData : []).map((point) => ({
    name: point?.name || '-',
    Income: toFiniteNumber(point?.Income),
    Spent: toFiniteNumber(point?.Spent),
    Invested: toFiniteNumber(point?.Invested),
    Outflow: toFiniteNumber(point?.Outflow || (toFiniteNumber(point?.Spent) + toFiniteNumber(point?.Invested))),
    Pulse: toFiniteNumber(point?.Income) - toFiniteNumber(point?.Outflow || (toFiniteNumber(point?.Spent) + toFiniteNumber(point?.Invested))),
  }))

  if (!safeData.length) return null

  const chartH = safeData.length <= 4 ? 190 : 230
  const totalIncomeSafe = safeData.reduce((sum, point) => sum + toFiniteNumber(point.Income), 0)
  const totalSpent = safeData.reduce((sum, point) => sum + toFiniteNumber(point.Spent), 0)
  const totalInvested = safeData.reduce((sum, point) => sum + toFiniteNumber(point.Invested), 0)
  const totalOutflow = safeData.reduce((sum, point) => sum + toFiniteNumber(point.Outflow), 0)
  const totalNet = safeData.reduce((sum, point) => sum + toFiniteNumber(point.Pulse), 0)
  const strongestMonth = safeData.reduce((best, point) => {
    if (!best || point.Pulse > best.pulse) return { name: point.name, pulse: point.Pulse }
    return best
  }, null)
  const weakestMonth = safeData.reduce((worst, point) => {
    if (!worst || point.Pulse < worst.pulse) return { name: point.name, pulse: point.Pulse }
    return worst
  }, null)
  const positivePulseMonths = safeData.filter((point) => point.Pulse >= 0).length
  const spendVelocity = totalIncomeSafe > 0
    ? Math.round((totalOutflow / totalIncomeSafe) * 100)
    : 0
  const pulseAxisMax = Math.max(
    1000,
    Math.ceil(Math.max(...safeData.map((point) => Math.abs(toFiniteNumber(point.Pulse))), 0) * 1.15)
  )

  return (
    <div className="card p-4 transition-transform duration-150 hover:-translate-y-0.5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-label font-semibold" style={{ color: 'rgba(31,37,95,0.92)' }}>
            Cash Flow Pulse
          </p>
          <p style={{ fontSize: 11, color: 'rgba(26,26,46,0.55)', marginTop: 2 }}>
            Monthly surplus/deficit rhythm
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold tabular-nums"
            style={{
              fontSize: 15,
              color: totalNet >= 0 ? C.brand : C.bills,
              letterSpacing: '-0.01em',
            }}>
            {totalNet >= 0 ? '+' : '-'}{fmt(Math.abs(totalNet), true)}
          </p>
          <p style={{ fontSize: 10, color: 'rgba(26,26,46,0.55)', marginTop: 1 }}>net pulse</p>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 md:grid-cols-5 gap-2">
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">Income</p>
          <p className="text-[13px] font-semibold tabular-nums text-income-text">{fmt(totalIncome || totalIncomeSafe, true)}</p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">Outflow</p>
          <p className="text-[13px] font-semibold tabular-nums text-expense-text">{fmt(totalOutflow, true)}</p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">Investment</p>
          <p className="text-[13px] font-semibold tabular-nums text-invest-text">{fmt(totalInvested, true)}</p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">Positive months</p>
          <p className="text-[13px] font-semibold tabular-nums text-ink">{positivePulseMonths}/{safeData.length}</p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">Spend velocity</p>
          <p className={`text-[13px] font-semibold tabular-nums ${spendVelocity <= 85 ? 'text-income-text' : 'text-warning-text'}`}>
            {spendVelocity}%
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={chartH}>
        <BarChart data={safeData} margin={{ top: 8, right: 12, left: 12, bottom: 0 }}>
          <XAxis dataKey="name"
            tick={{ fontSize: 11, fill: 'rgba(26,26,46,0.58)', fontWeight: 500 }}
            axisLine={false} tickLine={false} interval={0}
          />
          <YAxis hide domain={[-pulseAxisMax, pulseAxisMax]} />
          <Tooltip content={<PulseTooltip />} cursor={{ fill: 'rgba(31,37,95,0.06)' }} />
          <ReferenceLine y={0} stroke="rgba(31,37,95,0.24)" strokeWidth={1} />
          <Bar dataKey="Pulse" radius={[8, 8, 8, 8]} maxBarSize={28}>
            {safeData.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.Pulse >= 0 ? C.brandMid : C.accent}
                fillOpacity={0.92}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap justify-between gap-2 pb-1 pt-2">
        <div className="text-[11px] text-ink-3">
          Best pulse: <span className="font-semibold text-accent">{strongestMonth?.name || '—'}</span>
        </div>
        <div className="text-[11px] text-ink-3">
          Stress month: <span className="font-semibold text-warning-text">{weakestMonth?.name || '—'}</span>
        </div>
      </div>

      <div className="flex justify-center gap-6 pb-1 pt-1">
        {[['Surplus pulse', C.brandMid], ['Deficit pulse', C.accent]].map(([l, c]) => (
          <div key={l} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: c }} />
            <span style={{ fontSize: 11, color: 'rgba(26,26,46,0.60)', fontWeight: 500 }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  )
})

// ── NetSavings chart ───────────────────────────────────────────────────────

export const NetSavingsChart = memo(function NetSavingsChart({ netData, netAxisMax }) {
  const safeData = (Array.isArray(netData) ? netData : []).map((point) => ({
    name: point?.name || '-',
    Net: toFiniteNumber(point?.Net),
  }))

  if (!safeData.length) return null

  const safeAxisMax = Math.max(1000, toFiniteNumber(netAxisMax))

  const totalNet = safeData.reduce((s, m) => s + toFiniteNumber(m.Net), 0)
  const positiveMonths = safeData.filter((m) => toFiniteNumber(m.Net) >= 0).length
  const bestMonth = safeData.reduce((best, point) => {
    const val = toFiniteNumber(point.Net)
    if (!best || val > best.value) return { name: point.name, value: val }
    return best
  }, null)
  const worstMonth = safeData.reduce((worst, point) => {
    const val = toFiniteNumber(point.Net)
    if (!worst || val < worst.value) return { name: point.name, value: val }
    return worst
  }, null)

  return (
    <div className="card p-4 transition-transform duration-150 hover:-translate-y-0.5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-label font-semibold" style={{ color: 'rgba(31,37,95,0.92)' }}>
            Leftover / Surplus
          </p>
          <p style={{ fontSize: 11, color: 'rgba(26,26,46,0.55)', marginTop: 2 }}>
            Income minus expenses and investments
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold tabular-nums" style={{
            fontSize: 15,
            color: totalNet >= 0 ? C.brand : C.bills,
            letterSpacing: '-0.01em',
          }}>
            {totalNet >= 0 ? '+' : '-'}{fmt(Math.abs(totalNet), true)}
          </p>
          <p style={{ fontSize: 10, color: 'rgba(26,26,46,0.55)', marginTop: 1 }}>
            {totalNet >= 0 ? 'year surplus' : 'year deficit'}
          </p>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">Positive months</p>
          <p className="text-[13px] font-semibold tabular-nums text-ink">{positiveMonths}/{netData.length}</p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">Highest surplus</p>
          <p className="text-[13px] font-semibold tabular-nums text-ink">{bestMonth?.name || '—'}</p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">Deepest deficit</p>
          <p className="text-[13px] font-semibold tabular-nums text-warning-text">{worstMonth?.name || '—'}</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={safeData} margin={{ top: 4, right: 12, left: 12, bottom: 0 }}>
          <XAxis dataKey="name"
            tick={{ fontSize: 11, fill: 'rgba(26,26,46,0.58)', fontWeight: 500 }}
            axisLine={false} tickLine={false} interval={0}
          />
          <YAxis hide domain={[-safeAxisMax, safeAxisMax]} />
          <Tooltip content={<NetTooltip />} cursor={{ fill: 'rgba(31,37,95,0.06)' }} />
          <ReferenceLine y={0} stroke="rgba(31,37,95,0.22)" strokeWidth={1} />
          <Bar dataKey="Net" radius={[8, 8, 8, 8]} maxBarSize={26}>
            {safeData.map((entry, i) => (
              <Cell key={i}
                fill={entry.Net >= 0 ? C.brandMid : C.accent}
                fillOpacity={0.90}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex justify-center gap-6 pt-2">
        {[['Surplus', C.brandMid], ['Deficit', C.accent]].map(([label, color]) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="text-[11px] text-ink-3">{label}</span>
          </div>
        ))}
      </div>
      <div className="pt-2 text-[11px] text-ink-3">Monthly leftover after expenses and investments.</div>
    </div>
  )
})

const FlowCompareTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload || {}

  return (
    <div className="tooltip-enter" style={{
      background: '#FFFFFF',
      borderRadius: 12,
      padding: '10px 12px',
      boxShadow: '0 8px 18px rgba(26,26,46,0.14)',
      minWidth: 170,
      border: '1px solid rgba(187,217,255,0.85)',
    }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#1D355F', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
        {label}
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: '#5E6D8F' }}>Income</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.brand }}>{fmt(point?.Income || 0)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: '#5E6D8F' }}>Expense</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.chartExpense }}>{fmt(point?.Spent || 0)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: '#5E6D8F' }}>Investment</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.invest }}>{fmt(point?.Invested || 0)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
        <span style={{ fontSize: 12, color: '#5E6D8F' }}>Outflow</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.ink }}>{fmt(point?.Outflow || 0)}</span>
      </div>
    </div>
  )
}

export const MoneyFlowComparisonChart = memo(function MoneyFlowComparisonChart({ flowData }) {
  const safeData = (Array.isArray(flowData) ? flowData : []).map((point) => {
    const income = toFiniteNumber(point?.Income)
    const spent = toFiniteNumber(point?.Spent)
    const invested = toFiniteNumber(point?.Invested)
    return {
      name: point?.name || '-',
      Income: income,
      Spent: spent,
      Invested: invested,
      Outflow: spent + invested,
    }
  })

  if (!safeData.length) return null

  const totalIncome = safeData.reduce((sum, row) => sum + row.Income, 0)
  const totalExpense = safeData.reduce((sum, row) => sum + row.Spent, 0)
  const totalInvestment = safeData.reduce((sum, row) => sum + row.Invested, 0)
  const totalOutflow = totalExpense + totalInvestment
  const deploymentRate = totalIncome > 0 ? Math.round((totalInvestment / totalIncome) * 100) : 0

  return (
    <div className="card p-4 transition-transform duration-150 hover:-translate-y-0.5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-label font-semibold text-ink">Money Flow Comparison</p>
          <p className="text-[11px] text-ink-3 mt-0.5">Month by month: income, expenses, and investments side by side.</p>
        </div>
        <span className="text-[11px] font-semibold px-2 py-1 rounded-pill bg-ink/[0.06] text-ink">
          Invest rate {deploymentRate}%
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">Income</p>
          <p className="text-[13px] font-semibold tabular-nums text-ink">{fmt(totalIncome, true)}</p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">Expense</p>
          <p className="text-[13px] font-semibold tabular-nums text-expense-text">{fmt(totalExpense, true)}</p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">Investment</p>
          <p className="text-[13px] font-semibold tabular-nums text-invest-text">{fmt(totalInvestment, true)}</p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">Total outflow</p>
          <p className="text-[13px] font-semibold tabular-nums text-ink">{fmt(totalOutflow, true)}</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={safeData} margin={{ top: 6, right: 12, left: 12, bottom: 0 }}>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: 'rgba(107,107,128,0.9)', fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <YAxis hide />
          <Tooltip content={<FlowCompareTooltip />} cursor={{ fill: 'rgba(26,26,46,0.06)' }} />
          <Bar dataKey="Income" fill={C.brand} radius={[6, 6, 0, 0]} maxBarSize={18} />
          <Bar dataKey="Spent" fill={C.chartExpense} radius={[6, 6, 0, 0]} maxBarSize={18} />
          <Bar dataKey="Invested" fill={C.invest} radius={[6, 6, 0, 0]} maxBarSize={18} />
        </BarChart>
      </ResponsiveContainer>

      <div className="flex justify-center gap-6 pt-1">
        {[['Income', C.brand], ['Expense', C.chartExpense], ['Investment', C.invest]].map(([label, color]) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="text-[11px] text-ink-3">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
})

const WaterfallTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload || {}
  const value = toFiniteNumber(row?.displayValue)

  return (
    <div className="tooltip-enter" style={{
      background: '#FFFFFF',
      borderRadius: 12,
      padding: '10px 12px',
      boxShadow: '0 8px 18px rgba(26,26,46,0.14)',
      border: '1px solid rgba(187,217,255,0.85)',
      minWidth: 170,
    }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#1D355F', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
        {label}
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: '#5E6D8F' }}>Movement</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: value >= 0 ? C.brand : C.chartExpense }}>
          {value >= 0 ? '+' : '-'}{fmt(Math.abs(value))}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ fontSize: 12, color: '#5E6D8F' }}>Running level</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#1D355F' }}>{fmt(row?.end || 0)}</span>
      </div>
    </div>
  )
}

export const CashflowWaterfallChart = memo(function CashflowWaterfallChart({
  flowData,
  totalIncome,
  totalExpense,
  totalInvestment,
}) {
  const safeData = Array.isArray(flowData) ? flowData : []

  const income = toFiniteNumber(totalIncome) || safeData.reduce((sum, row) => sum + toFiniteNumber(row?.Income), 0)
  const expense = toFiniteNumber(totalExpense) || safeData.reduce((sum, row) => sum + toFiniteNumber(row?.Spent), 0)
  const investment = toFiniteNumber(totalInvestment) || safeData.reduce((sum, row) => sum + toFiniteNumber(row?.Invested), 0)

  if (income <= 0 && expense <= 0 && investment <= 0) return null

  const steps = [
    {
      key: 'income',
      name: 'Income',
      type: 'total',
      value: income,
      color: C.brand,
    },
    {
      key: 'expense',
      name: 'Expenses',
      type: 'delta',
      value: -expense,
      color: C.chartExpense,
    },
    {
      key: 'investment',
      name: 'Investments',
      type: 'delta',
      value: -investment,
      color: C.invest,
    },
  ]

  let running = 0
  const waterfallRows = steps.map((step) => {
    if (step.type === 'total') {
      const start = 0
      const end = step.value
      running = end
      return {
        ...step,
        start,
        end,
        offset: Math.min(start, end),
        height: Math.abs(end - start),
        displayValue: step.value,
      }
    }

    const start = running
    const end = running + step.value
    running = end

    return {
      ...step,
      start,
      end,
      offset: Math.min(start, end),
      height: Math.abs(step.value),
      displayValue: step.value,
    }
  })

  const net = running
  waterfallRows.push({
    key: 'net',
    name: 'Net',
    type: 'total',
    value: net,
    start: 0,
    end: net,
    offset: Math.min(0, net),
    height: Math.abs(net),
    displayValue: net,
    color: net >= 0 ? C.brandMid : C.expenseBright,
  })

  const chartLimit = Math.max(
    1200,
    Math.ceil(
      Math.max(
        ...waterfallRows.map((row) => Math.abs(toFiniteNumber(row?.start))),
        ...waterfallRows.map((row) => Math.abs(toFiniteNumber(row?.end))),
        0
      ) * 1.15
    )
  )

  const outflow = expense + investment
  const burnRate = income > 0 ? Math.round((outflow / income) * 100) : 0
  const investShare = income > 0 ? Math.round((investment / income) * 100) : 0

  return (
    <div className="card p-4 transition-transform duration-150 hover:-translate-y-0.5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-label font-semibold text-ink">Net movement waterfall</p>
          <p className="text-[11px] text-ink-3 mt-0.5">Shows how income gets absorbed by expense and investments into final net.</p>
        </div>
        <span className={`text-[13px] font-semibold tabular-nums ${net >= 0 ? 'text-income-text' : 'text-warning-text'}`}>
          {net >= 0 ? '+' : '-'}{fmt(Math.abs(net), true)}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">Outflow burn</p>
          <p className={`text-[13px] font-semibold tabular-nums ${burnRate <= 85 ? 'text-income-text' : 'text-warning-text'}`}>{burnRate}%</p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">Invest share</p>
          <p className="text-[13px] font-semibold tabular-nums text-invest-text">{investShare}%</p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">Net outcome</p>
          <p className={`text-[13px] font-semibold tabular-nums ${net >= 0 ? 'text-income-text' : 'text-warning-text'}`}>
            {net >= 0 ? '+' : '-'}{fmt(Math.abs(net), true)}
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={waterfallRows} margin={{ top: 8, right: 12, left: 12, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(26,26,46,0.06)" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: 'rgba(107,107,128,0.9)', fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <YAxis hide domain={[-chartLimit, chartLimit]} />
          <Tooltip content={<WaterfallTooltip />} cursor={{ fill: 'rgba(26,26,46,0.05)' }} />
          <ReferenceLine y={0} stroke="rgba(26,26,46,0.24)" strokeWidth={1} />
          <Bar dataKey="offset" stackId="waterfall" fill="transparent" isAnimationActive={false} />
          <Bar dataKey="height" stackId="waterfall" radius={[8, 8, 8, 8]} maxBarSize={40}>
            {waterfallRows.map((row) => (
              <Cell key={row.key} fill={row.color} fillOpacity={0.9} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <p className="text-[11px] text-ink-3 pt-2">Use this to pinpoint whether deficit pressure is coming from expense drift or aggressive deployment.</p>
    </div>
  )
})

const CompositionTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload || {}

  return (
    <div className="tooltip-enter" style={{
      background: '#FFFFFF',
      borderRadius: 12,
      padding: '10px 12px',
      boxShadow: '0 8px 18px rgba(26,26,46,0.14)',
      border: '1px solid rgba(187,217,255,0.85)',
      minWidth: 182,
    }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#1D355F', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
        {label}
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: '#5E6D8F' }}>Expense</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.chartExpense }}>{fmt(row?.Spent || 0)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: '#5E6D8F' }}>Investment</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.invest }}>{fmt(row?.Invested || 0)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: '#5E6D8F' }}>Outflow</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#1D355F' }}>{fmt(row?.Outflow || 0)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ fontSize: 12, color: '#5E6D8F' }}>Income</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.brand }}>{fmt(row?.Income || 0)}</span>
      </div>
    </div>
  )
}

export const MonthlyCompositionAreaChart = memo(function MonthlyCompositionAreaChart({ flowData }) {
  const safeData = (Array.isArray(flowData) ? flowData : []).map((row) => {
    const expense = toFiniteNumber(row?.Spent)
    const investment = toFiniteNumber(row?.Invested)
    return {
      name: row?.name || '-',
      Income: toFiniteNumber(row?.Income),
      Spent: expense,
      Invested: investment,
      Outflow: expense + investment,
      InvestShare: expense + investment > 0 ? Math.round((investment / (expense + investment)) * 100) : 0,
    }
  })

  if (!safeData.length) return null

  const highestOutflow = safeData.reduce((best, row) => (best == null || row.Outflow > best.Outflow ? row : best), null)
  const avgOutflow = Math.round(mean(safeData.map((row) => row.Outflow)))
  const avgInvestShare = Math.round(mean(safeData.map((row) => row.InvestShare)))

  return (
    <div className="card p-4 transition-transform duration-150 hover:-translate-y-0.5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-label font-semibold text-ink">Outflow composition trend</p>
          <p className="text-[11px] text-ink-3 mt-0.5">Stacked monthly outflow split into expense and investment, with income trend on top.</p>
        </div>
        <span className="text-[11px] px-2 py-1 rounded-pill font-semibold bg-ink/[0.06] text-ink">
          Avg invest share {avgInvestShare}%
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">Peak outflow</p>
          <p className="text-[13px] font-semibold tabular-nums text-warning-text">{highestOutflow?.name || '—'}</p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">Avg outflow</p>
          <p className="text-[13px] font-semibold tabular-nums text-ink">{fmt(avgOutflow, true)}</p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">Peak amount</p>
          <p className="text-[13px] font-semibold tabular-nums text-expense-text">{fmt(highestOutflow?.Outflow || 0, true)}</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={228}>
        <AreaChart data={safeData} margin={{ top: 8, right: 12, left: 12, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(26,26,46,0.06)" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: 'rgba(107,107,128,0.9)', fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <YAxis hide />
          <Tooltip content={<CompositionTooltip />} cursor={{ stroke: 'rgba(26,26,46,0.15)', strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="Spent"
            stackId="outflow"
            stroke={C.chartExpense}
            fill={C.chartExpense}
            fillOpacity={0.42}
            strokeWidth={1.8}
          />
          <Area
            type="monotone"
            dataKey="Invested"
            stackId="outflow"
            stroke={C.invest}
            fill={C.invest}
            fillOpacity={0.5}
            strokeWidth={1.8}
          />
          <Line
            type="monotone"
            dataKey="Income"
            stroke={C.brand}
            strokeWidth={2.3}
            dot={false}
            activeDot={{ r: 4, fill: C.brand, stroke: '#fff', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>

      <div className="flex justify-center gap-6 pt-1">
        {[['Expense', C.chartExpense], ['Investment', C.invest], ['Income', C.brand]].map(([label, color]) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: color }} />
            <span className="text-[11px] text-ink-3">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
})

const SurplusTrajectoryTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload || {}

  return (
    <div className="tooltip-enter" style={{
      background: '#FFFFFF',
      borderRadius: 12,
      padding: '10px 12px',
      boxShadow: '0 8px 18px rgba(26,26,46,0.14)',
      minWidth: 168,
      border: '1px solid rgba(187,217,255,0.85)',
    }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#1D355F', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
        {label}
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: '#5E6D8F' }}>Monthly surplus</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: row?.Net >= 0 ? C.brandMid : C.bills }}>{fmt(row?.Net || 0)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <span style={{ fontSize: 12, color: '#5E6D8F' }}>Cumulative</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: row?.Cumulative >= 0 ? C.brand : C.bills }}>{fmt(row?.Cumulative || 0)}</span>
      </div>
    </div>
  )
}

export const SurplusTrajectoryChart = memo(function SurplusTrajectoryChart({ netData }) {
  const safeData = (Array.isArray(netData) ? netData : []).map((row) => ({
    name: row?.name || '-',
    Net: toFiniteNumber(row?.Net),
  }))

  if (!safeData.length) return null

  let running = 0
  const cumulativeData = safeData.map((row) => {
    running += row.Net
    return {
      ...row,
      Cumulative: running,
    }
  })

  const latest = cumulativeData[cumulativeData.length - 1]?.Cumulative || 0
  const peak = cumulativeData.reduce((best, row) => (best == null || row.Cumulative > best.Cumulative ? row : best), null)
  const trough = cumulativeData.reduce((worst, row) => (worst == null || row.Cumulative < worst.Cumulative ? row : worst), null)
  const axisMax = Math.max(1000, Math.ceil(Math.max(...cumulativeData.map((row) => Math.abs(row.Cumulative)), 0) * 1.1))

  return (
    <div className="card p-4 transition-transform duration-150 hover:-translate-y-0.5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-label font-semibold text-ink">Cumulative Surplus Trajectory</p>
          <p className="text-[11px] text-ink-3 mt-0.5">Running surplus curve across the year to spot drawdowns early.</p>
        </div>
        <span className={`text-[13px] font-semibold tabular-nums ${latest >= 0 ? 'text-income-text' : 'text-warning-text'}`}>
          {latest >= 0 ? '+' : '-'}{fmt(Math.abs(latest), true)}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">Year-end</p>
          <p className={`text-[13px] font-semibold tabular-nums ${latest >= 0 ? 'text-income-text' : 'text-warning-text'}`}>
            {latest >= 0 ? '+' : '-'}{fmt(Math.abs(latest), true)}
          </p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">Peak month</p>
          <p className="text-[13px] font-semibold tabular-nums text-ink">{peak?.name || '—'}</p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">Low point</p>
          <p className="text-[13px] font-semibold tabular-nums text-warning-text">{trough?.name || '—'}</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={190}>
        <LineChart data={cumulativeData} margin={{ top: 6, right: 12, left: 12, bottom: 0 }}>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: 'rgba(107,107,128,0.9)', fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <YAxis hide domain={[-axisMax, axisMax]} />
          <Tooltip content={<SurplusTrajectoryTooltip />} cursor={{ stroke: 'rgba(26,26,46,0.16)', strokeWidth: 1 }} />
          <ReferenceLine y={0} stroke="rgba(26,26,46,0.28)" strokeWidth={1} />
          <Line
            dataKey="Cumulative"
            type="monotone"
            stroke={C.brand}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, fill: C.brand, stroke: '#fff', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>

      <p className="text-[11px] text-ink-3 pt-2">Use this trend to decide when to cut outflow or increase deployment discipline.</p>
    </div>
  )
})

export const WhatIfSimulatorCard = memo(function WhatIfSimulatorCard({
  categories,
  totalIncome,
  totalExpense,
  totalInvestment,
}) {
  const scenarioOptions = useMemo(() => (Array.isArray(categories) ? categories : [])
    .map((entry) => ({
      id: entry?.id || '',
      label: entry?.label || entry?.id || 'Category',
      value: toFiniteNumber(entry?.value),
    }))
    .filter((entry) => entry.id && entry.value > 0), [categories])

  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [reductionPct, setReductionPct] = useState(10)

  useEffect(() => {
    if (!scenarioOptions.length) {
      setSelectedCategoryId('')
      return
    }

    if (!scenarioOptions.some((entry) => entry.id === selectedCategoryId)) {
      setSelectedCategoryId(scenarioOptions[0].id)
    }
  }, [scenarioOptions, selectedCategoryId])

  const selectedCategory = scenarioOptions.find((entry) => entry.id === selectedCategoryId) || scenarioOptions[0] || null

  const income = toFiniteNumber(totalIncome)
  const expense = toFiniteNumber(totalExpense)
  const investment = toFiniteNumber(totalInvestment)
  const currentSurplus = income - expense - investment
  const reductionAmount = selectedCategory ? (selectedCategory.value * reductionPct) / 100 : 0
  const projectedSurplus = currentSurplus + reductionAmount

  const currentSavingsRate = income > 0 ? Math.round((currentSurplus / income) * 100) : 0
  const projectedSavingsRate = income > 0 ? Math.round((projectedSurplus / income) * 100) : 0

  const maxBarValue = Math.max(1, Math.abs(currentSurplus), Math.abs(projectedSurplus))
  const currentBarWidth = Math.max(4, (Math.abs(currentSurplus) / maxBarValue) * 100)
  const projectedBarWidth = Math.max(4, (Math.abs(projectedSurplus) / maxBarValue) * 100)

  const handlePercentChange = (value) => {
    const parsed = Number(value)
    setReductionPct(clampNumber(Math.round(Number.isFinite(parsed) ? parsed : 0), 0, 60))
  }

  return (
    <div className="card p-4 transition-transform duration-150 hover:-translate-y-0.5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-label font-semibold text-ink">What-if Surplus Simulator</p>
          <p className="text-[11px] text-ink-3 mt-0.5">Test how category reductions affect year-end surplus before changing your spending plan.</p>
        </div>
        <span className="text-[11px] font-semibold px-2 py-1 rounded-pill bg-ink/[0.06] text-ink">
          Scenario lab
        </span>
      </div>

      {!scenarioOptions.length ? (
        <p className="text-[12px] text-ink-3">No category spend detected for this year yet. Add expenses to run simulations.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.06em] text-ink-3 mb-1">Category</p>
              <select
                value={selectedCategory?.id || ''}
                onChange={(event) => setSelectedCategoryId(event.target.value)}
                className="w-full rounded-card border border-kosha-border bg-white px-3 py-2 text-[12px] font-semibold text-ink"
              >
                {scenarioOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label} ({fmt(option.value, true)})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-end justify-between gap-2 mb-1">
                <p className="text-[10px] uppercase tracking-[0.06em] text-ink-3">Reduction</p>
                <p className="text-[13px] font-semibold text-ink">{reductionPct}%</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min={0}
                  max={60}
                  step={1}
                  value={reductionPct}
                  onChange={(event) => handlePercentChange(event.target.value)}
                  className="w-full accent-brand"
                />
                <input
                  type="number"
                  min={0}
                  max={60}
                  step={1}
                  value={reductionPct}
                  onChange={(event) => handlePercentChange(event.target.value)}
                  className="w-16 rounded-card border border-kosha-border px-2 py-1.5 text-[12px] font-semibold text-ink"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
            <div className="rounded-card bg-kosha-surface-2 p-2.5">
              <p className="text-[10px] text-ink-3">Current surplus</p>
              <p className={`text-[13px] font-semibold tabular-nums ${currentSurplus >= 0 ? 'text-income-text' : 'text-warning-text'}`}>
                {currentSurplus >= 0 ? '+' : '-'}{fmt(Math.abs(currentSurplus))}
              </p>
              <p className="text-[10px] text-ink-3 mt-0.5">{currentSavingsRate}% savings rate</p>
            </div>

            <div className="rounded-card bg-kosha-surface-2 p-2.5">
              <p className="text-[10px] text-ink-3">Potential lift</p>
              <p className="text-[13px] font-semibold tabular-nums text-ink">
                +{fmt(reductionAmount)}
              </p>
              <p className="text-[10px] text-ink-3 mt-0.5">From {selectedCategory?.label || 'selected category'}</p>
            </div>

            <div className="rounded-card bg-kosha-surface-2 p-2.5">
              <p className="text-[10px] text-ink-3">Projected surplus</p>
              <p className={`text-[13px] font-semibold tabular-nums ${projectedSurplus >= 0 ? 'text-income-text' : 'text-warning-text'}`}>
                {projectedSurplus >= 0 ? '+' : '-'}{fmt(Math.abs(projectedSurplus))}
              </p>
              <p className="text-[10px] text-ink-3 mt-0.5">{projectedSavingsRate}% savings rate</p>
            </div>
          </div>

          <div className="rounded-card border border-kosha-border bg-white p-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-16 text-[11px] text-ink-3">Current</span>
                <div className="flex-1 h-2 rounded-pill" style={{ background: 'rgba(26,26,46,0.06)' }}>
                  <div
                    className="h-full rounded-pill"
                    style={{
                      width: `${currentBarWidth}%`,
                      background: currentSurplus >= 0 ? C.brandMid : C.bills,
                    }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-ink tabular-nums w-20 text-right">
                  {fmt(currentSurplus, true)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="w-16 text-[11px] text-ink-3">Projected</span>
                <div className="flex-1 h-2 rounded-pill" style={{ background: 'rgba(26,26,46,0.06)' }}>
                  <div
                    className="h-full rounded-pill"
                    style={{
                      width: `${projectedBarWidth}%`,
                      background: projectedSurplus >= 0 ? C.brand : C.bills,
                    }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-ink tabular-nums w-20 text-right">
                  {fmt(projectedSurplus, true)}
                </span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-ink-3 mt-2">
            Assumption: only the selected category changes; income and all other outflows remain constant.
          </p>
        </>
      )}
    </div>
  )
})

const RunwayTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const months = toFiniteNumber(payload[0]?.value)

  return (
    <div className="tooltip-enter" style={{
      background: '#FFFFFF',
      borderRadius: 12,
      padding: '10px 12px',
      boxShadow: '0 8px 18px rgba(26,26,46,0.14)',
      border: '1px solid rgba(187,217,255,0.85)',
      minWidth: 148,
    }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#1D355F', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.03em' }}>
        {label}
      </p>
      <p style={{ fontSize: 12, color: '#5E6D8F' }}>Coverage</p>
      <p style={{ fontSize: 13, fontWeight: 700, color: C.brand }}>{months.toFixed(1)} months</p>
    </div>
  )
}

export const RunwayCoverageChart = memo(function RunwayCoverageChart({ flowData, annualSurplus }) {
  const outflowSeries = useMemo(() => (Array.isArray(flowData) ? flowData : [])
    .map((row) => toFiniteNumber(row?.Outflow || (toFiniteNumber(row?.Spent) + toFiniteNumber(row?.Invested))))
    .filter((value) => value > 0), [flowData])

  const hasOutflowData = outflowSeries.length > 0
  const avgOutflow = hasOutflowData ? mean(outflowSeries) : 0
  const recentOutflow = hasOutflowData ? mean(outflowSeries.slice(-3)) : 0
  const trendOutflow = recentOutflow > 0 ? (recentOutflow * 0.6) + (avgOutflow * 0.4) : avgOutflow

  const baselineReserve = Math.max(
    0,
    Math.round(Math.max(toFiniteNumber(annualSurplus), trendOutflow * 2))
  )

  const [reserveCorpus, setReserveCorpus] = useState(baselineReserve)

  useEffect(() => {
    setReserveCorpus(baselineReserve)
  }, [baselineReserve])

  if (!hasOutflowData) {
    return (
      <div className="card p-4">
        <p className="text-label font-semibold text-ink">Runway Coverage</p>
        <p className="text-[12px] text-ink-3 mt-1">Runway appears once enough monthly outflow data is available.</p>
      </div>
    )
  }

  const reserveAmount = Math.max(0, toFiniteNumber(reserveCorpus))

  const scenarioData = [
    { name: 'Current trend', short: 'Trend', multiplier: 1, color: C.brand },
    { name: '+10% outflow', short: '+10%', multiplier: 1.1, color: C.brandMid },
    { name: '+20% stress', short: '+20%', multiplier: 1.2, color: C.accent },
  ].map((scenario) => {
    const months = trendOutflow > 0 ? reserveAmount / (trendOutflow * scenario.multiplier) : 0
    return {
      ...scenario,
      months: Number(months.toFixed(1)),
    }
  })

  const maxMonths = Math.max(...scenarioData.map((row) => row.months), 0)
  const baselineMonths = scenarioData[0]?.months || 0

  return (
    <div className="card p-4 transition-transform duration-150 hover:-translate-y-0.5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-label font-semibold text-ink">Runway Coverage</p>
          <p className="text-[11px] text-ink-3 mt-0.5">Months of expense+investment coverage if income slows at current outflow pace.</p>
        </div>
        <span className="text-[11px] font-semibold px-2 py-1 rounded-pill bg-ink/[0.06] text-ink">
          {baselineMonths.toFixed(1)} months
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">Trend outflow / month</p>
          <p className="text-[13px] font-semibold tabular-nums text-ink">{fmt(trendOutflow, true)}</p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">Runway corpus</p>
          <p className="text-[13px] font-semibold tabular-nums text-ink">{fmt(reserveAmount, true)}</p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">12m target</p>
          <p className="text-[13px] font-semibold tabular-nums text-ink">{fmt(trendOutflow * 12, true)}</p>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-[10px] uppercase tracking-[0.06em] text-ink-3">Adjust runway corpus</p>
          <span className="text-[12px] font-semibold text-accent">{fmt(reserveAmount, true)}</span>
        </div>
        <input
          type="number"
          min={0}
          step={1000}
          value={reserveAmount}
          onChange={(event) => setReserveCorpus(Math.max(0, Number(event.target.value || 0)))}
          className="w-full rounded-card border border-kosha-border bg-white px-3 py-2 text-[12px] font-semibold text-ink"
        />
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={scenarioData} margin={{ top: 6, right: 12, left: 12, bottom: 0 }}>
          <XAxis
            dataKey="short"
            tick={{ fontSize: 11, fill: 'rgba(107,107,128,0.9)', fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <YAxis hide domain={[0, Math.max(6, Math.ceil(maxMonths * 1.15))]} />
          <Tooltip content={<RunwayTooltip />} cursor={{ fill: 'rgba(26,26,46,0.06)' }} />
          <ReferenceLine y={12} stroke="rgba(26,26,46,0.24)" strokeDasharray="4 4" />
          <Bar dataKey="months" radius={[8, 8, 0, 0]} maxBarSize={34}>
            {scenarioData.map((scenario) => (
              <Cell key={scenario.name} fill={scenario.color} fillOpacity={0.94} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="flex justify-center gap-6 pt-1">
        {scenarioData.map((scenario) => (
          <div key={scenario.name} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: scenario.color }} />
            <span className="text-[11px] text-ink-3">{scenario.name}</span>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-ink-3 pt-2">Runway uses weighted outflow trend (last 3 months + yearly average) for more realistic coverage planning.</p>
    </div>
  )
})

export const VolatilityScoreCard = memo(function VolatilityScoreCard({ flowData }) {
  const safeData = useMemo(() => (Array.isArray(flowData) ? flowData : []).map((row) => ({
    Income: toFiniteNumber(row?.Income),
    Spent: toFiniteNumber(row?.Spent),
    Invested: toFiniteNumber(row?.Invested),
  })), [flowData])

  if (!safeData.length) return null

  const scoreRows = [
    {
      key: 'Income',
      label: 'Income consistency',
      stats: computeVolatility(safeData.map((row) => row.Income)),
      weight: 0.4,
    },
    {
      key: 'Spent',
      label: 'Expense consistency',
      stats: computeVolatility(safeData.map((row) => row.Spent)),
      weight: 0.35,
    },
    {
      key: 'Invested',
      label: 'Investment consistency',
      stats: computeVolatility(safeData.map((row) => row.Invested)),
      weight: 0.25,
    },
  ].map((row) => ({
    ...row,
    tone: scoreTone(row.stats.score),
  }))

  const weighted = scoreRows.reduce((acc, row) => {
    if (row.stats.score == null) return acc
    return {
      total: acc.total + (row.stats.score * row.weight),
      weight: acc.weight + row.weight,
    }
  }, { total: 0, weight: 0 })

  const planningConfidence = weighted.weight > 0
    ? Math.round(weighted.total / weighted.weight)
    : null

  const scoredRows = scoreRows.filter((row) => row.stats.score != null)
  const strongest = [...scoredRows].sort((a, b) => b.stats.score - a.stats.score)[0]
  const weakest = [...scoredRows].sort((a, b) => a.stats.score - b.stats.score)[0]

  return (
    <div className="card p-4 transition-transform duration-150 hover:-translate-y-0.5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-label font-semibold text-ink">Volatility Scoring</p>
          <p className="text-[11px] text-ink-3 mt-0.5">Monthly stability score for income, expense, and investment consistency.</p>
        </div>
        <div className="text-right">
          <p className="text-[15px] font-semibold tabular-nums text-ink">
            {planningConfidence == null ? '—' : `${planningConfidence}/100`}
          </p>
          <p className="text-[10px] text-ink-3">planning confidence</p>
        </div>
      </div>

      <div className="space-y-2.5">
        {scoreRows.map((row) => {
          const scoreValue = row.stats.score == null ? 0 : row.stats.score
          const width = row.stats.score == null ? 0 : Math.max(6, scoreValue)
          const cvLabel = row.stats.cv == null ? '—' : `${Math.round(row.stats.cv * 100)}% coeff. variation`

          return (
            <div key={row.key} className="rounded-card bg-kosha-surface-2 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold text-ink">{row.label}</p>
                <span className="text-[11px] font-semibold tabular-nums" style={{ color: row.tone.color }}>
                  {row.stats.score == null ? '—' : `${row.stats.score}/100`}
                </span>
              </div>
              <div className="mt-2 h-2 rounded-pill" style={{ background: 'rgba(26,26,46,0.06)' }}>
                <div
                  className="h-full rounded-pill"
                  style={{
                    width: `${width}%`,
                    background: row.tone.fill,
                  }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-ink-3">
                <span style={{ color: row.tone.color }}>{row.tone.label}</span>
                <span>{cvLabel}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-3 rounded-card border border-kosha-border bg-white p-2.5 text-[11px] text-ink-3">
        <span className="font-semibold text-ink">Focus area:</span>{' '}
        {weakest
          ? `${weakest.label} is least stable. Tightening this variance will improve year-end planning confidence fastest.`
          : 'Need at least 2 active months per metric to score volatility reliably.'}
        {strongest ? ` Strongest today: ${strongest.label.toLowerCase()}.` : ''}
      </div>
    </div>
  )
})

const TREND_CHART_BG = '#0C3C8A'

const ConfidenceTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload
  return (
    <div className="tooltip-enter" style={{
      background: 'rgba(34,43,109,0.96)',
      borderRadius: 12,
      padding: '10px 14px',
      boxShadow: '0px 4px 8px 3px rgba(0,0,0,0.15)',
      minWidth: 140,
      border: '0.5px solid rgba(255,255,255,0.10)',
    }}>
      <p style={{
        fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.5)',
        letterSpacing: '0.04em', marginBottom: 6, textTransform: 'uppercase',
      }}>
        {label}
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 3 }}>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>Confidence</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.chartIncome }}>
          {point?.confidence == null ? 'No data' : `${point.confidence}%`}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>Signals</span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.78)' }}>
          {point?.linked || 0} linked · {point?.rejected || 0} mismatch
        </span>
      </div>
    </div>
  )
}

export const ConfidenceTrendChart = memo(function ConfidenceTrendChart({ trendData }) {
  if (!Array.isArray(trendData) || trendData.length === 0) return null

  const latest = [...trendData].reverse().find((p) => p?.confidence != null)
  const latestConfidence = latest?.confidence ?? null

  return (
    <div
      className="rounded-card overflow-hidden shadow-card-lg transition-transform duration-150 hover:-translate-y-0.5"
      style={{ background: TREND_CHART_BG, border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="px-5 pt-5 pb-2 flex items-start justify-between">
        <div>
          <p className="text-label font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>
            Confidence Trend
          </p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
            Daily linked vs mismatch quality (last 30 days)
          </p>
        </div>
        <div className="text-right">
          <p className="font-semibold tabular-nums" style={{
            fontSize: 15,
            color: latestConfidence != null && latestConfidence >= 70 ? C.chartIncome : C.chartExpense,
            letterSpacing: '-0.01em',
          }}>
            {latestConfidence == null ? '—' : `${latestConfidence}%`}
          </p>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>latest day</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={130}>
        <LineChart data={trendData} margin={{ top: 4, right: 16, left: 16, bottom: 0 }}>
          <XAxis
            dataKey="dateShort"
            tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.45)', fontWeight: 500 }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={20}
          />
          <YAxis hide domain={[0, 100]} />
          <Tooltip content={<ConfidenceTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }} />
          <ReferenceLine y={70} stroke="rgba(255,255,255,0.18)" strokeDasharray="3 3" />
          <Line
            dataKey="confidence"
            type="monotone"
            stroke={C.chartIncome}
            strokeWidth={2.5}
            dot={false}
            connectNulls={false}
            activeDot={{ r: 4, fill: C.chartIncome, stroke: '#fff', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="h-4" />
    </div>
  )
})
