import { memo, useMemo, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, CheckCircle2, X } from 'lucide-react'
import TransactionItem from '../transactions/TransactionItem'
import { fmt } from '../../lib/utils'
import { CATEGORIES } from '../../lib/categories'
import Button from '../ui/Button'
import EmptyState from '../common/EmptyState'

const SWIPE_HINT_DISMISSED_KEY = 'kosha:swipe-delete-hint-dismissed-v1'
const SWIPE_HINT_LEARNED_KEY = 'kosha:swipe-delete-hint-learned-v1'
const SWIPE_HINT_NUDGED_KEY = 'kosha:swipe-delete-hint-nudged-v1'

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
  const [showSwipeHint, setShowSwipeHint] = useState(false)
  const [triggerSwipeNudge, setTriggerSwipeNudge] = useState(false)

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(SWIPE_HINT_DISMISSED_KEY) === '1'
      const learned = localStorage.getItem(SWIPE_HINT_LEARNED_KEY) === '1'
      const nudged = localStorage.getItem(SWIPE_HINT_NUDGED_KEY) === '1'

      setShowSwipeHint(!dismissed && !learned)
      setTriggerSwipeNudge(!nudged)
    } catch {
      setShowSwipeHint(true)
      setTriggerSwipeNudge(true)
    }
  }, [])

  const dismissSwipeHint = useCallback(() => {
    setShowSwipeHint(false)
    try {
      localStorage.setItem(SWIPE_HINT_DISMISSED_KEY, '1')
    } catch {
      // no-op
    }
  }, [])

  const handleSwipeHintLearned = useCallback(() => {
    setShowSwipeHint(false)
    try {
      localStorage.setItem(SWIPE_HINT_LEARNED_KEY, '1')
    } catch {
      // no-op
    }
  }, [])

  const handleAutoNudgeDone = useCallback(() => {
    setTriggerSwipeNudge(false)
    try {
      localStorage.setItem(SWIPE_HINT_NUDGED_KEY, '1')
    } catch {
      // no-op
    }
  }, [])

  const visibleRecent = useMemo(() => (recent || []).slice(0, 5), [recent])
  const categoryLabelById = useMemo(
    () => new Map(CATEGORIES.map((category) => [category.id, category.label])),
    []
  )
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
  const outflowInsights = useMemo(() => {
    const outflowRows = visibleRecent.filter((txn) => txn?.type === 'expense' || txn?.type === 'investment')
    if (!outflowRows.length) return null

    const categoryTotals = new Map()
    let largestTxn = null

    for (const txn of outflowRows) {
      const amount = Number(txn?.amount || 0)
      if (!Number.isFinite(amount) || amount <= 0) continue

      const bucket = txn?.type === 'investment'
        ? (String(txn?.investment_vehicle || '').trim() || 'Investment')
        : (String(txn?.category || '').trim() || 'other')

      categoryTotals.set(bucket, (categoryTotals.get(bucket) || 0) + amount)

      if (!largestTxn || amount > Number(largestTxn.amount || 0)) {
        largestTxn = txn
      }
    }

    if (!categoryTotals.size) return null

    const [topBucket, topAmount] = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1])[0]
    const topLabel = categoryLabelById.get(topBucket) || topBucket

    const largestLabel = largestTxn?.description
      || categoryLabelById.get(largestTxn?.category)
      || largestTxn?.investment_vehicle
      || 'Largest outflow'

    return {
      topLabel,
      topAmount,
      largestLabel,
      largestAmount: Number(largestTxn?.amount || 0),
    }
  }, [visibleRecent, categoryLabelById])
  const lastIndex = visibleRecent.length - 1

  if (visibleRecent.length === 0) {
    return (
      <div className="card p-4 border-0">
        <div className="flex items-center justify-between mb-2.5">
          <p className="section-label">Latest transactions</p>
        </div>

        <EmptyState
          className="py-6 !bg-transparent !shadow-none"
          imageUrl="/illustrations/empty_transactions.png"
          title="No transactions yet"
          description="Your latest activity will appear here after you add your first transaction."
          actionLabel="Go to transactions"
          onAction={() => navigate('/transactions')}
        />
      </div>
    )
  }

  return (
    <div className="card p-4 border-0">
      <div className="flex items-center justify-between mb-2.5">
        <p className="section-label">Latest transactions</p>
        <button
          onClick={() => navigate('/transactions')}
          className="flex items-center gap-1 text-label font-medium text-accent-text"
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

      {outflowInsights && (
        <div className="mini-panel px-3 py-2.5 mb-2.5">
          <p className="text-[10px] tracking-wide text-ink-3">Recent outflow cues</p>
          <p className="text-[11px] text-ink-2 mt-1">
            Top driver: <span className="font-semibold">{outflowInsights.topLabel}</span> · {fmt(outflowInsights.topAmount)}
          </p>
          <p className="text-[10px] text-ink-3 mt-1">
            Largest row: {outflowInsights.largestLabel} · {fmt(outflowInsights.largestAmount)}
          </p>
        </div>
      )}

      {showSwipeHint && (
        <div className="mini-panel px-3 py-2 mb-2.5 flex items-start gap-2.5">
          <div className="w-5 h-5 rounded-full bg-brand-container text-brand text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
            i
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-ink-2 leading-relaxed">
              Quick tip: swipe left on a row to Repeat or Delete.
            </p>
          </div>
          <button
            type="button"
            onClick={dismissSwipeHint}
            className="text-ink-4 hover:text-ink-2 transition-colors"
            aria-label="Dismiss swipe hint"
          >
            <X size={13} />
          </button>
        </div>
      )}

      <div className="rounded-card bg-kosha-surface-2 overflow-hidden">
        {visibleRecent.map((t, i) => {
          const isLinked = !!(t.linked_split_expense_id || t.linked_split_settlement_id || t.linked_bill_id || t.linked_loan_id)
          return (
            <TransactionItem
              key={t.id}
              txn={t}
              showDate
              compact
              isLast={i === lastIndex}
              autoNudge={triggerSwipeNudge && i === 0 && !isLinked}
              onAutoNudgeDone={handleAutoNudgeDone}
              onSwipeHintLearned={handleSwipeHintLearned}
              onDelete={isLinked ? undefined : onDelete}
              onTap={onTap}
              onDuplicate={isLinked ? undefined : onDuplicate}
            />
          )
        })}
      </div>
    </div>
  )
})

export default DashboardRecentTransactions
