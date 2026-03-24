import { useMemo, useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, ArrowRight, CheckCircle2, History, Link2, RotateCcw, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import SkeletonLayout from '../components/common/SkeletonLayout'
import { useTransactions, updateTransaction } from '../hooks/useTransactions'
import {
  clearLearnedReconciliationAliases,
  reportReconciliationFalsePositive,
  useReconciliationReviews,
  upsertReconciliationReview,
} from '../hooks/useReconciliationReviews'
import { CATEGORIES } from '../lib/categories'
import { fmt, fmtDate } from '../lib/utils'
import {
  buildLearnedStatementAliases,
  matchStatementEntries,
  parseStatementLines,
} from '../lib/statementMatching'
import {
  buildReconciliationInsights,
  getReviewedReconciliationIds,
  setReviewedReconciliationIds,
} from '../lib/reconciliation'
import { detectConfidenceDrift, getDriftMessage, identifyDemotedAliases, calculateAliasQuality } from '../lib/reconciliationMetrics'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'missing-category', label: 'Missing category' },
  { id: 'missing-details', label: 'Missing details' },
  { id: 'duplicates', label: 'Potential duplicates' },
]

export default function Reconciliation() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('all')
  const [localReviewedIds, setLocalReviewedIds] = useState(() => getReviewedReconciliationIds())
  const [savingId, setSavingId] = useState(null)
  const [resettingAliases, setResettingAliases] = useState(false)
  const [toast, setToast] = useState(null)
  const [statementInput, setStatementInput] = useState('')

  const { data, loading } = useTransactions({ limit: 250 })
  const {
    rows: reviewRows,
    reviewedIdSet: serverReviewedIds,
    linkedIdSet,
    unavailable: reviewTableUnavailable,
    loading: reviewsLoading,
    refetch: refetchReviews,
  } = useReconciliationReviews()

  const effectiveReviewedIds = useMemo(
    () => (reviewTableUnavailable ? localReviewedIds : serverReviewedIds),
    [reviewTableUnavailable, localReviewedIds, serverReviewedIds]
  )

  useEffect(() => {
    if (!reviewTableUnavailable) return
    setReviewedReconciliationIds(localReviewedIds)
  }, [reviewTableUnavailable, localReviewedIds])

  const insights = useMemo(
    () => buildReconciliationInsights(data, effectiveReviewedIds),
    [data, effectiveReviewedIds]
  )

  const statementEntries = useMemo(
    () => parseStatementLines(statementInput),
    [statementInput]
  )

  const demotedMerchants = useMemo(
    () => identifyDemotedAliases(reviewRows, data, 2, 30),
    [reviewRows, data]
  )

  const aliasQualities = useMemo(
    () => calculateAliasQuality(reviewRows, data, 30),
    [reviewRows, data]
  )

  const learnedAliases = useMemo(
    () => buildLearnedStatementAliases(reviewRows, data, demotedMerchants),
    [reviewRows, data, demotedMerchants]
  )

  const learnedAliasCount = learnedAliases.length

  const confidenceDrift = useMemo(
    () => detectConfidenceDrift(reviewRows),
    [reviewRows]
  )

  const driftMessage = useMemo(
    () => getDriftMessage(confidenceDrift),
    [confidenceDrift]
  )

  const statementMatches = useMemo(
    () => matchStatementEntries(statementEntries, data, { aliases: learnedAliases }),
    [statementEntries, data, learnedAliases]
  )

  const statementSummary = useMemo(() => {
    const total = statementMatches.length
    const valid = statementMatches.filter((row) => row.entry.isValid).length
    const matched = statementMatches.filter((row) => !!row.best).length
    const highConfidence = statementMatches.filter((row) => row.confidence === 'high').length
    const linkedSuggestions = statementMatches.filter((row) => row.best?.txn?.id && linkedIdSet.has(row.best.txn.id)).length
    const conversion = matched > 0 ? Math.round((linkedSuggestions / matched) * 100) : 0
    return { total, valid, matched, highConfidence, linkedSuggestions, conversion }
  }, [statementMatches, linkedIdSet])

  const recentLinkDecisions = useMemo(() => {
    const linkedRows = (reviewRows || [])
      .filter((row) => row?.status === 'linked' && row?.transaction_id)
      .sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')))
      .slice(0, 5)

    return linkedRows.map((row) => {
      const txn = (data || []).find((item) => item.id === row.transaction_id)
      const parsed = parseStatementLines(row.statement_line || '')
      return {
        transactionId: row.transaction_id,
        statementPreview: parsed?.[0]?.description || row.statement_line || 'No statement line',
        transactionLabel: txn?.description || 'Transaction',
        amount: txn?.amount || null,
        date: txn?.date || null,
      }
    })
  }, [reviewRows, data])

  const visibleItems = useMemo(() => {
    const base = insights.queue
    if (filter === 'missing-category') return base.filter((item) => item.flags.missingCategory)
    if (filter === 'missing-details') {
      return base.filter((item) => item.flags.missingDescription || item.flags.missingPaymentMode)
    }
    if (filter === 'duplicates') return base.filter((item) => item.flags.potentialDuplicate)
    return base
  }, [insights.queue, filter])

  const markReviewedLocal = useCallback((id) => {
    if (!id) return
    setLocalReviewedIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  const persistReview = useCallback(async (id, status = 'reviewed', statementLine = null) => {
    if (!id) return false
    const result = await upsertReconciliationReview({
      transactionId: id,
      status,
      statementLine,
    })

    if (result?.unavailable) {
      markReviewedLocal(id)
      return false
    }

    await refetchReviews()
    return true
  }, [markReviewedLocal, refetchReviews])

  const markReviewed = useCallback(async (id) => {
    try {
      await persistReview(id, 'reviewed')
      setToast('Marked as reviewed.')
      setTimeout(() => setToast(null), 2200)
    } catch (error) {
      setToast(error?.message || 'Could not save reviewed state.')
      setTimeout(() => setToast(null), 3200)
    }
  }, [persistReview])

  const markLinked = useCallback(async (id, statementLine) => {
    try {
      await persistReview(id, 'linked', statementLine || null)
      setToast('Linked to statement line.')
      setTimeout(() => setToast(null), 2200)
    } catch (error) {
      setToast(error?.message || 'Could not save linked state.')
      setTimeout(() => setToast(null), 3200)
    }
  }, [persistReview])

  const reportFalsePositive = useCallback(async (id, statementLine) => {
    try {
      const result = await reportReconciliationFalsePositive({
        transactionId: id,
        statementLine: statementLine || null,
      })
      if (!result?.unavailable) await refetchReviews()
      setToast('Marked as mismatch for future tuning.')
      setTimeout(() => setToast(null), 2600)
    } catch (error) {
      setToast(error?.message || 'Could not report mismatch.')
      setTimeout(() => setToast(null), 3200)
    }
  }, [refetchReviews])

  const setCategory = useCallback(async (id, category) => {
    if (!id || !category || savingId || reviewsLoading) return
    setSavingId(id)
    try {
      await updateTransaction(id, { category })
      await persistReview(id, 'reviewed')
      setToast('Category updated and item reconciled.')
      setTimeout(() => setToast(null), 2600)
    } catch (error) {
      setToast(error?.message || 'Could not update category.')
      setTimeout(() => setToast(null), 3000)
    } finally {
      setSavingId(null)
    }
  }, [savingId, reviewsLoading, persistReview])

  const resetLearnedAliases = useCallback(async () => {
    if (resettingAliases || reviewTableUnavailable) return
    setResettingAliases(true)
    try {
      await clearLearnedReconciliationAliases()
      await refetchReviews()
      setToast('Learned aliases were reset.')
      setTimeout(() => setToast(null), 2200)
    } catch (error) {
      setToast(error?.message || 'Could not reset learned aliases.')
      setTimeout(() => setToast(null), 3200)
    } finally {
      setResettingAliases(false)
    }
  }, [resettingAliases, reviewTableUnavailable, refetchReviews])

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

      <div className="card p-4 mb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-sm font-semibold text-ink">Statement-style matching</p>
            <p className="text-caption text-ink-3 mt-1">
              Paste lines in Date, Description, Amount format. Kosha will propose likely transaction links.
            </p>
            <p className="text-[11px] text-ink-4 mt-1">
              Learned aliases: {learnedAliasCount}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => { void resetLearnedAliases() }}
              disabled={learnedAliasCount === 0 || resettingAliases || reviewTableUnavailable}
              className="btn-ghost h-9 px-3 text-[12px]"
            >
              <RotateCcw size={13} />
              {resettingAliases ? 'Resetting' : 'Reset aliases'}
            </button>
            <div className="w-9 h-9 rounded-full bg-brand-container text-brand flex items-center justify-center">
              <Link2 size={16} />
            </div>
          </div>
        </div>

        {driftMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-card border mb-3 px-3 py-2.5 flex items-start gap-2 ${
              driftMessage.severity === 'warning'
                ? 'border-warning-border bg-warning-bg'
                : 'border-brand-border bg-brand-bg'
            }`}
          >
            <AlertCircle
              size={14}
              className={`shrink-0 mt-0.5 ${
                driftMessage.severity === 'warning' ? 'text-warning-text' : 'text-brand'
              }`}
            />
            <div>
              <p className={`text-[12px] font-semibold ${
                driftMessage.severity === 'warning' ? 'text-warning-text' : 'text-brand'
              }`}>
                {driftMessage.title}
              </p>
              <p className="text-[11px] text-ink-3 mt-0.5">{driftMessage.message}</p>
            </div>
          </motion.div>
        )}

        <textarea
          value={statementInput}
          onChange={(e) => setStatementInput(e.target.value)}
          className="input min-h-[110px] text-sm"
          placeholder={[
            '24/03/2026, Swiggy, 542.00',
            '2026-03-22 | Uber | 318',
            '21-03-2026\tSalary\t50000',
          ].join('\n')}
        />

        {!!statementSummary.total && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 mb-3">
            <Metric label="Lines" value={statementSummary.total} />
            <Metric label="Parseable" value={statementSummary.valid} tone="text-brand" />
            <Metric label="Matched" value={statementSummary.matched} tone="text-income-text" />
            <Metric label="High confidence" value={statementSummary.highConfidence} tone="text-income-text" />
          </div>
        )}

        {!!statementSummary.total && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-1 mb-3">
            <Metric label="Linked suggestions" value={statementSummary.linkedSuggestions} tone="text-brand" />
            <Metric label="Conversion" value={`${statementSummary.conversion}%`} tone="text-income-text" />
            <Metric label="Learned aliases" value={learnedAliasCount} tone="text-ink" />
          </div>
        )}

        {!!statementSummary.total && (
          <div className="space-y-2">
            {statementMatches.slice(0, 6).map((row) => (
              <StatementMatchRow
                key={row.entry.id}
                row={row}
                onOpen={(id) => navigate(`/transactions?focus=${id}`)}
                linkedIdSet={linkedIdSet}
                onLink={(id, line) => markLinked(id, line)}
                onReject={(id, line) => reportFalsePositive(id, line)}
              />
            ))}
          </div>
        )}

        {recentLinkDecisions.length > 0 && (
          <div className="mt-4 border-t border-kosha-border pt-3">
            <div className="flex items-center gap-2 mb-2">
              <History size={14} className="text-ink-4" />
              <p className="text-[12px] font-semibold text-ink-2">Recent matching decisions</p>
            </div>
            <div className="space-y-2">
              {recentLinkDecisions.map((row) => (
                <div key={row.transactionId} className="rounded-card border border-kosha-border bg-kosha-surface px-3 py-2.5">
                  <p className="text-[12px] text-ink-2 truncate">{row.statementPreview}</p>
                  <p className="text-[11px] text-ink-4 mt-0.5 truncate">
                    Linked to: {row.transactionLabel}
                    {row.amount != null ? ` · ${fmt(Number(row.amount || 0))}` : ''}
                    {row.date ? ` · ${fmtDate(row.date)}` : ''}
                  </p>
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-brand mt-1 inline-flex items-center gap-1"
                    onClick={() => navigate(`/transactions?focus=${row.transactionId}`)}
                  >
                    Open <ArrowRight size={11} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {(aliasQualities.length > 0 || demotedMerchants.size > 0) && (
          <div className="mt-4 border-t border-kosha-border pt-3">
            <p className="text-[12px] font-semibold text-ink-2 mb-2">Alias quality & health</p>
            
            {aliasQualities.length > 0 && (
              <div className="mb-3">
                <p className="text-[11px] text-ink-3 mb-1.5">Top performers (30-day)</p>
                <div className="space-y-1">
                  {aliasQualities.slice(0, 3).map((alias) => (
                    <div key={alias.merchant} className="rounded-card border border-kosha-border bg-kosha-surface px-2.5 py-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] text-ink-2 truncate">{alias.merchant}</p>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                          alias.qualityScore >= 90 ? 'bg-income-bg text-income-text'
                          : alias.qualityScore >= 70 ? 'bg-brand-bg text-brand'
                          : 'bg-warning-bg text-warning-text'
                        }`}>
                          {alias.qualityScore}%
                        </span>
                      </div>
                      <p className="text-[10px] text-ink-4 mt-0.5">{alias.successCount} linked, {alias.rejectionCount} rejected</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {demotedMerchants.size > 0 && (
              <div>
                <p className="text-[11px] text-ink-3 mb-1.5">Currently auto-demoted (≥2 rejections)</p>
                <div className="space-y-1">
                  {Array.from(demotedMerchants).slice(0, 3).map((merchant) => (
                    <div key={merchant} className="rounded-card border border-kosha-border bg-expense-bg/10 px-2.5 py-1.5">
                      <p className="text-[11px] text-expense-text truncate">{merchant}</p>
                      <p className="text-[10px] text-ink-4 mt-0.5">Excluded from alias hints until re-linked</p>
                    </div>
                  ))}
                </div>
                {demotedMerchants.size > 3 && (
                  <p className="text-[10px] text-ink-4 mt-1.5">+{demotedMerchants.size - 3} more demoted merchants</p>
                )}
              </div>
            )}
          </div>
        )}
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
                    className="btn-ghost h-9 px-3"
                    disabled={disabled}
                    onClick={() => { void markReviewed(txn.id) }}
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

