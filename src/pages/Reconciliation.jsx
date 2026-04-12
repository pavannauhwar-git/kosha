import { lazy, Suspense, useMemo, useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, ArrowRight, CheckCircle2, History, Home, Link2, RotateCcw, ShieldCheck } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import PageBackHeaderPage from '../components/layout/PageBackHeaderPage'
import SkeletonLayout from '../components/common/SkeletonLayout'
import EmptyState from '../components/common/EmptyState'
import FilterRow from '../components/common/FilterRow'
import AppToast from '../components/common/AppToast'
import Button from '../components/ui/Button'
import { useTransactions, saveTransactionMutation, TRANSACTION_INSIGHTS_COLUMNS } from '../hooks/useTransactions'
import {
  clearLearnedReconciliationAliases,
  reportReconciliationFalsePositive,
  useReconciliationReviews,
  upsertReconciliationReview,
} from '../hooks/useReconciliationReviews'
import useWindowedList from '../hooks/useWindowedList'
import { EXPENSE_CATEGORIES, PAYMENT_MODES } from '../lib/categories'
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
import { detectConfidenceDrift, getDriftMessage, identifyDemotedAliases, calculateAliasQuality, identifyMerchantsInCooldown } from '../lib/reconciliationMetrics'
import { C } from '../lib/colors'

const ReconciliationOverviewPanel = lazy(() => import('../components/reconciliation/ReconciliationOverviewPanel'))

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'missing-category', label: 'Missing category' },
  { id: 'missing-details', label: 'Missing details' },
  { id: 'duplicates', label: 'Potential duplicates' },
]

const REVIEW_STATE_FILTERS = [
  { id: 'queue', label: 'In queue' },
  { id: 'linked', label: 'Linked' },
  { id: 'reviewed', label: 'Reviewed' },
]

