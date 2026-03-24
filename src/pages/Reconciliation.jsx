import { useMemo, useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import SkeletonLayout from '../components/common/SkeletonLayout'
import { useTransactions, updateTransaction } from '../hooks/useTransactions'
import { CATEGORIES } from '../lib/categories'
import { fmt, fmtDate } from '../lib/utils'
import {
  buildReconciliationInsights,
  getReviewedReconciliationIds,
  setReviewedReconciliationIds,
} from '../lib/reconciliation'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'missing-category', label: 'Missing category' },
  { id: 'missing-details', label: 'Missing details' },
  { id: 'duplicates', label: 'Potential duplicates' },
]

export default function Reconciliation() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')
  const [reviewedIds, setReviewedIds] = useState(() => getReviewedReconciliationIds())
  const [savingId, setSavingId] = useState(null)
  const [toast, setToast] = useState(null)

  const { data, loading } = useTransactions({ limit: 250 })

  useEffect(() => {
    setReviewedReconciliationIds(reviewedIds)
  }, [reviewedIds])

  const insights = useMemo(
    () => buildReconciliationInsights(data, reviewedIds),
    [data, reviewedIds]
  )

  const visibleItems = useMemo(() => {
    const base = insights.queue
    if (filter === 'missing-category') return base.filter((item) => item.flags.missingCategory)
    if (filter === 'missing-details') {
      return base.filter((item) => item.flags.missingDescription || item.flags.missingPaymentMode)
    }
    if (filter === 'duplicates') return base.filter((item) => item.flags.potentialDuplicate)
    return base
  }, [insights.queue, filter])

  const markReviewed = useCallback((id) => {
    if (!id) return
    setReviewedIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  const setCategory = useCallback(async (id, category) => {
    if (!id || !category || savingId) return
    setSavingId(id)
    try {
      await updateTransaction(id, { category })
      markReviewed(id)
      setToast('Category updated and item reconciled.')
      setTimeout(() => setToast(null), 2600)
    } catch (error) {
      setToast(error?.message || 'Could not update category.')
      setTimeout(() => setToast(null), 3000)
    } finally {
      setSavingId(null)
    }
  }, [savingId, markReviewed])

  return (
    <div className="page">
      <PageHeader title="Reconciliation" />

      <div className="card p-4 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-ink">Data quality workspace</p>
            <p className="text-caption text-ink-3 mt-1">
              Review high-signal entries before month close to improve dashboard trust and budget accuracy.
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-brand-container text-brand flex items-center justify-center shrink-0">
            <ShieldCheck size={18} />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
          <Metric label="In queue" value={insights.counts.queue} tone="text-brand" />
          <Metric label="Reviewed" value={insights.counts.reviewed} tone="text-income-text" />
          <Metric label="Missing category" value={insights.counts.missingCategory} tone="text-warning-text" />
          <Metric label="Duplicates" value={insights.counts.potentialDuplicate} tone="text-expense-text" />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-4">
        {FILTERS.map((chip) => {
          const active = chip.id === filter
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => setFilter(chip.id)}
              className={`chip ${active ? 'chip-active' : ''}`}
            >
              {chip.label}
            </button>
          )
        })}
      </div>

      {loading ? (
        <SkeletonLayout
          sections={[
            { type: 'block', height: 'h-[160px]' },
            { type: 'block', height: 'h-[160px]' },
            { type: 'block', height: 'h-[160px]' },
          ]}
        />
      ) : visibleItems.length === 0 ? (
        <div className="card p-8 text-center">
          <CheckCircle2 size={22} className="mx-auto text-income-text mb-2" />
          <p className="text-body text-ink-2">No pending reconciliation items.</p>
          <p className="text-caption text-ink-3 mt-1">Everything in your review queue is clean.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleItems.map((item) => {
            const txn = item.txn
            const disabled = savingId === txn.id
            return (
              <motion.div
                key={txn.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="card p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">
                      {txn.description || 'No description'}
                    </p>
                    <p className="text-caption text-ink-3 mt-0.5">
                      {fmtDate(txn.date)} · {txn.type} · {fmt(Number(txn.amount || 0))}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/transactions?focus=${txn.id}`)}
                    className="chip whitespace-nowrap"
                  >
                    Open <ArrowRight size={13} />
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 mt-3">
                  {item.flags.missingDescription && <span className="chip text-warning-text">Missing description</span>}
                  {item.flags.missingCategory && <span className="chip text-warning-text">Missing category</span>}
                  {item.flags.missingPaymentMode && <span className="chip text-warning-text">Missing payment mode</span>}
                  {item.flags.potentialDuplicate && (
                    <span className="chip text-expense-text">{item.duplicateCount} potential duplicates</span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {item.flags.missingCategory && txn.type === 'expense' && (
                    <select
                      className="input h-9 text-sm max-w-[220px]"
                      defaultValue=""
                      onChange={(e) => {
                        const value = e.target.value
                        if (value) {
                          void setCategory(txn.id, value)
                          e.target.value = ''
                        }
                      }}
                      disabled={disabled}
                    >
                      <option value="">Set category…</option>
                      {CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.id}>{cat.label}</option>
                      ))}
                    </select>
                  )}

                  <button
                    type="button"
                    onClick={() => markReviewed(txn.id)}
                    className="btn-ghost h-9 px-3"
                    disabled={disabled}
                  >
                    Mark reviewed
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}

      <AnimateToast message={toast} />
    </div>
  )
}

function Metric({ label, value, tone = 'text-ink' }) {
  return (
    <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
      <p className="text-caption text-ink-3">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  )
}

function AnimateToast({ message }) {
  if (!message) return null
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      className="fixed bottom-[calc(88px+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 z-50"
    >
      <div className="rounded-full bg-ink text-white text-sm px-4 py-2 shadow-lg">
        {message}
      </div>
    </motion.div>
  )
}