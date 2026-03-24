import { memo, useMemo } from 'react'
import { History, ArrowRightLeft, Trash2, CheckCircle2, PlusCircle, FileEdit } from 'lucide-react'

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
  const visibleEvents = useMemo(() => (events || []).slice(0, 5), [events])

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="section-label">Recent activity</p>
      </div>

      <div className="list-card">
        {visibleEvents.length === 0 ? (
          <div className="p-6 text-center">
            <History size={18} className="mx-auto text-ink-4 mb-2" />
            <p className="text-body text-ink-3">No activity logged yet.</p>
            <p className="text-label text-ink-4 mt-1">Your edits, deletes, and bill updates will appear here.</p>
          </div>
        ) : (
          visibleEvents.map((evt, idx) => {
            const meta = actionMeta(evt.action)
            const Icon = meta.Icon
            const isLast = idx === visibleEvents.length - 1
            return (
              <div
                key={evt.id}
                className={`w-full text-left px-4 py-3.5 ${isLast ? '' : 'border-b border-brand-border'}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-brand-container flex items-center justify-center shrink-0">
                    <Icon size={15} className={meta.tone} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className={`text-body font-semibold ${meta.tone}`}>{meta.label}</p>
                    <p className="text-label text-ink-3 truncate">
                      {entityLabel(evt.entity_type)} ID: {String(evt.entity_id || '').slice(0, 8)}
                    </p>
                  </div>

                  <p className="text-[11px] text-ink-4 whitespace-nowrap mt-0.5">{formatEventTime(evt.created_at)}</p>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
})

export default DashboardActivityFeed