function StatementMatchRow({ row, onOpen, onLink, onReject, linkedIdSet }) {
  const best = row.best
  const entry = row.entry
  const isLinked = !!(best?.txn?.id && linkedIdSet?.has(best.txn.id))

  return (
    <div className="rounded-card border border-kosha-border bg-kosha-surface p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-ink-2 truncate">{entry.description || entry.line}</p>
          <p className="text-caption text-ink-3 mt-0.5">
            {entry.date || 'No date'} · {entry.amount != null ? fmt(entry.amount) : 'No amount'}
          </p>
        </div>
        <span className={`text-[11px] px-2 py-1 rounded-full font-semibold whitespace-nowrap ${
          row.confidence === 'high'
            ? 'bg-income-bg text-income-text'
            : row.confidence === 'medium'
              ? 'bg-warning-bg text-warning-text'
              : 'bg-kosha-surface-2 text-ink-3'
        }`}>
          {row.confidence}
        </span>
      </div>

      {!entry.isValid ? (
        <p className="text-caption text-expense-text mt-2">Could not parse this line. Use a date and numeric amount.</p>
      ) : !best ? (
        <p className="text-caption text-ink-3 mt-2">No candidate found in current transactions.</p>
      ) : (
        <div className="mt-2 rounded-card border border-kosha-border bg-white p-2.5">
          <p className="text-caption text-ink-3">
            Best: {best.txn.description || 'No description'} · {fmt(best.txn.amount)} · {fmtDate(best.txn.date)}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <button type="button" onClick={() => onOpen(best.txn.id)} className="chip">
              Open <ArrowRight size={13} />
            </button>
            <button
              type="button"
              onClick={() => { if (best?.txn?.id) void onLink(best.txn.id, entry.line) }}
              className="btn-ghost h-8 px-3"
            >
              {isLinked ? 'Linked' : 'Mark linked'}
            </button>
            <button
              type="button"
              onClick={() => { if (best?.txn?.id) void onReject(best.txn.id, entry.line) }}
              className="btn-ghost h-8 px-3"
            >
              Report mismatch
            </button>
          </div>
        </div>
      )}
    </div>
  )
}