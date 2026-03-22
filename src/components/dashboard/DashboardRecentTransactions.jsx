import { memo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import TransactionItem from '../TransactionItem'

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

  if (!recent || recent.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="section-label">Latest</p>
        </div>
        <div className="card p-8 text-center">
          <p className="text-body text-ink-3">No transactions yet.</p>
          <p className="text-label text-ink-4 mt-1">Tap + to add your first one.</p>
        </div>
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
        {recent.slice(0, 8).map((t, i) => (
          <TransactionItem
            key={t.id}
            txn={t}
            showDate
            isLast={i === Math.min(recent.length, 8) - 1}
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
