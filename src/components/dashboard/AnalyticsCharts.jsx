import { memo } from 'react'
import {
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, Tooltip, ReferenceLine,
  ResponsiveContainer, Cell,
} from 'recharts'
import { fmt } from '../../lib/utils'
import { C } from '../../lib/colors'

function toFiniteNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

// ── Tooltips ──────────────────────────────────────────────────────────────

const PulseTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null

  const point = payload?.[0]?.payload || {}
  const income = toFiniteNumber(point?.Income)
  const spent = toFiniteNumber(point?.Spent)
  const pulse = toFiniteNumber(point?.Pulse)
  const pulsePct = income > 0 ? Math.round((pulse / income) * 100) : 0
  const pulseColor = pulse >= 0 ? C.chartIncome : C.chartExpense

  return (
    <div style={{
      background: 'rgba(34,43,109,0.96)',
      borderRadius: 12,
      padding: '10px 14px',
      boxShadow: '0px 4px 8px 3px rgba(0,0,0,0.15)',
      minWidth: 170,
      border: '0.5px solid rgba(255,255,255,0.10)',
    }}>
      <p style={{
        fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)',
        letterSpacing: '0.04em', marginBottom: 6, textTransform: 'uppercase',
      }}>
        {label}
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 3 }}>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>Income</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.chartIncome }}>{fmt(income)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 3 }}>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>Spent</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.chartExpense }}>{fmt(spent)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>Pulse</span>
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
  const valueColor = val >= 0 ? C.chartIncome : C.chartExpense
  return (
    <div style={{
      background: 'rgba(34,43,109,0.96)',
      borderRadius: 12,
      padding: '10px 14px',
      boxShadow: '0px 4px 8px 3px rgba(0,0,0,0.15)',
      minWidth: 140,
      border: '0.5px solid rgba(255,255,255,0.10)',
    }}>
      <p style={{
        fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)',
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
    Pulse: toFiniteNumber(point?.Income) - toFiniteNumber(point?.Spent),
  }))

  if (!safeData.length) return null

  const chartH = safeData.length <= 4 ? 190 : 230
  const totalIncomeSafe = safeData.reduce((sum, point) => sum + toFiniteNumber(point.Income), 0)
  const totalSpent = safeData.reduce((sum, point) => sum + toFiniteNumber(point.Spent), 0)
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
    ? Math.round((totalSpent / totalIncomeSafe) * 100)
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
          <p style={{ fontSize: 11, color: 'rgba(49,58,134,0.55)', marginTop: 2 }}>
            Monthly surplus/deficit rhythm
          </p>
        </div>
        <div className="text-right">
          <p className="font-bold tabular-nums"
            style={{
              fontSize: 15,
              color: totalNet >= 0 ? C.chartIncome : C.chartExpense,
              letterSpacing: '-0.01em',
            }}>
            {totalNet >= 0 ? '+' : '-'}{fmt(Math.abs(totalNet), true)}
          </p>
          <p style={{ fontSize: 10, color: 'rgba(49,58,134,0.55)', marginTop: 1 }}>net pulse</p>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
          <p className="text-[10px] text-ink-3">Income</p>
          <p className="text-[12px] font-bold tabular-nums text-income-text">{fmt(totalIncome || totalIncomeSafe, true)}</p>
        </div>
        <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
          <p className="text-[10px] text-ink-3">Outflow</p>
          <p className="text-[12px] font-bold tabular-nums text-expense-text">{fmt(totalSpent, true)}</p>
        </div>
        <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
          <p className="text-[10px] text-ink-3">Positive months</p>
          <p className="text-[12px] font-bold tabular-nums text-ink">{positivePulseMonths}/{safeData.length}</p>
        </div>
        <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
          <p className="text-[10px] text-ink-3">Spend velocity</p>
          <p className={`text-[12px] font-bold tabular-nums ${spendVelocity <= 85 ? 'text-income-text' : 'text-warning-text'}`}>
            {spendVelocity}%
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={chartH}>
        <BarChart data={safeData} margin={{ top: 8, right: 12, left: 12, bottom: 0 }}>
          <XAxis dataKey="name"
            tick={{ fontSize: 11, fill: 'rgba(49,58,134,0.58)', fontWeight: 500 }}
            axisLine={false} tickLine={false} interval={0}
          />
          <YAxis hide domain={[-pulseAxisMax, pulseAxisMax]} />
          <Tooltip content={<PulseTooltip />} cursor={{ fill: 'rgba(31,37,95,0.06)' }} />
          <ReferenceLine y={0} stroke="rgba(31,37,95,0.24)" strokeWidth={1} />
          <Bar dataKey="Pulse" radius={[8, 8, 8, 8]} maxBarSize={28}>
            {safeData.map((entry, i) => (
              <Cell
                key={i}
                fill={entry.Pulse >= 0 ? C.chartIncome : C.chartExpense}
                fillOpacity={0.92}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap justify-between gap-2 pb-1 pt-2">
        <div className="text-[11px] text-ink-3">
          Best pulse: <span className="font-semibold text-income-text">{strongestMonth?.name || '—'}</span>
        </div>
        <div className="text-[11px] text-ink-3">
          Stress month: <span className="font-semibold text-expense-text">{weakestMonth?.name || '—'}</span>
        </div>
      </div>

      <div className="flex justify-center gap-6 pb-1 pt-1">
        {[['Surplus pulse', C.chartIncome], ['Deficit pulse', C.chartExpense]].map(([l, c]) => (
          <div key={l} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: c }} />
            <span style={{ fontSize: 11, color: 'rgba(49,58,134,0.60)', fontWeight: 500 }}>{l}</span>
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
          <p style={{ fontSize: 11, color: 'rgba(49,58,134,0.55)', marginTop: 2 }}>
            Income minus expenses and investments
          </p>
        </div>
        <div className="text-right">
          <p className="font-bold tabular-nums" style={{
            fontSize: 15,
            color: totalNet >= 0 ? C.chartIncome : C.chartExpense,
            letterSpacing: '-0.01em',
          }}>
            {totalNet >= 0 ? '+' : '-'}{fmt(Math.abs(totalNet), true)}
          </p>
          <p style={{ fontSize: 10, color: 'rgba(49,58,134,0.55)', marginTop: 1 }}>
            {totalNet >= 0 ? 'year surplus' : 'year deficit'}
          </p>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
          <p className="text-[10px] text-ink-3">Positive months</p>
          <p className="text-[12px] font-bold tabular-nums text-ink">{positiveMonths}/{netData.length}</p>
        </div>
        <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
          <p className="text-[10px] text-ink-3">Highest surplus</p>
          <p className="text-[12px] font-bold tabular-nums text-income-text">{bestMonth?.name || '—'}</p>
        </div>
        <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
          <p className="text-[10px] text-ink-3">Deepest deficit</p>
          <p className="text-[12px] font-bold tabular-nums text-expense-text">{worstMonth?.name || '—'}</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={safeData} margin={{ top: 4, right: 12, left: 12, bottom: 0 }}>
          <XAxis dataKey="name"
            tick={{ fontSize: 11, fill: 'rgba(49,58,134,0.58)', fontWeight: 500 }}
            axisLine={false} tickLine={false} interval={0}
          />
          <YAxis hide domain={[-safeAxisMax, safeAxisMax]} />
          <Tooltip content={<NetTooltip />} cursor={{ fill: 'rgba(31,37,95,0.06)' }} />
          <ReferenceLine y={0} stroke="rgba(31,37,95,0.22)" strokeWidth={1} />
          <Bar dataKey="Net" radius={[8, 8, 8, 8]} maxBarSize={26}>
            {safeData.map((entry, i) => (
              <Cell key={i}
                fill={entry.Net >= 0 ? C.chartIncome : C.chartExpense}
                fillOpacity={0.90}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="pt-2 text-[11px] text-ink-3">Monthly leftover after expenses and investments.</div>
    </div>
  )
})

const TREND_CHART_BG = '#0C3C8A'

const ConfidenceTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload
  return (
    <div style={{
      background: 'rgba(34,43,109,0.96)',
      borderRadius: 12,
      padding: '10px 14px',
      boxShadow: '0px 4px 8px 3px rgba(0,0,0,0.15)',
      minWidth: 140,
      border: '0.5px solid rgba(255,255,255,0.10)',
    }}>
      <p style={{
        fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)',
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
          <p className="font-bold tabular-nums" style={{
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
