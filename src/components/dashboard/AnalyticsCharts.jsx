import { memo } from 'react'
import {
  AreaChart, Area,
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

const DarkTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const uniquePayload = payload.filter(
    (entry, idx, arr) => arr.findIndex((item) => item.name === entry.name) === idx
  )
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
      {uniquePayload.map(p => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 3 }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>{p.name}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: p.stroke || p.fill || p.color }}>
            {fmt(p.value)}
          </span>
        </div>
      ))}
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
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)' }}>Net</span>
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
  }))

  if (!safeData.length) return null

  const chartH = safeData.length <= 4 ? 180 : 220
  const totalSpent = safeData.reduce((sum, point) => sum + toFiniteNumber(point.Spent), 0)
  const totalNet = safeData.reduce((sum, point) => sum + (toFiniteNumber(point.Income) - toFiniteNumber(point.Spent)), 0)
  const bestMonth = safeData.reduce((best, point) => {
    const gap = toFiniteNumber(point.Income) - toFiniteNumber(point.Spent)
    if (!best || gap > best.gap) return { name: point.name, gap }
    return best
  }, null)

  return (
    <div className="card p-4 transition-transform duration-150 hover:-translate-y-0.5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-label font-semibold" style={{ color: 'rgba(31,37,95,0.92)' }}>
            Cash Flow Pulse
          </p>
          <p style={{ fontSize: 11, color: 'rgba(49,58,134,0.55)', marginTop: 2 }}>
            Income trend vs monthly outflow
          </p>
        </div>
        <div className="text-right">
          <p className="font-bold tabular-nums"
            style={{ fontSize: 15, color: C.chartIncome, letterSpacing: '-0.01em' }}>
            {fmt(totalIncome || 0, true)}
          </p>
          <p style={{ fontSize: 10, color: 'rgba(49,58,134,0.55)', marginTop: 1 }}>earned</p>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
          <p className="text-micro text-ink-3">Spent</p>
          <p className="text-caption font-bold tabular-nums text-expense-text">{fmt(totalSpent, true)}</p>
        </div>
        <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
          <p className="text-micro text-ink-3">Net</p>
          <p className={`text-caption font-bold tabular-nums ${totalNet >= 0 ? 'text-income-text' : 'text-expense-text'}`}>
            {totalNet >= 0 ? '+' : '-'}{fmt(Math.abs(totalNet), true)}
          </p>
        </div>
        <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
          <p className="text-micro text-ink-3">Best month</p>
          <p className="text-caption font-bold tabular-nums text-ink">
            {bestMonth?.name || '—'}
          </p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={chartH}>
        <AreaChart data={safeData} margin={{ top: 8, right: 16, left: 12, bottom: 0 }}>
          <defs>
            <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={C.chartIncome}  stopOpacity={0.20} />
              <stop offset="95%" stopColor={C.chartIncome}  stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gExpense" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={C.chartExpense} stopOpacity={0.20} />
              <stop offset="95%" stopColor={C.chartExpense} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="name"
            tick={{ fontSize: 11, fill: 'rgba(49,58,134,0.58)', fontWeight: 500 }}
            axisLine={false} tickLine={false} interval={0}
          />
          <YAxis hide />
          <Tooltip content={<DarkTooltip />} cursor={{ stroke: 'rgba(31,37,95,0.10)', strokeWidth: 1 }} />
          <Area dataKey="Income" type="monotone"
            stroke={C.chartIncome} strokeWidth={3} fill="url(#gIncome)" dot={false}
            activeDot={{ r: 5, fill: C.chartIncome, stroke: '#fff', strokeWidth: 2 }}
            name="Income"
          />
          <Area dataKey="Spent" type="monotone"
            stroke={C.chartExpense} strokeWidth={3} fill="url(#gExpense)" dot={false}
            activeDot={{ r: 5, fill: C.chartExpense, stroke: '#fff', strokeWidth: 2 }}
            name="Spent"
          />
        </AreaChart>
      </ResponsiveContainer>

      <div className="flex justify-center gap-6 pb-1 pt-2">
        {[['Income', C.chartIncome], ['Spent', C.chartExpense]].map(([l, c]) => (
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
            Net Savings
          </p>
          <p style={{ fontSize: 11, color: 'rgba(49,58,134,0.55)', marginTop: 2 }}>
            Monthly net with cumulative direction
          </p>
        </div>
        <div className="text-right">
          <p className="font-bold tabular-nums" style={{
            fontSize: 15,
            color: totalNet >= 0 ? C.chartIncome : C.chartExpense,
            letterSpacing: '-0.01em',
          }}>
            {fmt(Math.abs(totalNet), true)}
          </p>
          <p style={{ fontSize: 10, color: 'rgba(49,58,134,0.55)', marginTop: 1 }}>
            {totalNet >= 0 ? 'net saved' : 'net deficit'}
          </p>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
          <p className="text-micro text-ink-3">Positive months</p>
          <p className="text-caption font-bold tabular-nums text-ink">{positiveMonths}/{netData.length}</p>
        </div>
        <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
          <p className="text-micro text-ink-3">Best month</p>
          <p className="text-caption font-bold tabular-nums text-income-text">{bestMonth?.name || '—'}</p>
        </div>
        <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
          <p className="text-micro text-ink-3">Weak month</p>
          <p className="text-caption font-bold tabular-nums text-expense-text">{worstMonth?.name || '—'}</p>
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
      <div className="pt-2 text-micro text-ink-3">Monthly net after expenses and investments.</div>
    </div>
  )
})

const TREND_CHART_BG =
  'radial-gradient(circle at 85% 20%, rgba(36,59,175,0.22) 0%, rgba(36,59,175,0) 58%), linear-gradient(180deg, #172978 0%, #0D143F 100%)'

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
