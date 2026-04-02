import { memo, useMemo } from 'react'
import { fmt } from '../../../lib/utils'

export default memo(function FixedVsVariableCard({ txnRows, earned }) {
  const analysis = useMemo(() => {
    let fixed = 0
    let variable = 0

    for (const row of txnRows) {
      if (row.type !== 'expense') continue
      const amt = Number(row.amount || 0)
      if (!Number.isFinite(amt) || amt <= 0) continue

      const isFixed = !!row.is_recurring || !!row.is_auto_generated || !!row.source_transaction_id
      if (isFixed) {
        fixed += amt
      } else {
        variable += amt
      }
    }

    const total = fixed + variable
    if (total <= 0) return null

    const fixedPct = Math.round((fixed / total) * 100)
    const variablePct = 100 - fixedPct
    const committedPct = earned > 0 ? Math.round((fixed / earned) * 100) : 0

    return { fixed, variable, total, fixedPct, variablePct, committedPct }
  }, [txnRows, earned])

  if (!analysis) return null

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-label font-semibold text-ink">Fixed vs variable spend</p>
          <p className="text-[11px] text-ink-3 mt-0.5">
            Recurring commitments vs discretionary — shows where you have control.
          </p>
        </div>
        <span className={`text-[11px] px-2 py-1 rounded-pill font-semibold ${
          analysis.committedPct <= 40
            ? 'bg-income-bg text-income-text'
            : analysis.committedPct <= 60
              ? 'bg-warning-bg text-warning-text'
              : 'bg-expense-bg text-expense-text'
        }`}>
          {analysis.committedPct}% pre-committed
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2.5">
        <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
          <p className="text-[10px] text-ink-3">Fixed (recurring)</p>
          <p className="text-[12px] font-bold tabular-nums text-expense-text">{fmt(analysis.fixed)}</p>
          <p className="text-[10px] text-ink-3 tabular-nums mt-0.5">{analysis.fixedPct}% of spend</p>
        </div>
        <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
          <p className="text-[10px] text-ink-3">Variable (ad-hoc)</p>
          <p className="text-[12px] font-bold tabular-nums text-brand">{fmt(analysis.variable)}</p>
          <p className="text-[10px] text-ink-3 tabular-nums mt-0.5">{analysis.variablePct}% of spend</p>
        </div>
      </div>

      {/* Stacked bar */}
      <div className="rounded-card border border-kosha-border bg-kosha-surface-2 p-2.5">
        <div className="h-3 rounded-pill overflow-hidden flex">
          {analysis.fixedPct > 0 && (
            <div
              className="h-full bg-expense-text"
              style={{ width: `${Math.max(4, analysis.fixedPct)}%` }}
              title={`Fixed: ${analysis.fixedPct}%`}
            />
          )}
          {analysis.variablePct > 0 && (
            <div
              className="h-full bg-brand"
              style={{ width: `${Math.max(4, analysis.variablePct)}%` }}
              title={`Variable: ${analysis.variablePct}%`}
            />
          )}
        </div>
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-expense-text" />
            <span className="text-[10px] text-ink-3">Fixed {analysis.fixedPct}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-brand" />
            <span className="text-[10px] text-ink-3">Variable {analysis.variablePct}%</span>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-ink-3 mt-2">
        {analysis.committedPct > 50
          ? `${analysis.committedPct}% of income is locked before the month starts. Review subscriptions and EMIs to free up discretionary space.`
          : analysis.fixedPct > 60
            ? `Most of your spend is committed. Variable expenses are low — focus cuts on recurring items.`
            : `${analysis.variablePct}% of spend is discretionary — this is where budget cuts have the most impact.`
        }
      </p>
    </div>
  )
})
