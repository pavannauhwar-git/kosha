import { memo, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import TransactionItem from '../transactions/TransactionItem'
import { fmt } from '../../lib/utils'

/**
 * DashboardRecentTransactions
 *
 * The "Latest" section of the dashboard. Extracted from Dashboard.jsx
 * so that updates to the hero card, running balance, or bills alert
 * don't cause the entire transaction list to re-render.
 *
 * Wrapped in memo. Its props are stable references:
 *   - recent: only changes when useTransactions refetches
 *   - onDelete / onTap / onDuplicate: useCallback from parent
 */
const DashboardRecentTransactions = memo(function DashboardRecentTransactions({
  recent,
  onDelete,
  onTap,
  onDuplicate,
}) {
  const navigate = useNavigate()
  const visibleRecent = useMemo(() => (recent || []).slice(0, 5), [recent])
  const summary = useMemo(() => {
    return visibleRecent.reduce((acc, txn) => {
      const amount = Number(txn?.amount || 0)
      if (!Number.isFinite(amount) || amount <= 0) return acc

      if (txn?.type === 'income' && !txn?.is_repayment) {
        acc.inflow += amount
      } else if (txn?.type === 'expense' || txn?.type === 'investment') {
        acc.outflow += amount
      }

      return acc
    }, { inflow: 0, outflow: 0 })
  }, [visibleRecent])
  const lastIndex = visibleRecent.length - 1

  if (visibleRecent.length === 0) {
    return (
      <div className="card p-4 border-0">
        <div className="flex items-center justify-between mb-2.5">
          <p className="section-label">Latest transactions</p>
        </div>

        <div className="rounded-card border border-dashed border-kosha-border bg-kosha-surface-2 p-6 text-center">
          <CheckCircle2 size={22} className="mx-auto text-ink mb-2" />
          <p className="text-[13px] font-semibold text-ink">No transactions yet</p>
          <p className="text-[11px] text-ink-3 mt-1">Your latest activity will appear here after you add your first transaction.</p>
          <button
            type="button"
            onClick={() => navigate('/transactions')}
            className="btn-secondary h-9 px-3 text-[11px] mt-3"
          >
            Go to transactions
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-4 border-0">
      <div className="flex items-center justify-between mb-2.5">
        <p className="section-label">Latest transactions</p>
        <button
          onClick={() => navigate('/transactions')}
          className="flex items-center gap-1 text-label font-medium text-accent"
        >
          See all <ArrowRight size={13} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2.5">
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] tracking-wide text-ink-3">Rows</p>
          <p className="text-[13px] font-semibold text-ink tabular-nums mt-0.5">{visibleRecent.length}</p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] tracking-wide text-ink-3">Inflow</p>
          <p className="text-[13px] font-semibold text-income-text tabular-nums mt-0.5">{fmt(summary.inflow)}</p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] tracking-wide text-ink-3">Outflow</p>
          <p className="text-[13px] font-semibold text-expense-text tabular-nums mt-0.5">{fmt(summary.outflow)}</p>
        </div>
      </div>

      <div className="rounded-card bg-kosha-surface-2 overflow-hidden">
        {visibleRecent.map((t, i) => (
          <TransactionItem
            key={t.id}
            txn={t}
            showDate
            compact
            isLast={i === lastIndex}
            onDelete={onDelete}
            onTap={onTap}
            onDuplicate={onDuplicate}
          />
        ))}
      </div>
    </div>
  )
})

export default DashboardRecentTransactions
