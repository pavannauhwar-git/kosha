import { memo, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import TransactionItem from '../transactions/TransactionItem'
import EmptyState from '../common/EmptyState'

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
  const lastIndex = visibleRecent.length - 1

  if (visibleRecent.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="section-label">Latest</p>
        </div>
        <EmptyState
          className="py-8"
          icon={<CheckCircle2 size={24} className="text-brand" />}
          title="No transactions yet"
          description="Your latest activity will appear here after you add your first transaction."
          actionLabel="Go to transactions"
          onAction={() => navigate('/transactions')}
        />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="section-label">Latest</p>
        <button
          onClick={() => navigate('/transactions')}
          className="flex items-center gap-1 text-label font-medium text-brand"
        >
          See all <ArrowRight size={13} />
        </button>
      </div>

      <div className="list-card">
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
