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

  const primaryRows = [
    {
      key: 'spent',
      label: 'Spent',
      amount: expense,
      pct: Math.max(0, spentPct),
      tone: 'text-expense-text',
      bar: '#E11D48',
      hint: 'Operations and lifestyle outflow',
    },
    {
      key: 'invested',
      label: 'Invested',
      amount: investment,
      pct: Math.max(0, investedPct),
      tone: 'text-invest-text',
      bar: '#7C3AED',
      hint: 'Future allocation and wealth build',
    },
    {
      key: saved > 0 ? 'leftover' : 'deficit',
      label: saved > 0 ? 'Leftover' : 'Deficit',
      amount: saved > 0 ? saved : deficit,
      pct: Math.max(0, saved > 0 ? savedPct : deficitPct),
      tone: saved > 0 ? 'text-income-text' : 'text-warning-text',
      bar: saved > 0 ? '#0E9F6E' : '#9A7200',
      hint: saved > 0 ? 'Available month-end buffer' : 'Outflow exceeded inflow',
    },
  ]

  const allocationSegments = primaryRows.filter((row) => row.pct > 0)

  const actionNote = (() => {
    if (net < 0) {
      return `Deficit warning: outflow exceeded inflow by ${fmt(deficit)} this month. Prioritize discretionary cuts and defer optional deployments.`
    }
    if (savedPct < 10) {
      return `Only ${savedPct}% of inflow is left after spending and investments. Aim for at least a 10-15% monthly buffer.`
    }
    if (investedPct < 8) {
      return `Investment share is ${investedPct}% of inflow. A small planned top-up can improve long-horizon consistency.`
    }
    return 'Allocation looks balanced for this month. Continue current pacing and keep the leftover buffer protected.'
  })()

  if (earned === 0) return null

  return (
    <div className="card p-4 border-0">
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div>
          <p className="section-label">Cashflow breakdown</p>
          <p className="text-[11px] text-ink-3 mt-0.5">Allocation tree from inflow into spend, investment, and month-end buffer</p>
        </div>
        <span className={`text-[10px] px-2 py-1 rounded-pill font-semibold ${net >= 0 ? 'bg-income-bg text-income-text' : 'bg-warning-bg text-warning-text'}`}>
          {net >= 0 ? 'Net positive' : 'Net deficit'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2.5">
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">{totalLabel}</p>
          <p className="text-[12px] font-bold tabular-nums text-income-text">{fmt(inflow)}</p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">Outflow</p>
          <p className="text-[12px] font-bold tabular-nums text-expense-text">{fmt(outflow)}</p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">Net</p>
          <p className={`text-[12px] font-bold tabular-nums ${net >= 0 ? 'text-income-text' : 'text-warning-text'}`}>
            {net >= 0 ? '+' : '-'}{fmt(Math.abs(net))}
          </p>
        </div>
      </div>

      <div className="rounded-card border border-kosha-border bg-kosha-surface-2 p-2.5 mb-2.5">
        <div className="h-2.5 rounded-pill bg-kosha-border overflow-hidden flex">
          {allocationSegments.map((segment) => (
            <div
              key={`allocation-segment-${segment.key}`}
              className="h-full"
              style={{ width: `${Math.max(4, segment.pct)}%`, background: segment.bar }}
            />
          ))}
        </div>

        <div className="mt-2 rounded-card border border-kosha-border bg-kosha-surface px-3 py-2" role="treeitem" aria-level={1}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold text-ink">Inflow root</p>
              <p className="text-[10px] text-ink-3">{fmt(inflow)} distributed across three branches</p>
            </div>
            <p className="text-[11px] font-bold tabular-nums text-income-text">100%</p>
          </div>
        </div>

        <div role="group" className="ml-2 mt-2 pl-3 border-l border-kosha-border space-y-1.5">
          {primaryRows.map((row) => (
            <div key={row.key} role="treeitem" aria-level={2} className="relative rounded-card border border-kosha-border bg-kosha-surface px-2.5 py-2">
              <span className="absolute -left-[13px] top-1/2 -translate-y-1/2 h-px w-3 bg-kosha-border" />

              <div className="flex items-center justify-between gap-2 mb-1">
                <div>
                  <p className="text-[11px] font-semibold text-ink">{row.label}</p>
                  <p className="text-[10px] text-ink-3">{row.hint}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-[11px] font-semibold tabular-nums ${row.tone}`}>{fmt(row.amount)}</p>
                  <p className="text-[10px] text-ink-3 tabular-nums">{row.pct}% of inflow</p>
                </div>
              </div>

              <div className="h-1.5 rounded-pill bg-kosha-border overflow-hidden">
                <div className="h-full rounded-pill" style={{ width: `${Math.max(5, row.pct)}%`, background: row.bar }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-2 border-t border-kosha-border">
        <p className="text-[11px] text-ink-3 leading-relaxed">{actionNote}</p>
      </div>
    </div>
  )
}
