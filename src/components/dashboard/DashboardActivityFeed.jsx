import { memo, useMemo } from 'react'
import { History, ArrowRightLeft, Trash2, CheckCircle2, PlusCircle, FileEdit } from 'lucide-react'
import { fmt } from '../../lib/utils'

function actionMeta(action) {
  switch (action) {
    case 'transaction_added':
      return { label: 'Transaction added', tone: 'text-income-text', Icon: PlusCircle }
    case 'transaction_updated':
      return { label: 'Transaction edited', tone: 'text-brand', Icon: FileEdit }
    case 'transaction_deleted':
      return { label: 'Transaction removed', tone: 'text-expense-text', Icon: Trash2 }
    case 'liability_added':
      return { label: 'Bill added', tone: 'text-warning-text', Icon: PlusCircle }
    case 'liability_marked_paid':
      return { label: 'Bill marked paid', tone: 'text-income-text', Icon: CheckCircle2 }
    case 'liability_deleted':
      return { label: 'Bill removed', tone: 'text-expense-text', Icon: Trash2 }
    default:
      return { label: 'Financial change', tone: 'text-ink-3', Icon: ArrowRightLeft }
  }
}

function formatShortDate(dateStr) {
  if (!dateStr) return ''
  const dt = new Date(dateStr)
  if (Number.isNaN(dt.getTime())) return ''
  
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function eventSubtitle(evt) {
  const m = evt.metadata || {}
  const action = evt.action

  const desc = m.description || m.after?.description || ''
  const rawAmt= m.amount ?? m.after?.amount
  const amt = rawAmt != null && Number.isFinite(Number(rawAmt)) ? fmt(Number(rawAmt)) : ''
  const category = m.category || m.after?.category || ''

  if (action === 'transaction_added' || action === 'transaction_updated') {
    if (desc && amt) return `₹${amt} - ${desc}`
    if (amt && category) return `₹${amt} - ${category}`
    if (desc) return desc
    if (amt) return amt
    if (category) return category
  }

  if (action === 'transaction_deleted') {
    if (desc && amt) return `₹${amt} - ${desc}`
    if (desc) return desc
    if (amt) return amt
  }

  if (action === 'liability_added') {
    const due = formatShortDate(m.due_date)
    if (desc && amt) return `₹${amt} - ${desc}`
    if (amt && due) return `₹${amt} - due ${due}`
    if (desc) return desc
    if (amt) return amt
  }

  if (action === 'liability_marked_paid') {
    if (desc && amt) return `₹${amt} - ${desc}`
    if (desc) return desc
    if (amt) return `₹${amt} settled`
  }

  if (action === 'liability_deleted') {
    if (desc && amt) return `₹${amt} - ${desc}`
    if (desc) return desc
    if (amt) return amt
  }

  return evt.entity_type === 'transaction' ? 'Transaction' : 'Bill'
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

  if (visibleEvents.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="section-label">Recent activity</p>
        </div>
        <div className="list-card">
          <div className="px-4 py-6 text-center">
            <History size={18} className="mx-auto text-ink-4 mb-2" />
            <p className="text-[13px] text-ink-3">No activity logged yet.</p>
            <p className="text-[11px] text-ink-4 mt-1">Your edits, deletes, and bill updates will appear here.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="section-label">Recent activity</p>
      </div>

      <div className="list-card">
        {visibleEvents.map((evt, idx) => {
          const meta = actionMeta(evt.action)
          const Icon = meta.Icon
          const isLast = idx === visibleEvents.length - 1
          return (
            <div key={evt.id} className={`flex items-center gap-3 px-4 py-3 bg-kosha-surface ${isLast ? '' : 'border-b border-brand-border'}`}>
              <div className="w-9 h-9 rounded-full bg-kosha-surface-2 flex items-center justify-center shrink-0">
                <Icon size={15} className={meta.tone} />
              </div>

              <div className="min-w-0 flex-1">
                <p className={`text-[13px] font-semibold ${meta.tone}`}>{meta.label}</p>
                <p className="text-[11px] text-ink-3 truncate">{eventSubtitle(evt)}</p>
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
