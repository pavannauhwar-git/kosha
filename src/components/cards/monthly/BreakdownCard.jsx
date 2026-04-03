import { motion } from 'framer-motion'
import { fmt } from '../../../lib/utils'
import { C } from '../../../lib/colors'

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
      color: C.expense,
      tone: 'text-expense-text',
      bg: 'bg-expense-bg',
    },
    {
      key: 'invested',
      label: 'Invested',
      amount: investment,
      pct: investedPct,
      color: C.invest,
      tone: 'text-invest-text',
      bg: 'bg-invest-bg',
    },
    saved > 0
      ? {
          key: 'leftover',
          label: 'Leftover',
          amount: saved,
          pct: savedPct,
          color: C.income,
          tone: 'text-income-text',
          bg: 'bg-income-bg',
        }
      : {
          key: 'deficit',
          label: 'Deficit',
          amount: deficit,
          pct: deficitPct,
          color: C.bills,
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
      {/* ── Header row ────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <p className="section-label">Cashflow breakdown</p>
        <span
          className={`text-[11px] px-2.5 py-1 rounded-pill font-semibold tabular-nums ${
            net >= 0 ? 'bg-income-bg text-income-text' : 'bg-warning-bg text-warning-text'
          }`}
        >
          {net >= 0 ? '+' : '−'}{fmt(Math.abs(net))}
        </span>
      </div>

      {/* ── Hero amount row ───────────────────────────────────── */}
      <div className="flex items-baseline justify-between mb-4">
        <div>
          <p className="text-[10px] text-ink-3 mb-0.5">{totalLabel}</p>
          <p className="text-[22px] font-bold tabular-nums text-ink tracking-tight leading-none">
            {fmt(inflow)}
          </p>
        </div>
        <p className="text-[10px] text-ink-3 tabular-nums">
          {outflow > 0 ? `${fmt(outflow)} deployed` : ''}
        </p>
      </div>

      {/* ── Stacked bar ───────────────────────────────────────── */}
      <div className="mb-4">
        <div className="h-2.5 rounded-pill overflow-hidden flex" style={{ background: 'rgba(26,26,46,0.06)' }}>
          {visibleSegments.map((seg) => (
            <motion.div
              key={seg.key}
              className="h-full first:rounded-l-pill last:rounded-r-pill"
              style={{ background: seg.color }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(3, seg.pct)}%` }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            />
          ))}
        </div>
      </div>

      {/* ── Segment tiles ─────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {segments.map((seg) => (
          <div key={seg.key} className="rounded-card bg-kosha-surface-2 p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: seg.color }} />
              <p className="text-[10px] text-ink-3">{seg.label}</p>
            </div>
            <p className={`text-[14px] font-semibold tabular-nums leading-none ${seg.tone}`}>
              {fmt(seg.amount)}
            </p>
            <p className="text-[10px] text-ink-3 tabular-nums mt-1">{seg.pct}%</p>
          </div>
        ))}
      </div>

      {/* ── Insight ───────────────────────────────────────────── */}
      <div className="rounded-card bg-kosha-surface-2 px-3 py-2">
        <p className="text-[11px] text-ink-2 leading-relaxed">{insight}</p>
      </div>
    </div>
  )
}
