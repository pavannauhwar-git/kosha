import { memo, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { History, ArrowRight, ArrowRightLeft, Trash2, CheckCircle2, PlusCircle, FileEdit } from 'lucide-react'
import EmptyState from '../common/EmptyState'

function actionMeta(action) {
  switch (action) {
    case 'transaction_added':
      return { label: 'Transaction added', tone: 'text-income-text', Icon: PlusCircle }
    case 'transaction_updated':
      return { label: 'Transaction edited', tone: 'text-brand', Icon: FileEdit }
    case 'transaction_deleted':
      return { label: 'Transaction deleted', tone: 'text-expense-text', Icon: Trash2 }
    case 'liability_added':
      return { label: 'Bill added', tone: 'text-warning-text', Icon: PlusCircle }
    case 'liability_marked_paid':
      return { label: 'Bill marked paid', tone: 'text-income-text', Icon: CheckCircle2 }
    case 'liability_deleted':
      return { label: 'Bill deleted', tone: 'text-expense-text', Icon: Trash2 }
    default:
      return { label: 'Financial change', tone: 'text-ink-3', Icon: ArrowRightLeft }
  }
}

function entityLabel(entityType) {
  return entityType === 'transaction' ? 'Transaction' : 'Bill'
}

function formatEventTime(iso) {
  if (!iso) return ''
  const dt = new Date(iso)
  if (Number.isNaN(dt.getTime())) return ''

  return dt.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const DashboardActivityFeed = memo(function DashboardActivityFeed({ events }) {
  const navigate = useNavigate()
  const visibleEvents = useMemo(() => (events || []).slice(0, 3), [events])

  if (visibleEvents.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="section-label">Recent activity</p>
        </div>
        <EmptyState
          className="py-8"
          icon={<History size={24} className="text-brand" />}
          title="No activity logged yet"
          description="Your edits, deletes, and bill updates will appear here."
          actionLabel="Open transactions"
          onAction={() => navigate('/transactions')}
        />
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="section-label">Recent activity</p>
        <button
          onClick={() => navigate('/transactions')}
          className="flex items-center gap-1 text-label font-medium text-brand"
        >
          View log <ArrowRight size={13} />
        </button>
      </div>

      <div className="list-card">
        {visibleEvents.map((evt, idx) => {
          const meta = actionMeta(evt.action)
          const Icon = meta.Icon
          const isLast = idx === visibleEvents.length - 1
          return (
            <div key={evt.id} className={`list-row ${isLast ? '' : 'border-b border-brand-border'}`}>
              <div className="w-8 h-8 rounded-xl bg-kosha-surface-2 flex items-center justify-center shrink-0">
                <Icon size={14} className={meta.tone} />
              </div>

              <div className="min-w-0 flex-1">
                <p className={`text-[13px] font-semibold ${meta.tone}`}>{meta.label}</p>
                <p className="text-[11px] text-ink-3 truncate">
                  {entityLabel(evt.entity_type)} ID: {String(evt.entity_id || '').slice(0, 8)}
                </p>
              </div>

              <p className="text-[11px] text-ink-4 whitespace-nowrap">{formatEventTime(evt.created_at)}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
})

export default DashboardActivityFeed
