import { fmt } from '../../../lib/utils'

export default function BreakdownCard({ earned, spent, invested, totalLabel = 'Total income' }) {
  const inflow = Number(earned || 0)
  const expense = Number(spent || 0)
  const investment = Number(invested || 0)
  const outflow = expense + investment
  const net = inflow - outflow
  const saved = Math.max(0, net)
  const deficit = Math.max(0, -net)

  const spentPct = inflow > 0 ? Math.round((expense / inflow) * 100) : 0
  const investedPct = inflow > 0 ? Math.round((investment / inflow) * 100) : 0
  const savedPct = inflow > 0 ? Math.round((saved / inflow) * 100) : 0
  const deficitPct = inflow > 0 ? Math.round((deficit / inflow) * 100) : 0

  const segments = [
    {
      key: 'spent',
      label: 'Spent',
      amount: expense,
      pct: spentPct,
      color: '#E11D48',
      tone: 'text-expense-text',
      bg: 'bg-expense-bg',
    },
    {
      key: 'invested',
      label: 'Invested',
      amount: investment,
      pct: investedPct,
      color: '#7C3AED',
      tone: 'text-invest-text',
      bg: 'bg-invest-bg',
    },
    saved > 0
      ? {
          key: 'leftover',
          label: 'Leftover',
          amount: saved,
          pct: savedPct,
          color: '#0E9F6E',
          tone: 'text-income-text',
          bg: 'bg-income-bg',
        }
      : {
          key: 'deficit',
          label: 'Deficit',
          amount: deficit,
          pct: deficitPct,
          color: '#9A7200',
          tone: 'text-warning-text',
          bg: 'bg-warning-bg',
        },
  ]

  const visibleSegments = segments.filter((s) => s.pct > 0)

  const insight = (() => {
    if (net < 0)
      return `Outflow exceeded inflow by ${fmt(deficit)}. Cut discretionary spend or defer optional deployments.`
    if (savedPct < 10)
      return `Only ${savedPct}% of inflow is left. Aim for 10–15% buffer.`
    if (investedPct < 8)
      return `Investment share is just ${investedPct}%. A small planned top-up improves long-term consistency.`
    return 'Allocation is balanced this month. Keep the leftover buffer protected.'
  })()

  if (inflow === 0) return null

  return (
    <div className="card p-4 border-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="section-label">Cashflow breakdown</p>
          <p className="text-[11px] text-ink-3 mt-0.5">Where your inflow went this month</p>
        </div>
        <span
          className={`text-[10px] px-2 py-1 rounded-pill font-semibold ${
            net >= 0 ? 'bg-income-bg text-income-text' : 'bg-warning-bg text-warning-text'
          }`}
        >
          {net >= 0 ? '+' : '-'}{fmt(Math.abs(net))}
        </span>
      </div>

      {/* Central stacked bar */}
      <div className="rounded-card border border-kosha-border bg-kosha-surface-2 p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] text-ink-3">{totalLabel}</p>
          <p className="text-[12px] font-bold tabular-nums text-income-text">{fmt(inflow)}</p>
        </div>
        <div className="h-4 rounded-pill bg-kosha-border overflow-hidden flex">
          {visibleSegments.map((seg) => (
            <div
              key={seg.key}
              className="h-full first:rounded-l-pill last:rounded-r-pill transition-all duration-500"
              style={{ width: `${Math.max(4, seg.pct)}%`, background: seg.color }}
            />
          ))}
        </div>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {visibleSegments.map((seg) => (
            <div key={`legend-${seg.key}`} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: seg.color }} />
              <span className="text-[10px] text-ink-3">{seg.label} {seg.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Destination cards */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {segments.map((seg) => (
          <div key={seg.key} className={`rounded-card ${seg.bg} p-2.5`}>
            <p className="text-[10px] text-ink-3">{seg.label}</p>
            <p className={`text-[13px] font-bold tabular-nums ${seg.tone}`}>
              {fmt(seg.amount)}
            </p>
            <p className="text-[10px] text-ink-3 tabular-nums mt-0.5">{seg.pct}%</p>
          </div>
        ))}
      </div>

      {/* Action insight */}
      <p className="text-[11px] text-ink-3 leading-relaxed">{insight}</p>
    </div>
  )
}