export default function Reconciliation() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [filter, setFilter] = useState('all')
  const [reviewStateFilter, setReviewStateFilter] = useState('queue')
  const [tab, setTab] = useState('queue')
  const [paymentModeFilter, setPaymentModeFilter] = useState('')
  const [localReviewedIds, setLocalReviewedIds] = useState(() => getReviewedReconciliationIds())
  const [savingId, setSavingId] = useState(null)
  const [resettingAliases, setResettingAliases] = useState(false)
  const [toast, setToast] = useState(null)
  const [statementInput, setStatementInput] = useState('')
  const [highlightedTxnId, setHighlightedTxnId] = useState(null)

  const { data, loading } = useTransactions({
    limit: 250,
    paymentMode: paymentModeFilter || undefined,
    columns: TRANSACTION_INSIGHTS_COLUMNS,
  })
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

  const needsMatchingInsights = tab === 'matching' || tab === 'overview'
  const needsOverviewInsights = tab === 'overview'

  const statementEntries = useMemo(
    () => (needsMatchingInsights ? parseStatementLines(statementInput) : []),
    [statementInput, needsMatchingInsights]
  )

  const demotedMerchants = useMemo(
    () => (needsMatchingInsights ? identifyDemotedAliases(reviewRows, data, 2, 30) : new Set()),
    [reviewRows, data, needsMatchingInsights]
  )

  const merchantsInCooldown = useMemo(
    () => (needsMatchingInsights ? identifyMerchantsInCooldown(reviewRows, 14) : new Set()),
    [reviewRows, needsMatchingInsights]
  )

  const aliasQualities = useMemo(
    () => (needsMatchingInsights ? calculateAliasQuality(reviewRows, data, 30) : []),
    [reviewRows, data, needsMatchingInsights]
  )

  const learnedAliases = useMemo(
    () => (needsMatchingInsights ? buildLearnedStatementAliases(reviewRows, data, demotedMerchants) : []),
    [reviewRows, data, demotedMerchants, needsMatchingInsights]
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
    () => (needsMatchingInsights ? matchStatementEntries(statementEntries, data, { aliases: learnedAliases }) : []),
    [statementEntries, data, learnedAliases, needsMatchingInsights]
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

  const statementValidationMessage = useMemo(() => {
    const trimmed = String(statementInput || '').trim()
    if (!trimmed) return ''
    if (trimmed.length < 10) {
      return 'Paste at least one valid transaction line (format: description, amount, date).'
    }
    if (!statementEntries.some((row) => row?.isValid)) {
      return 'No valid statement lines detected. Use format like: 24/03/2026, Swiggy, 542.00'
    }
    return ''
  }, [statementInput, statementEntries])

  const canUseStatementMatches = statementValidationMessage === '' && statementSummary.valid > 0

  const recentLinkDecisions = useMemo(() => {
    if (!needsMatchingInsights) return []

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
  }, [reviewRows, data, needsMatchingInsights])

  const visibleItems = useMemo(() => {
    let base = insights.candidates
    if (reviewStateFilter === 'queue') {
      base = base.filter((item) => !effectiveReviewedIds.has(item?.txn?.id))
    } else if (reviewStateFilter === 'linked') {
      base = base.filter((item) => linkedIdSet.has(item?.txn?.id))
    } else if (reviewStateFilter === 'reviewed') {
      base = base.filter((item) => {
        const id = item?.txn?.id
        return effectiveReviewedIds.has(id) && !linkedIdSet.has(id)
      })
    }

    if (filter === 'missing-category') return base.filter((item) => item.flags.missingCategory)
    if (filter === 'missing-details') {
      return base.filter((item) => item.flags.missingDescription || item.flags.missingPaymentMode)
    }
    if (filter === 'duplicates') return base.filter((item) => item.flags.potentialDuplicate)
    return base
  }, [insights.candidates, reviewStateFilter, effectiveReviewedIds, linkedIdSet, filter])

  const {
    containerRef: queueListRef,
    startIndex: queueStartIndex,
    endIndex: queueEndIndex,
    topPadding: queueTopPadding,
    bottomPadding: queueBottomPadding,
    measureElement: measureQueueRow,
    scrollToIndex: scrollQueueToIndex,
  } = useWindowedList({
    count: visibleItems.length,
    estimateSize: 196,
    overscan: 6,
    enabled: visibleItems.length > 20,
    resetKey: `${tab}:${reviewStateFilter}:${filter}:${paymentModeFilter}:${visibleItems.length}`,
    initialCount: 24,
  })

  const renderedQueueItems = useMemo(
    () => visibleItems.slice(queueStartIndex, queueEndIndex),
    [visibleItems, queueStartIndex, queueEndIndex]
  )

  const reviewCounts = useMemo(() => ({
    queue: insights.candidates.filter((item) => !effectiveReviewedIds.has(item?.txn?.id)).length,
    linked: insights.candidates.filter((item) => linkedIdSet.has(item?.txn?.id)).length,
    reviewed: insights.candidates.filter((item) => {
      const id = item?.txn?.id
      return effectiveReviewedIds.has(id) && !linkedIdSet.has(id)
    }).length,
  }), [insights.candidates, effectiveReviewedIds, linkedIdSet])

  const qualityCounts = useMemo(() => ({
    all: insights.candidates.length,
    'missing-category': insights.candidates.filter((item) => item.flags.missingCategory).length,
    'missing-details': insights.candidates.filter((item) => item.flags.missingDescription || item.flags.missingPaymentMode).length,
    duplicates: insights.candidates.filter((item) => item.flags.potentialDuplicate).length,
  }), [insights.candidates])

  const reviewProgress = useMemo(() => {
    const total = insights.candidates.length
    if (!total) {
      return { total: 0, resolved: 0, queue: 0, pct: 100 }
    }

    const resolved = insights.candidates.filter((item) => {
      const id = item?.txn?.id
      return linkedIdSet.has(id) || effectiveReviewedIds.has(id)
    }).length

    const queue = Math.max(0, total - resolved)
    const pct = Math.round((resolved / total) * 100)

    return { total, resolved, queue, pct }
  }, [insights.candidates, linkedIdSet, effectiveReviewedIds])

  const reconciliationFunnel = useMemo(() => {
    if (!needsOverviewInsights) {
      return [
        { name: 'Candidates', value: 0, fill: C.brand },
        { name: 'Reviewed', value: 0, fill: C.income },
        { name: 'Linked', value: 0, fill: C.invest },
      ]
    }

    const candidates = insights.candidates.length
    const reviewedOrLinked = reviewProgress.resolved
    const linked = reviewCounts.linked

    return [
      { name: 'Candidates', value: candidates, fill: C.brand },
      { name: 'Reviewed', value: reviewedOrLinked, fill: C.income },
      { name: 'Linked', value: linked, fill: C.invest },
    ]
  }, [insights.candidates.length, reviewProgress.resolved, reviewCounts.linked, needsOverviewInsights])

  const linkedConversion = useMemo(() => {
    const candidates = reconciliationFunnel[0]?.value || 0
    const linked = reconciliationFunnel[2]?.value || 0
    if (candidates <= 0) return 0
    return Math.round((linked / candidates) * 100)
  }, [reconciliationFunnel])

  const turnaroundDistribution = useMemo(() => {
    if (!needsOverviewInsights) {
      return {
        buckets: [],
        totalResolved: 0,
        medianDays: 0,
      }
    }

    const txnById = new Map((Array.isArray(data) ? data : []).map((txn) => [txn?.id, txn]))

    const buckets = [
      { id: '0-1', label: '0-1d', min: 0, max: 1, count: 0 },
      { id: '2-3', label: '2-3d', min: 2, max: 3, count: 0 },
      { id: '4-7', label: '4-7d', min: 4, max: 7, count: 0 },
      { id: '8-14', label: '8-14d', min: 8, max: 14, count: 0 },
      { id: '15+', label: '15+d', min: 15, max: Number.POSITIVE_INFINITY, count: 0 },
    ]

    const dayMs = 24 * 60 * 60 * 1000
    const leadTimes = []

    for (const row of (Array.isArray(reviewRows) ? reviewRows : [])) {
      if (!['reviewed', 'linked'].includes(row?.status)) continue

      const txn = txnById.get(row?.transaction_id)
      const resolvedAt = new Date(row?.updated_at || row?.created_at || 0).getTime()
      const txnAt = new Date(txn?.date || txn?.created_at || row?.created_at || 0).getTime()

      if (!Number.isFinite(resolvedAt) || !Number.isFinite(txnAt)) continue

      const daysToResolve = Math.max(0, Math.floor((resolvedAt - txnAt) / dayMs))
      leadTimes.push(daysToResolve)

      const bucket = buckets.find((item) => daysToResolve >= item.min && daysToResolve <= item.max)
      if (bucket) bucket.count += 1
    }

    const sortedLeadTimes = [...leadTimes].sort((a, b) => a - b)
    const middleIndex = Math.floor(sortedLeadTimes.length / 2)
    const medianDays = sortedLeadTimes.length
      ? (sortedLeadTimes.length % 2 === 0
          ? (sortedLeadTimes[middleIndex - 1] + sortedLeadTimes[middleIndex]) / 2
          : sortedLeadTimes[middleIndex])
      : 0

    return {
      buckets,
      totalResolved: leadTimes.length,
      medianDays: Math.round(medianDays * 10) / 10,
    }
  }, [reviewRows, data, needsOverviewInsights])

  const hasTransactions = (data || []).length > 0
  const hasActiveFilters = reviewStateFilter !== 'queue' || filter !== 'all' || !!paymentModeFilter

  useEffect(() => {
    const next = new URLSearchParams(searchParams)
    let shouldReplace = false

    const tabParam = searchParams.get('tab')
    if (tabParam && ['queue', 'matching', 'overview'].includes(tabParam)) {
      setTab(tabParam)
      next.delete('tab')
      shouldReplace = true
    }

    const view = searchParams.get('view') || searchParams.get('state')
    if (view && REVIEW_STATE_FILTERS.some((item) => item.id === view)) {
      setReviewStateFilter(view)
      setTab('queue')
      next.delete('view')
      next.delete('state')
      shouldReplace = true
    }

    const quality = searchParams.get('quality') || searchParams.get('filter')
    if (quality && FILTERS.some((item) => item.id === quality)) {
      setFilter(quality)
      setTab('queue')
      next.delete('quality')
      next.delete('filter')
      shouldReplace = true
    }

    if (shouldReplace) {
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const focusTxnId = searchParams.get('focus')

  useEffect(() => {
    if (!focusTxnId) return

    const focusIndex = visibleItems.findIndex((item) => item?.txn?.id === focusTxnId)
    if (focusIndex < 0) return

    scrollQueueToIndex(focusIndex, { behavior: 'smooth', block: 'center' })

    setHighlightedTxnId(focusTxnId)

    const scrollTimer = setTimeout(() => {
      const el = document.getElementById(`recon-item-${focusTxnId}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 70)

    const clearTimer = setTimeout(() => setHighlightedTxnId(null), 2400)

    const next = new URLSearchParams(searchParams)
    next.delete('focus')
    setSearchParams(next, { replace: true })

    return () => {
      clearTimeout(scrollTimer)
      clearTimeout(clearTimer)
    }
  }, [focusTxnId, visibleItems, scrollQueueToIndex, searchParams, setSearchParams])

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
      await saveTransactionMutation({ id, payload: { category } })
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

  const TABS = [
    { id: 'queue', label: 'Queue', count: reviewProgress.queue },
    { id: 'matching', label: 'Matching', count: statementSummary.total || null },
    { id: 'overview', label: 'Overview', count: null },
  ]

  return (
    <PageBackHeaderPage
      title="Reconciliation"
      onBack={() => navigate(-1)}
      rightSlot={(
        <button
          type="button"
          onClick={() => navigate('/')}
          className="w-9 h-9 rounded-pill flex items-center justify-center bg-kosha-surface-2 active:bg-kosha-border"
          aria-label="Go to home"
        >
          <Home size={16} className="text-ink-2" />
        </button>
      )}
      contentClassName="page"
    >

      {/* ── Summary strip ──────────────────────────────────── */}
      <div className="card p-0 mb-3.5 overflow-hidden">
        <div className="px-4 py-4 bg-kosha-surface-2 border-b border-kosha-border flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">Reconciliation cockpit</p>
            <p className="text-[11px] text-ink-3 mt-0.5">
              {reviewProgress.queue > 0
                ? `${reviewProgress.queue} item${reviewProgress.queue > 1 ? 's' : ''} need attention`
                : 'Queue clear. Your records look healthy.'}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-brand-container text-brand flex items-center justify-center shrink-0">
            <ShieldCheck size={18} />
          </div>
        </div>

        <div className="px-4 py-3.5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="mini-panel px-3 py-2.5">
              <p className="text-[10px] text-ink-3">Queue</p>
              <p className="text-[15px] font-semibold text-ink tabular-nums mt-1">{insights.counts.queue}</p>
            </div>
            <div className="mini-panel px-3 py-2.5">
              <p className="text-[10px] text-ink-3">Linked</p>
              <p className="text-[15px] font-semibold text-income-text tabular-nums mt-1">{reviewCounts.linked}</p>
            </div>
            <div className="mini-panel px-3 py-2.5">
              <p className="text-[10px] text-ink-3">No category</p>
              <p className="text-[15px] font-semibold text-warning-text tabular-nums mt-1">{insights.counts.missingCategory}</p>
            </div>
            <div className="mini-panel px-3 py-2.5">
              <p className="text-[10px] text-ink-3">Duplicates</p>
              <p className="text-[15px] font-semibold text-expense-text tabular-nums mt-1">{insights.counts.potentialDuplicate}</p>
            </div>
          </div>

          <div className="mt-3.5 mini-panel px-3 py-2.5">
            <div className="flex items-center justify-between gap-2 mb-1">
              <p className="text-[11px] font-semibold text-ink-3">Review progress</p>
              <p className="text-[11px] text-ink-3 tabular-nums">{reviewProgress.resolved}/{reviewProgress.total || 0}</p>
            </div>
            <div className="h-1.5 rounded-pill bg-kosha-border overflow-hidden">
              <motion.div
                className="h-full rounded-pill bg-brand"
                initial={{ width: 0 }}
                animate={{ width: `${reviewProgress.pct}%` }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
              />
            </div>
          </div>
        </div>
      </div>

      {confidenceDrift?.drifting && Number(confidenceDrift?.drift || 0) >= 25 && (
        <div className="rounded-card border border-warning-border bg-warning-bg px-3 py-2.5 mb-3.5 flex items-start gap-2">
          <AlertCircle size={14} className="text-warning-text shrink-0 mt-0.5" />
          <div>
            <p className="text-[12px] font-semibold text-warning-text">Match quality is declining</p>
            <p className="text-[11px] text-ink-3 mt-0.5">
              Recent linking confidence dropped by {confidenceDrift.drift}% versus baseline. Review links carefully before confirming.
            </p>
          </div>
        </div>
      )}

      {/* ── Tab bar ────────────────────────────────────────── */}
      <div className="card-inset p-1.5 mb-3.5 grid grid-cols-3 gap-1">
        {TABS.map((t) => {
          const active = t.id === tab
          return (
            <motion.button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.12 }}
              aria-pressed={active}
              className={`h-10 rounded-card text-[12px] font-semibold transition-all border
                ${active
                  ? 'bg-kosha-surface text-brand border-brand/20 shadow-card-sm'
                  : 'bg-transparent text-ink-3 border-transparent hover:bg-kosha-surface'}`}
            >
              {t.label}
              {t.count != null && (
                <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${active ? 'bg-brand-container text-brand' : 'bg-kosha-surface-2 text-ink-3'}`}>
                  {t.count}
                </span>
              )}
            </motion.button>
          )
        })}
      </div>

      {/* ── TAB: Queue ─────────────────────────────────────── */}
      {tab === 'queue' && (
        <>
          <div className="sticky-toolbar">
            <FilterRow className="mb-2">
              {REVIEW_STATE_FILTERS.map((chip) => {
                const active = chip.id === reviewStateFilter
                const count = reviewCounts[chip.id] || 0
                return (
                  <motion.button
                    key={chip.id}
                    type="button"
                    onClick={() => setReviewStateFilter(chip.id)}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.12 }}
                    aria-pressed={active}
                    className={`chip-control ${active ? 'chip-control-active' : 'chip-control-muted'}`}
                  >
                    {chip.label}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${active ? 'bg-black/10 text-current' : 'bg-kosha-surface-2 text-ink-3'}`}>
                      {count}
                    </span>
                  </motion.button>
                )
              })}
            </FilterRow>

            <FilterRow>
              {FILTERS.map((chip) => {
                const active = chip.id === filter
                const count = qualityCounts[chip.id] || 0
                return (
                  <motion.button
                    key={chip.id}
                    type="button"
                    onClick={() => setFilter(chip.id)}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.12 }}
                    aria-pressed={active}
                    className={`chip-control ${active ? 'chip-control-active' : 'chip-control-muted'}`}
                  >
                    {chip.label}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full tabular-nums ${active ? 'bg-black/10 text-current' : 'bg-kosha-surface-2 text-ink-3'}`}>
                      {count}
                    </span>
                  </motion.button>
                )
              })}
            </FilterRow>

            <FilterRow className="mt-2">
              <motion.button
                type="button"
                onClick={() => setPaymentModeFilter('')}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.12 }}
                aria-pressed={!paymentModeFilter}
                className={`chip-control ${!paymentModeFilter ? 'chip-control-active' : 'chip-control-muted'}`}
              >
                All payment modes
              </motion.button>

              {PAYMENT_MODES.map((mode) => {
                const active = paymentModeFilter === mode.id
                return (
                  <motion.button
                    key={mode.id}
                    type="button"
                    onClick={() => setPaymentModeFilter(mode.id)}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.12 }}
                    aria-pressed={active}
                    className={`chip-control ${active ? 'chip-control-active' : 'chip-control-muted'}`}
                  >
                    {mode.label}
                  </motion.button>
                )
              })}
            </FilterRow>
          </div>

          {loading ? (
            <SkeletonLayout
              sections={[
                { type: 'block', height: 'h-[160px]' },
                { type: 'block', height: 'h-[160px]' },
                { type: 'block', height: 'h-[160px]' },
              ]}
            />
          ) : !hasTransactions && !hasActiveFilters ? (
            <EmptyState
              icon={<History size={24} className="text-accent-text" />}
              title="Nothing to reconcile yet"
              description="Add transactions first. Reconciliation checks will surface here."
              actionLabel="Go to transactions"
              onAction={() => navigate('/transactions')}
            />
          ) : visibleItems.length === 0 ? (
            <EmptyState
              icon={<CheckCircle2 size={24} className="text-income-text" />}
              title={hasActiveFilters ? 'No items for selected filters' : 'Queue is clear'}
              description={
                hasActiveFilters
                  ? 'Try resetting filters to inspect the full reconciliation queue.'
                  : reviewStateFilter === 'queue'
                  ? 'No pending items right now. Your data quality looks good.'
                  : 'Try switching view or quality filters to inspect more items.'
              }
              actionLabel={hasActiveFilters ? 'Reset filters' : 'Open transactions'}
              onAction={hasActiveFilters
                ? () => {
                    setReviewStateFilter('queue')
                    setFilter('all')
                    setPaymentModeFilter('')
                  }
                : () => navigate('/transactions')}
            />
          ) : (
            <motion.div ref={queueListRef} className="space-y-2.5">
              {queueTopPadding > 0 && <div aria-hidden="true" style={{ height: `${queueTopPadding}px` }} />}
              <AnimatePresence initial={false} mode="sync">
                {renderedQueueItems.map((item, localIndex) => {
                  const rowIndex = queueStartIndex + localIndex
                  const txn = item.txn
                  const disabled = savingId === txn.id
                  return (
                    <motion.div
                      key={txn.id}
                      ref={(node) => measureQueueRow(rowIndex, node)}
                      id={`recon-item-${txn.id}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8, scale: 0.99 }}
                      whileHover={{ y: -1 }}
                      transition={{ duration: 0.2 }}
                      className={`card p-4 ${highlightedTxnId === txn.id ? 'txn-focus-highlight' : ''}`}
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

                      {item.flags.missingCategory && txn.type === 'expense' && (
                        <div className="mt-3 pt-3 border-t border-kosha-border">
                          <label className="text-[11px] font-semibold text-ink-3 block mb-1.5">
                            Set category
                          </label>
                          <select
                            name="recon-category"
                            className="input h-9 text-sm w-full md:max-w-[240px]"
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
                            <option value="">Choose category…</option>
                            {EXPENSE_CATEGORIES.map((cat) => (
                              <option key={cat.id} value={cat.id}>{cat.label}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-end gap-2 mt-3">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={disabled}
                          onClick={() => { void markReviewed(txn.id) }}
                        >
                          Mark reviewed
                        </Button>
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
              {queueBottomPadding > 0 && <div aria-hidden="true" style={{ height: `${queueBottomPadding}px` }} />}
            </motion.div>
          )}
        </>
      )}

      {/* ── TAB: Matching ──────────────────────────────────── */}
      {tab === 'matching' && (
        <div className="space-y-3.5">
          <div className="card p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-sm font-semibold text-ink">Match bank statements</p>
                <p className="text-caption text-ink-3 mt-1">
                  Paste rows in date, description, amount format.
                </p>
                <p className="text-[11px] text-ink-4 mt-1">
                  Learned aliases: {learnedAliasCount}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={<RotateCcw size={13} />}
                  loading={resettingAliases}
                  onClick={() => { void resetLearnedAliases() }}
                  disabled={learnedAliasCount === 0 || resettingAliases || reviewTableUnavailable}
                >
                  {resettingAliases ? 'Resetting' : 'Reset'}
                </Button>
                <div className="w-9 h-9 rounded-full bg-ink/[0.06] text-ink flex items-center justify-center">
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
                    driftMessage.severity === 'warning' ? 'text-warning-text' : 'text-ink'
                  }`}
                />
                <div>
                  <p className={`text-[12px] font-semibold ${
                    driftMessage.severity === 'warning' ? 'text-warning-text' : 'text-ink'
                  }`}>
                    {driftMessage.title}
                  </p>
                  <p className="text-[11px] text-ink-3 mt-0.5">{driftMessage.message}</p>
                </div>
              </motion.div>
            )}

            <textarea
              name="statement-input"
              value={statementInput}
              onChange={(e) => setStatementInput(e.target.value)}
              className="input min-h-[110px] text-sm"
              placeholder={[
                '24/03/2026, Swiggy, 542.00',
                '2026-03-22 | Uber | 318',
                '21-03-2026\tSalary\t50000',
              ].join('\n')}
            />

            {statementValidationMessage && (
              <div className="mt-3 rounded-card border border-warning-border bg-warning-bg px-3 py-2.5 flex items-start gap-2">
                <AlertCircle size={14} className="text-warning-text shrink-0 mt-0.5" />
                <p className="text-[11px] text-warning-text">{statementValidationMessage}</p>
              </div>
            )}

            {canUseStatementMatches && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
                <Metric label="Lines" value={statementSummary.total} compact />
                <Metric label="Parseable" value={statementSummary.valid} tone="text-ink" compact />
                <Metric label="Matched" value={statementSummary.matched} tone="text-income-text" compact />
                <Metric label="High conf." value={statementSummary.highConfidence} tone="text-income-text" compact />
              </div>
            )}

            {canUseStatementMatches && (
              <div className="space-y-2 mt-3">
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
          </div>

          {recentLinkDecisions.length > 0 && (
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-2.5">
                <History size={14} className="text-ink-4" />
                <p className="text-[12px] font-semibold text-ink-2">Recent matching decisions</p>
              </div>
              <div className="space-y-2">
                {recentLinkDecisions.map((row) => (
                  <div key={row.transactionId} className="mini-panel px-3 py-2.5">
                    <p className="text-[12px] text-ink-2 truncate">{row.statementPreview}</p>
                    <p className="text-[11px] text-ink-4 mt-0.5 truncate">
                      Linked to: {row.transactionLabel}
                      {row.amount != null ? ` · ${fmt(Number(row.amount || 0))}` : ''}
                      {row.date ? ` · ${fmtDate(row.date)}` : ''}
                    </p>
                    <button
                      type="button"
                      className="text-[11px] font-semibold text-accent-text mt-1 inline-flex items-center gap-1"
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
            <div className="card p-4">
              <p className="text-[12px] font-semibold text-ink-2 mb-2.5">Merchant recognition</p>
              
              {aliasQualities.length > 0 && (
                <div className="mb-3">
                  <p className="text-[11px] text-ink-3 mb-1.5">Top merchant matches (30-day)</p>
                  <div className="space-y-1">
                    {aliasQualities.slice(0, 3).map((alias) => (
                      <div key={alias.merchant} className="mini-panel px-2.5 py-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] text-ink-2 truncate">{alias.merchant}</p>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                            alias.qualityScore >= 90 ? 'bg-income-bg text-income-text'
                            : alias.qualityScore >= 70 ? 'bg-ink/[0.06] text-ink'
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
                  <p className="text-[11px] text-ink-3 mb-1.5">Skipped merchants (2+ mismatches)</p>
                  <div className="space-y-1">
                    {Array.from(demotedMerchants).slice(0, 3).map((merchant) => {
                      const inCooldown = merchantsInCooldown.has(merchant)
                      return (
                        <div key={merchant} className={`rounded-card border px-2.5 py-1.5 ${
                          inCooldown ? 'border-warning-border bg-warning-bg/10' : 'border-kosha-border bg-expense-bg/10'
                        }`}>
                          <p className={`text-[11px] truncate ${inCooldown ? 'text-warning-text' : 'text-expense-text'}`}>{merchant}</p>
                          <p className="text-[10px] text-ink-4 mt-0.5">
                            {inCooldown
                              ? 'Cooldown active — paused for 14 days.'
                              : 'Cooldown completed — can be learned again.'}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                  {demotedMerchants.size > 3 && (
                    <p className="text-[10px] text-ink-4 mt-1.5">+{demotedMerchants.size - 3} more</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Overview ──────────────────────────────────── */}
      {tab === 'overview' && (
        <Suspense
          fallback={(
            <SkeletonLayout
              className="space-y-3"
              sections={[
                { type: 'block', height: 'h-[140px]' },
                { type: 'block', height: 'h-[230px]' },
                { type: 'block', height: 'h-[230px]' },
              ]}
            />
          )}
        >
          <ReconciliationOverviewPanel
            reconciliationFunnel={reconciliationFunnel}
            linkedConversion={linkedConversion}
            turnaroundDistribution={turnaroundDistribution}
            statementSummary={statementSummary}
            learnedAliasCount={learnedAliasCount}
          />
        </Suspense>
      )}

      <AppToast message={toast} onDismiss={() => setToast(null)} />
    </PageBackHeaderPage>
  )
}

function Metric({ label, value, tone = 'text-ink', compact }) {
  return (
    <div className="mini-panel p-2.5">
      <p className="text-caption text-ink-3">{label}</p>
      <p className={`${compact ? 'text-[15px]' : 'text-lg'} font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  )
}

function StatementMatchRow({ row, onOpen, onLink, onReject, linkedIdSet }) {
  const best = row.best
  const entry = row.entry
  const isLinked = !!(best?.txn?.id && linkedIdSet?.has(best.txn.id))

  const borderColor = row.confidence === 'high' ? 'border-l-income-text' 
                     : row.confidence === 'medium' ? 'border-l-warning-text' 
                     : 'border-l-ink-3'

  return (
    <motion.div
      whileHover={{ y: -1 }}
      transition={{ duration: 0.14 }}
      className={`rounded-card border border-kosha-border border-l-4 ${borderColor} bg-kosha-surface p-3`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-ink-2 truncate">{entry.description || entry.line}</p>
          <p className="text-caption text-ink-3 mt-0.5">
            {entry.date || 'No date'} · {entry.amount != null ? fmt(entry.amount) : 'No amount'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={`text-[11px] px-2 py-1 rounded-full font-semibold whitespace-nowrap ${
            row.confidence === 'high'
              ? 'bg-income-bg text-income-text'
              : row.confidence === 'medium'
                ? 'bg-warning-bg text-warning-text'
                : 'bg-kosha-surface-2 text-ink-3'
          }`}>
            {row.confidence}
          </span>
          {isLinked && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-income-bg text-income-text font-semibold">
              ✓ Linked
            </span>
          )}
        </div>
      </div>

      {!entry.isValid ? (
        <div className="mt-2">
          <p className="text-caption text-expense-text">Could not parse this line.</p>
          <details className="text-caption text-ink-3 mt-1">
            <summary className="cursor-pointer font-semibold">Formatting tips</summary>
            <ul className="list-disc list-inside text-[11px] mt-1 space-y-0.5">
              <li>Include a date (e.g., 24/03/2026 or 2026-03-24)</li>
              <li>Include an amount (e.g., 542.00 or 542)</li>
              <li>Separate fields with comma, pipe, or tab</li>
              <li>Examples: &quot;24/03, Swiggy, 542&quot; or &quot;2026-03-24 | Uber | 318&quot;</li>
            </ul>
          </details>
        </div>
      ) : !best ? (
        <p className="text-caption text-ink-3 mt-2">No candidate found in current transactions.</p>
      ) : (
        <div className={`mt-2 rounded-card border p-2.5 ${
          isLinked ? 'border-income-text/30 bg-income-bg/5' : 'border-kosha-border bg-kosha-surface'
        }`}>
          <p className="text-caption text-ink-3">
            Best: {best.txn.description || 'No description'} · {fmt(best.txn.amount)} · {fmtDate(best.txn.date)}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => onOpen(best.txn.id)}
              iconRight={<ArrowRight size={12} />}
            >
              Open
            </Button>
            <Button
              type="button"
              onClick={() => { if (best?.txn?.id) void onLink(best.txn.id, entry.line) }}
              variant="secondary"
              size="xs"
            >
              {isLinked ? 'Linked' : 'Mark linked'}
            </Button>
            {!isLinked && (
              <Button
                type="button"
                onClick={() => { if (best?.txn?.id) void onReject(best.txn.id, entry.line) }}
                variant="ghost"
                size="xs"
                className="text-expense-text hover:bg-expense-bg"
              >
                Report mismatch
              </Button>
            )}
          </div>
        </div>
      )}
    </motion.div>
  )
}