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
  const rawAmt = m.amount ?? m.after?.amount
  const amt = rawAmt != null && Number.isFinite(Number(rawAmt)) ? fmt(Number(rawAmt)) : ''
  const category = m.category || m.after?.category || ''

  if (action === 'transaction_added' || action === 'transaction_updated') {
    if (desc && amt) return `${amt} - ${desc}`
    if (amt && category) return `${amt} - ${category}`
    if (desc) return desc
    if (amt) return amt
    if (category) return category
  }

  if (action === 'transaction_deleted') {
    if (desc && amt) return `${amt} - ${desc}`
    if (desc) return desc
    if (amt) return amt
  }

  if (action === 'liability_added') {
    const due = formatShortDate(m.due_date)
    if (desc && amt) return `${amt} - ${desc}`
    if (amt && due) return `${amt} - due ${due}`
    if (desc) return desc
    if (amt) return amt
  }

  if (action === 'liability_marked_paid') {
    if (desc && amt) return `${amt} - ${desc}`
    if (desc) return desc
    if (amt) return `${amt} settled`
  }

  if (action === 'liability_deleted') {
    if (desc && amt) return `${amt} - ${desc}`
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
  const summary = useMemo(() => {
    return visibleEvents.reduce((acc, evt) => {
      if (evt?.action === 'transaction_added' || evt?.action === 'liability_added') acc.added += 1
      else if (evt?.action === 'transaction_updated' || evt?.action === 'liability_marked_paid') acc.updated += 1
      else if (evt?.action === 'transaction_deleted' || evt?.action === 'liability_deleted') acc.removed += 1
      return acc
    }, { added: 0, updated: 0, removed: 0 })
  }, [visibleEvents])

  if (visibleEvents.length === 0) {
    return (
      <div className="card p-4 border-0">
        <div className="flex items-center justify-between mb-2.5">
          <p className="section-label">Recent activity</p>
        </div>
        <div className="rounded-card border border-dashed border-kosha-border bg-kosha-surface-2 px-4 py-6 text-center">
          <History size={18} className="mx-auto text-ink-4 mb-2" />
          <p className="text-[13px] text-ink-3">No activity logged yet.</p>
          <p className="text-[11px] text-ink-4 mt-1">Your edits, deletes, and bill updates will appear here.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="card p-4 border-0">
      <div className="flex items-center justify-between mb-2.5">
        <p className="section-label">Recent activity</p>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2.5">
        <div className="rounded-card border border-kosha-border bg-kosha-surface-2 p-2">
          <p className="text-[10px] text-ink-3">Added</p>
          <p className="text-[12px] font-bold tabular-nums text-income-text">{summary.added}</p>
        </div>
        <div className="rounded-card border border-kosha-border bg-kosha-surface-2 p-2">
          <p className="text-[10px] text-ink-3">Updated</p>
          <p className="text-[12px] font-bold tabular-nums text-brand">{summary.updated}</p>
        </div>
        <div className="rounded-card border border-kosha-border bg-kosha-surface-2 p-2">
          <p className="text-[10px] text-ink-3">Removed</p>
          <p className="text-[12px] font-bold tabular-nums text-expense-text">{summary.removed}</p>
        </div>
      </div>

      <div className="rounded-card border border-kosha-border bg-kosha-surface-2 overflow-hidden">
        {visibleEvents.map((evt, idx) => {
          const meta = actionMeta(evt.action)
          const Icon = meta.Icon
          const isLast = idx === visibleEvents.length - 1
          return (
            <div key={evt.id} className={`flex items-center gap-3 px-3.5 py-3 bg-kosha-surface-2 ${isLast ? '' : 'border-b border-kosha-border'}`}>
              <div className="w-9 h-9 rounded-card bg-kosha-surface border border-kosha-border flex items-center justify-center shrink-0">
                <Icon size={15} className={meta.tone} />
              </div>

              <div className="min-w-0 flex-1">
                <p className={`text-[13px] font-semibold ${meta.tone}`}>{meta.label}</p>
                <p className="text-[11px] text-ink-3 truncate">{eventSubtitle(evt)}</p>
              </div>

              <p className="text-[10px] text-ink-4 whitespace-nowrap bg-kosha-surface px-2 py-1 rounded-pill border border-kosha-border">{formatEventTime(evt.created_at)}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
})

export default DashboardActivityFeed
