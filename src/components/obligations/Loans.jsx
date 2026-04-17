import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, X, Check, Loader2, Download, ArrowDownLeft, ArrowUpRight,
  HandCoins, Users, Percent, Calendar, CalendarDays, FileText, Pencil,
} from 'lucide-react'
import {
  useLoans,
  addLoanMutation,
  updateLoanMutation,
  recordLoanPaymentMutation,
  deleteLoanMutation,
  accruedInterest,
  loanProgress,
} from '../../hooks/useLoans'
import { supabase } from '../../lib/supabase'
import { getAuthUserId } from '../../lib/authStore'
import { downloadCsv, toCsv } from '../../lib/csv'
import { fmt, fmtDate, daysUntil, dueLabel, dueChipClass } from '../../lib/utils'
import { bandTextClass, scoreRiskBand } from '../../lib/insightBands'
import { FINANCIAL_EVENT_ACTIONS } from '../../lib/auditLog'
import PageHeaderPage from '../layout/PageHeaderPage'
import SkeletonLayout from '../common/SkeletonLayout'
import EmptyState from '../common/EmptyState'
import AppToast from '../common/AppToast'
import Button from '../ui/Button'
import PixelDatePicker from '../ui/PixelDatePicker'
import useOverlayFocusTrap from '../../hooks/useOverlayFocusTrap'
import useWindowedList from '../../hooks/useWindowedList'
import { useSearchParams } from 'react-router-dom'

const LOAN_COLUMNS_EXPORT =
  'id, direction, counterparty, amount, amount_settled, interest_rate, loan_date, due_date, note, settled'
const DEEP_LINK_MAX_ATTEMPTS = 8
const DEEP_LINK_RETRY_MS = 350

export default function Loans({
  embedded = false,
  showAddExternal,
  onShowAddChange,
} = {}) {
  const { given, taken, settled, loading, settledLoading } = useLoans()
  const [searchParams, setSearchParams] = useSearchParams()
  const deepLinkTxnId = searchParams.get('repaymentTxn')
  const deepLinkLoanId = searchParams.get('repaymentLoan')
  const deepLinkType = searchParams.get('repaymentType')
  const deepLinkTabHint = searchParams.get('repaymentTab')
  const deepLinkAmountRaw = searchParams.get('repaymentAmount')
  const deepLinkDate = searchParams.get('repaymentDate')
  const deepLinkCounterpartyRaw = searchParams.get('repaymentCounterparty')

  const inferredInitialTab =
    deepLinkTabHint === 'given' || deepLinkTabHint === 'taken' || deepLinkTabHint === 'settled'
      ? deepLinkTabHint
      : deepLinkType === 'expense'
        ? 'taken'
        : 'given'

  const [tab, setTab] = useState(inferredInitialTab)
  const [showAddInternal, setShowAddInternal] = useState(false)
  const showAdd = showAddExternal !== undefined ? showAddExternal : showAddInternal
  const setShowAdd = onShowAddChange || setShowAddInternal

  const [editLoan, setEditLoan] = useState(null)
  const [payLoan, setPayLoan] = useState(null)      // loan object being paid
  const [deletingId, setDeletingId] = useState(null)
  const [errToast, setErrToast] = useState(null)
  const [highlightLoanId, setHighlightLoanId] = useState(null)
  const [hiddenIds, setHiddenIds] = useState(() => new Set())
  const [deepLinkRetryTick, setDeepLinkRetryTick] = useState(0)
  const deepLinkResolvedRef = useRef('')
  const deepLinkAttemptRef = useRef({ key: '', count: 0 })

  const deepLinkKey = `${deepLinkTxnId || ''}:${deepLinkLoanId || ''}:${deepLinkTabHint || ''}:${deepLinkType || ''}:${deepLinkAmountRaw || ''}:${deepLinkDate || ''}:${deepLinkCounterpartyRaw || ''}`

  const clearRepaymentDeepLink = useCallback(() => {
    const next = new URLSearchParams(searchParams)
      ;['repaymentTxn', 'repaymentLoan', 'repaymentTab', 'repaymentType', 'repaymentAmount', 'repaymentDate', 'repaymentCounterparty'].forEach((key) => {
        next.delete(key)
      })
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  // ── Form state ──────────────────────────────────────────────────────
  const [form, setForm] = useState({
    direction: 'given', counterparty: '', amount: '', interest_rate: '',
    loan_date: new Date().toISOString().slice(0, 10), due_date: '', note: '',
  })
  const [formErr, setFormErr] = useState('')
  const [addSaving, setAddSaving] = useState(false)

  // ── Payment form state ──────────────────────────────────────────────
  const [payAmount, setPayAmount] = useState('')
  const [payErr, setPayErr] = useState('')
  const [paySaving, setPaySaving] = useState(false)

  const closePaySheet = useCallback(() => {
    setPayLoan(null)
    setPayAmount('')
    setPayErr('')
  }, [])

  const dismissPaySheet = useCallback(() => {
    if (paySaving) return
    closePaySheet()
  }, [paySaving, closePaySheet])

  // ── Derived data ────────────────────────────────────────────────────
  const visibleGiven = useMemo(() => given.filter(l => !hiddenIds.has(l.id)), [given, hiddenIds])
  const visibleTaken = useMemo(() => taken.filter(l => !hiddenIds.has(l.id)), [taken, hiddenIds])
  const visibleSettled = useMemo(() => settled.filter(l => !hiddenIds.has(l.id)), [settled, hiddenIds])

  const activeLoans = tab === 'given' ? visibleGiven : tab === 'taken' ? visibleTaken : visibleSettled

  const {
    containerRef: loanListRef,
    startIndex: loanStartIndex,
    endIndex: loanEndIndex,
    topPadding: loanTopPadding,
    bottomPadding: loanBottomPadding,
    measureElement: measureLoanRow,
    scrollToIndex: scrollLoanToIndex,
  } = useWindowedList({
    count: activeLoans.length,
    estimateSize: 186,
    overscan: 6,
    enabled: activeLoans.length > 16,
    resetKey: `${tab}:${activeLoans.length}`,
    initialCount: 20,
  })

  const renderedLoans = useMemo(
    () => activeLoans.slice(loanStartIndex, loanEndIndex),
    [activeLoans, loanStartIndex, loanEndIndex]
  )

  useEffect(() => {
    if (!deepLinkTxnId && !deepLinkLoanId) {
      deepLinkResolvedRef.current = ''
      deepLinkAttemptRef.current = { key: '', count: 0 }
      return
    }

    if (loading || settledLoading) return
    if (deepLinkResolvedRef.current === deepLinkKey) return

    if (deepLinkAttemptRef.current.key !== deepLinkKey) {
      deepLinkAttemptRef.current = { key: deepLinkKey, count: 0 }
    }
    deepLinkAttemptRef.current.count += 1

    const currentAttempt = deepLinkAttemptRef.current.count
    let cancelled = false
    let retryTimer = null

    const allLoans = [...given, ...taken, ...settled]
    const normalizedCounterparty = String(deepLinkCounterpartyRaw || '').trim().toLowerCase()
    const inferredDirection = deepLinkType === 'income' ? 'given' : deepLinkType === 'expense' ? 'taken' : null
    const deepLinkAmount = Number(deepLinkAmountRaw)
    const hasAmount = Number.isFinite(deepLinkAmount) && deepLinkAmount > 0

    const fallbackLoanMatch = () => {
      if (!allLoans.length) return null

      const scored = allLoans
        .map((loan) => {
          let score = 0
          const counterparty = String(loan?.counterparty || '').trim().toLowerCase()

          if (inferredDirection && loan?.direction === inferredDirection) score += 50

          if (normalizedCounterparty) {
            if (counterparty === normalizedCounterparty) score += 90
            else if (counterparty.includes(normalizedCounterparty) || normalizedCounterparty.includes(counterparty)) score += 40
          }

          if (hasAmount) {
            const principal = Number(loan?.amount || 0)
            const settledAmt = Number(loan?.amount_settled || 0)
            const remaining = Math.max(0, principal - settledAmt)

            if (deepLinkAmount <= principal + 0.01) score += 10
            if (deepLinkAmount <= settledAmt + 0.01) score += 8
            if (!loan?.settled && deepLinkAmount <= remaining + 0.01) score += 8
          }

          if (deepLinkDate && loan?.loan_date && loan.loan_date <= deepLinkDate) score += 4

          return { loan, score }
        })
        .sort((a, b) => b.score - a.score)

      const top = scored[0]
      const second = scored[1]
      if (!top) return null

      const minScore = normalizedCounterparty
        ? 70
        : hasAmount
          ? 65
          : Number.POSITIVE_INFINITY

      const hasClearLead = !second || (top.score - second.score) >= 20
      return top.score >= minScore && hasClearLead ? top.loan : null
    }

    const resolveDeepLink = async () => {
      let targetLoan = null

      const normalizeId = (value) => (value == null ? '' : String(value).trim())
      const normalizedTxnId = normalizeId(deepLinkTxnId)

      if (deepLinkLoanId) {
        targetLoan = allLoans.find((loan) => normalizeId(loan.id) === normalizeId(deepLinkLoanId)) || null
      }

      // Fast-path local resolution first to avoid network-induced focus lag.
      if (!targetLoan) {
        targetLoan = fallbackLoanMatch()
      }

      if (!targetLoan && deepLinkTxnId) {
        try {
          const userId = getAuthUserId()
          let eventQuery = supabase
            .from('financial_events')
            .select('entity_id, metadata, created_at')
            .eq('action', FINANCIAL_EVENT_ACTIONS.LOAN_PAYMENT)
            .order('created_at', { ascending: false })
            .limit(180)

          if (userId) {
            eventQuery = eventQuery.eq('user_id', userId)
          }

          const { data: eventRows } = await eventQuery
          const matchedEvent = (eventRows || []).find((row) => {
            const metadata = row?.metadata || {}
            const candidateTxnIds = [
              metadata?.rpc_result?.transaction_id,
              metadata?.transaction_id,
              metadata?.rpc_payload?.transaction_id,
              metadata?.rpc_payload?.p_transaction_id,
            ]

            return candidateTxnIds.some((candidate) => normalizeId(candidate) === normalizedTxnId)
          })

          const loanIdFromEvent =
            matchedEvent?.entity_id ||
            matchedEvent?.metadata?.rpc_result?.loan_id ||
            matchedEvent?.metadata?.loan_id ||
            matchedEvent?.metadata?.rpc_payload?.loan_id ||
            matchedEvent?.metadata?.rpc_payload?.p_loan_id ||
            null

          if (loanIdFromEvent) {
            targetLoan = allLoans.find((loan) => normalizeId(loan.id) === normalizeId(loanIdFromEvent)) || null
          }
        } catch {
          // Fall back to heuristic matching below.
        }
      }

      if (!targetLoan) {
        if (!cancelled) {
          if (currentAttempt < DEEP_LINK_MAX_ATTEMPTS) {
            retryTimer = window.setTimeout(() => {
              if (!cancelled) {
                setDeepLinkRetryTick((v) => v + 1)
              }
            }, DEEP_LINK_RETRY_MS)
            return
          }

          setErrToast('Opened Loans, but could not pinpoint the linked repayment.')
          deepLinkResolvedRef.current = deepLinkKey
          clearRepaymentDeepLink()
        }
        return
      }

      if (cancelled) return

      const targetTab = targetLoan.settled
        ? 'settled'
        : targetLoan.direction === 'taken'
          ? 'taken'
          : 'given'

      setTab(targetTab)
      setHiddenIds((prev) => {
        if (!prev.has(targetLoan.id)) return prev
        const next = new Set(prev)
        next.delete(targetLoan.id)
        return next
      })
      setHighlightLoanId(targetLoan.id)

      setErrToast('Opened linked repayment context.')
      deepLinkResolvedRef.current = deepLinkKey
      clearRepaymentDeepLink()

      window.setTimeout(() => {
        setHighlightLoanId((prev) => (prev === targetLoan.id ? null : prev))
      }, 2600)
    }

    void resolveDeepLink()

    return () => {
      cancelled = true
      if (retryTimer) {
        window.clearTimeout(retryTimer)
      }
    }
  }, [
    deepLinkTxnId,
    deepLinkLoanId,
    deepLinkType,
    deepLinkAmountRaw,
    deepLinkDate,
    deepLinkCounterpartyRaw,
    deepLinkKey,
    loading,
    settledLoading,
    given,
    taken,
    settled,
    deepLinkRetryTick,
    clearRepaymentDeepLink,
  ])

  useEffect(() => {
    if (!highlightLoanId) return

    const index = activeLoans.findIndex((loan) => loan.id === highlightLoanId)
    if (index < 0) return

    scrollLoanToIndex(index, { behavior: 'smooth', block: 'center' })
    const timerId = window.setTimeout(() => {
      const el = document.getElementById(`loan-${highlightLoanId}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 70)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [highlightLoanId, activeLoans, scrollLoanToIndex])

  const totalGiven = useMemo(() => visibleGiven.reduce((s, l) => s + (+l.amount - +l.amount_settled), 0), [visibleGiven])
  const totalTaken = useMemo(() => visibleTaken.reduce((s, l) => s + (+l.amount - +l.amount_settled), 0), [visibleTaken])
  const netPosition = totalGiven - totalTaken

  const totalCount = visibleGiven.length + visibleTaken.length + visibleSettled.length

  const activeExposureLoans = useMemo(() => {
    return [...visibleGiven, ...visibleTaken]
      .map((loan) => ({
        ...loan,
        remaining: Math.max(0, Number(loan.amount || 0) - Number(loan.amount_settled || 0)),
      }))
      .filter((loan) => loan.remaining > 0)
  }, [visibleGiven, visibleTaken])

  const exposureConcentrationSignal = useMemo(() => {
    if (!activeExposureLoans.length) return null

    const byCounterparty = new Map()
    let totalRemaining = 0

    for (const loan of activeExposureLoans) {
      totalRemaining += loan.remaining
      const displayName = String(loan.counterparty || 'Unknown').trim() || 'Unknown'
      const key = displayName.toLowerCase()
      const existing = byCounterparty.get(key)

      if (!existing) {
        byCounterparty.set(key, {
          name: displayName,
          remaining: loan.remaining,
        })
      } else {
        existing.remaining += loan.remaining
      }
    }

    const rows = [...byCounterparty.values()].sort((a, b) => b.remaining - a.remaining)
    const top = rows[0]
    const topSharePct = totalRemaining > 0 ? Math.round((top.remaining / totalRemaining) * 100) : 0
    const tone = scoreRiskBand(topSharePct, { high: 55, watch: 35 })

    return {
      top,
      topSharePct,
      counterparties: rows.length,
      totalRemaining,
      tone,
    }
  }, [activeExposureLoans])

  const dueRiskSignal = useMemo(() => {
    const riskyLoans = activeExposureLoans
      .map((loan) => {
        if (!loan.due_date) return null
        const days = daysUntil(loan.due_date)
        if (!Number.isFinite(days)) return null

        const progressPct = loanProgress(loan.amount, loan.amount_settled)
        const atRisk = days < 0 || (days <= 14 && progressPct < 50)
        if (!atRisk) return null

        return {
          ...loan,
          days,
          progressPct,
        }
      })
      .filter(Boolean)

    const overdueCount = riskyLoans.filter((loan) => loan.days < 0).length
    const amountAtRisk = riskyLoans.reduce((sum, loan) => sum + loan.remaining, 0)
    const riskScore = (overdueCount * 2) + Math.max(0, riskyLoans.length - overdueCount)
    const tone = scoreRiskBand(riskScore, { high: 2, watch: 1 })

    return {
      count: riskyLoans.length,
      overdueCount,
      amountAtRisk,
      tone,
    }
  }, [activeExposureLoans])

  const settlementVelocitySignal = useMemo(() => {
    if (!activeExposureLoans.length) return null

    const totalPrincipal = activeExposureLoans.reduce((sum, loan) => sum + Number(loan.amount || 0), 0)
    const totalSettled = activeExposureLoans.reduce((sum, loan) => sum + Number(loan.amount_settled || 0), 0)
    const settlementPct = totalPrincipal > 0 ? Math.round((totalSettled / totalPrincipal) * 100) : 0

    const accruedTotal = activeExposureLoans.reduce(
      (sum, loan) => sum + Number(accruedInterest(loan.amount, loan.interest_rate, loan.loan_date) || 0),
      0
    )

    const accrualLoadPct = totalSettled > 0 ? Math.round((accruedTotal / totalSettled) * 100) : null
    const tone = scoreRiskBand(accrualLoadPct ?? 0, { high: 22, watch: 8 })

    return {
      settlementPct,
      accruedTotal,
      accrualLoadPct,
      tone,
    }
  }, [activeExposureLoans])

  // ── Handlers ────────────────────────────────────────────────────────

  const resetForm = useCallback(() => {
    setForm({
      direction: 'given', counterparty: '', amount: '', interest_rate: '',
      loan_date: new Date().toISOString().slice(0, 10), due_date: '', note: '',
    })
    setFormErr('')
  }, [])

  const closeAddLoanSheet = useCallback(() => {
    setShowAdd(false)
    setEditLoan(null)
    resetForm()
  }, [resetForm])

  const dismissAddLoanSheet = useCallback(() => {
    if (addSaving) return
    closeAddLoanSheet()
  }, [addSaving, closeAddLoanSheet])

  async function handleAdd() {
    if (!form.counterparty.trim()) { setFormErr('Enter a name'); return }
    if (!form.amount || !Number.isFinite(+form.amount) || +form.amount <= 0) { setFormErr('Enter a valid positive amount'); return }
    if (!form.loan_date) { setFormErr('Select a loan date'); return }

    const loanData = {
      direction: form.direction,
      counterparty: form.counterparty.trim(),
      amount: +form.amount,
      interest_rate: form.interest_rate ? +form.interest_rate : 0,
      loan_date: form.loan_date,
      due_date: form.due_date || null,
      note: form.note.trim() || null,
    }

    setFormErr('')
    setAddSaving(true)

    if (editLoan) {
      try {
        await updateLoanMutation(editLoan.id, loanData)
        setTab(loanData.direction)
        setAddSaving(false)
        closeAddLoanSheet()
      } catch (e) {
        setAddSaving(false)
        setErrToast(e.message || 'Could not update loan.')
      }
      return
    }

    try {
      await addLoanMutation({ ...loanData, amount_settled: 0, settled: false })
      setTab(loanData.direction)
      setAddSaving(false)
      closeAddLoanSheet()
    } catch (e) {
      setAddSaving(false)
      setErrToast(e.message || 'Could not add loan.')
    }
  }

  async function handleRecordPayment() {
    if (!payLoan) return
    const amt = +payAmount
    const remaining = +payLoan.amount - +payLoan.amount_settled
    if (remaining <= 0) { setPayErr('This loan is already fully settled.'); return }
    if (!Number.isFinite(amt) || amt <= 0) { setPayErr('Enter a valid positive amount'); return }
    if (amt > remaining) { setPayErr(`Max payment is ${fmt(remaining)}`); return }

    setPayErr('')
    setPaySaving(true)

    try {
      await recordLoanPaymentMutation(payLoan, amt)
      setPaySaving(false)
      closePaySheet()
    } catch (e) {
      setPaySaving(false)
      setErrToast(e.message || 'Could not record payment.')
    }
  }

  const handleSettleFull = useCallback(async (loan) => {
    const remaining = +loan.amount - +loan.amount_settled
    if (remaining <= 0) return

    try {
      await recordLoanPaymentMutation(loan, remaining)
    } catch (e) {
      setErrToast(e.message || 'Could not settle loan.')
    }
  }, [])

  async function handleDelete(id) {
    if (!id || deletingId) return
    setDeletingId(id)
    setHiddenIds(prev => { const n = new Set(prev); n.add(id); return n })

    try {
      await deleteLoanMutation(id)
    } catch (e) {
      setHiddenIds(prev => { const n = new Set(prev); n.delete(id); return n })
      setErrToast(e.message || 'Could not delete loan.')
    } finally {
      setDeletingId(null)
    }
  }

  function openEditLoan(loan) {
    setEditLoan(loan)
    setForm({
      direction: loan.direction || 'given',
      counterparty: loan.counterparty || '',
      amount: String(loan.amount || ''),
      interest_rate: loan.interest_rate ? String(loan.interest_rate) : '',
      loan_date: loan.loan_date || new Date().toISOString().slice(0, 10),
      due_date: loan.due_date || '',
      note: loan.note || '',
    })
    setFormErr('')
    setShowAdd(true)
  }

  const paySheetRef = useOverlayFocusTrap(!!payLoan, {
    onClose: dismissPaySheet,
    initialFocusSelector: 'input[name="payment-amount"]',
  })

  const addLoanSheetRef = useOverlayFocusTrap(showAdd, {
    onClose: dismissAddLoanSheet,
    initialFocusSelector: 'input[name="loan-counterparty"]',
  })

  async function handleExportCsv() {
    try {
      const userId = getAuthUserId()
      const { data: rows, error } = await supabase
        .from('loans')
        .select(LOAN_COLUMNS_EXPORT)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      if (!rows?.length) {
        setErrToast('No loans to export.')
        setTimeout(() => setErrToast(null), 4000)
        return
      }

      const headers = ['Direction', 'Counterparty', 'Amount', 'Settled Amount', 'Interest %', 'Loan Date', 'Due Date', 'Note', 'Settled']
      const csvRows = rows.map(r => [
        r.direction, r.counterparty, r.amount, r.amount_settled,
        r.interest_rate, r.loan_date || '', r.due_date || '', r.note || '',
        r.settled ? 'yes' : 'no',
      ])
      const csv = toCsv(headers, csvRows)
      const date = new Date().toISOString().slice(0, 10)
      downloadCsv(`kosha-loans-${date}.csv`, csv)
    } catch (e) {
      setErrToast(e.message || 'Could not export CSV.')
      setTimeout(() => setErrToast(null), 4000)
    }
  }

  return (
    <PageHeaderPage
      title="Loans"
      showHeader={!embedded}
      withHeaderOffset={!embedded}
      pageClassName={embedded ? 'pb-5' : 'page'}
    >

      {/* ── Subheader ─────────────────────────────────────────────────── */}
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <p className="text-caption text-ink-3 mt-0.5">
          {totalCount} loan{totalCount !== 1 ? 's' : ''} · {visibleGiven.length + visibleTaken.length} active
        </p>
        <div className="flex items-center gap-2">
          {totalCount > 0 && (
            <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={handleExportCsv}>
              Export CSV
            </Button>
          )}
          {embedded && (
            <Button
              variant="primary"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => setShowAdd(true)}
            >
              Add
            </Button>
          )}
        </div>
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────── */}
      <div className="mb-2.5 grid grid-cols-3 gap-2">
        {[
          { key: 'given', label: 'Given', count: visibleGiven.length, activeClass: 'bg-income-bg text-income-text border-income-border shadow-card' },
          { key: 'taken', label: 'Taken', count: visibleTaken.length, activeClass: 'bg-expense-bg text-expense-text border-expense-border shadow-card' },
          { key: 'settled', label: 'Settled', count: visibleSettled.length, activeClass: 'bg-repay-bg text-repay-text border-repay-border shadow-card' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`h-9 sm:h-10 w-full rounded-card text-[11px] sm:text-[12px] font-semibold transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] will-change-transform active:scale-[0.97]
              ${tab === t.key ? t.activeClass : 'bg-kosha-surface text-ink-3 border border-kosha-border'}`}
          >
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      <div className="space-y-3">

        {/* ── Summary card ──────────────────────────────────────────────── */}
        {(visibleGiven.length > 0 || visibleTaken.length > 0) && tab !== 'settled' && (
          <div className="card p-3.5 sm:p-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="mini-panel px-3 py-2.5">
                <p className="text-caption text-ink-3 mb-1">You're owed</p>
                <p className="text-base font-semibold amt-income tabular-nums leading-none">{fmt(totalGiven)}</p>
                <p className="text-caption text-ink-3 mt-1">{visibleGiven.length} loan{visibleGiven.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="mini-panel px-3 py-2.5">
                <p className="text-caption text-ink-3 mb-1">You owe</p>
                <p className="text-base font-semibold amt-expense tabular-nums leading-none">{fmt(totalTaken)}</p>
                <p className="text-caption text-ink-3 mt-1">{visibleTaken.length} loan{visibleTaken.length !== 1 ? 's' : ''}</p>
              </div>
            </div>

            <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {exposureConcentrationSignal && (
                <div className="mini-panel p-3.5">
                  <p className="text-[10px] text-ink-3 tracking-wide">Exposure concentration</p>
                  <p className={`text-label font-semibold mt-1 ${bandTextClass(exposureConcentrationSignal.tone)}`}>
                    {exposureConcentrationSignal.topSharePct}%
                  </p>
                  <p className="text-caption text-ink-2 mt-1 truncate" title={exposureConcentrationSignal.top.name}>
                    {exposureConcentrationSignal.top.name}
                  </p>
                  <p className="text-[10px] text-ink-3 mt-1 tabular-nums">
                    {exposureConcentrationSignal.counterparties} counterparties · {fmt(exposureConcentrationSignal.totalRemaining)}
                  </p>
                </div>
              )}

              {dueRiskSignal && (
                <div className="mini-panel p-3.5">
                  <p className="text-[10px] text-ink-3 tracking-wide">At-risk due loans</p>
                  <p className={`text-label font-semibold mt-1 ${bandTextClass(dueRiskSignal.tone)}`}>
                    {dueRiskSignal.count} flagged
                  </p>
                  <p className="text-caption text-ink-2 mt-1 tabular-nums">
                    {fmt(dueRiskSignal.amountAtRisk)} at risk
                  </p>
                  <p className="text-[10px] text-ink-3 mt-1 tabular-nums">
                    {dueRiskSignal.overdueCount} overdue · {Math.max(0, dueRiskSignal.count - dueRiskSignal.overdueCount)} near due
                  </p>
                </div>
              )}

              {settlementVelocitySignal && (
                <div className="mini-panel p-3.5">
                  <p className="text-[10px] text-ink-3 tracking-wide">Settlement velocity</p>
                  <p className="text-label font-semibold text-ink mt-1 tabular-nums">
                    {settlementVelocitySignal.settlementPct}% settled
                  </p>
                  <p className="text-caption text-ink-2 mt-1 tabular-nums">
                    Accrued interest {fmt(settlementVelocitySignal.accruedTotal)}
                  </p>
                  <p className={`text-[10px] mt-1 tabular-nums ${bandTextClass(settlementVelocitySignal.tone, 'text-ink-3')}`}>
                    {settlementVelocitySignal.accrualLoadPct == null
                      ? 'Accrual load builds once settlements begin'
                      : `Accrual load ${settlementVelocitySignal.accrualLoadPct}% of settled value`}
                  </p>
                </div>
              )}
            </div>

            <div className="mt-3 mini-panel px-3 py-2.5">
              <div className="flex items-center justify-between">
                <p className="text-caption text-ink-3">Net position</p>
                <p className={`text-base font-semibold tabular-nums leading-none ${netPosition >= 0 ? 'amt-income' : 'amt-expense'}`}>
                  {netPosition >= 0 ? '+' : ''}{fmt(netPosition)}
                </p>
              </div>
              <p className="text-caption text-ink-3 mt-0.5">
                {netPosition > 0 ? 'In your favor' : netPosition < 0 ? 'You owe more' : 'Balanced'}
              </p>
            </div>
          </div>
        )}

        {/* ── Loading / Empty states ────────────────────────────────────── */}
        {loading && activeLoans.length === 0 ? (
          <SkeletonLayout
            className="space-y-3"
            sections={[
              { type: 'block', height: 'h-[120px]' },
              { type: 'block', height: 'h-[100px]' },
              { type: 'block', height: 'h-[100px]' },
            ]}
          />
        ) : (
          <div className="space-y-3">
            {tab !== 'settled' && activeLoans.length === 0 && (
              <EmptyState
                className="py-8"
                imageUrl="/illustrations/empty_loans.png"
                title={tab === 'given' ? 'No loans given' : 'No loans taken'}
                description={tab === 'given'
                  ? 'Track money you\u2019ve lent to friends, family, or others.'
                  : 'Track money you\u2019ve borrowed from others.'}
                actionLabel="Add a loan"
                onAction={() => { setForm(f => ({ ...f, direction: tab })); setShowAdd(true) }}
              />
            )}

            {tab === 'settled' && settledLoading && visibleSettled.length === 0 && (
              <div className="card p-4">
                <p className="section-label">Settled loans</p>
                <p className="text-[12px] text-ink-3 mt-1">Loading history…</p>
              </div>
            )}

            {tab === 'settled' && !settledLoading && visibleSettled.length === 0 && (
              <EmptyState
                className="py-8"
                imageUrl="/illustrations/settled_loans.png"
                title="No settled loans"
                description="Loans you fully repay will show up here."
                actionLabel="View active"
                onAction={() => setTab('given')}
              />
            )}

            {/* ── Loan cards ───────────────────────────────────────────── */}
            <div ref={loanListRef} className="space-y-2.5">
              {loanTopPadding > 0 && <div aria-hidden="true" style={{ height: `${loanTopPadding}px` }} />}
              {renderedLoans.map((loan, localIndex) => {
                const rowIndex = loanStartIndex + localIndex
                const remaining = +loan.amount - +loan.amount_settled
                const pct = loanProgress(loan.amount, loan.amount_settled)
                const interest = accruedInterest(loan.amount, loan.interest_rate, loan.loan_date)
                const days = loan.due_date ? daysUntil(loan.due_date) : null
                const isOptimistic = loan.__optimistic || String(loan.id || '').startsWith('optimistic-')

                return (
                  <div
                    id={`loan-${loan.id}`}
                    key={loan.id}
                    ref={(node) => measureLoanRow(rowIndex, node)}
                    className={`card p-3 sm:p-3.5 ${highlightLoanId === loan.id ? 'txn-focus-highlight' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* Direction icon + counterparty */}
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0
                        ${loan.direction === 'given' ? 'bg-income-bg' : 'bg-expense-bg'}`}>
                            {loan.direction === 'given'
                              ? <ArrowUpRight size={14} className="text-income-text" />
                              : <ArrowDownLeft size={14} className="text-expense-text" />}
                          </div>
                          <p className="text-[13px] sm:text-sm font-semibold text-ink truncate">
                            {loan.counterparty}
                          </p>
                        </div>

                        {/* Amount */}
                        <p className={`text-[17px] sm:text-lg font-semibold mb-1 ${loan.direction === 'given' ? 'amt-income' : 'amt-expense'}`}>
                          {fmt(+loan.amount)}
                        </p>

                        {/* Interest if applicable */}
                        {interest > 0 && (
                          <p className="text-[11px] text-ink-3 mb-1">
                            +{fmt(Math.round(interest * 100) / 100)} interest ({loan.interest_rate}%/yr)
                          </p>
                        )}

                        {/* Progress bar (active loans only) */}
                        {!loan.settled && (
                          <div className="mb-2">
                            <div className="h-1.5 bg-kosha-border rounded-pill overflow-hidden mb-1">
                              <motion.div
                                className={`h-full rounded-pill ${loan.direction === 'given' ? 'bg-income-text' : 'bg-expense-text'}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.5, ease: [0.05, 0.7, 0.1, 1] }}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-ink-3">
                                {fmt(+loan.amount_settled)} / {fmt(+loan.amount)}
                              </span>
                              <span className={`text-[10px] font-semibold ${pct >= 100 ? 'text-income-text' : 'text-ink-3'}`}>
                                {pct}%
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Meta chips */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-pill bg-kosha-surface-2 text-ink-3 border border-kosha-border">
                            {loan.direction === 'given' ? 'Given' : 'Taken'} {fmtDate(loan.loan_date)}
                          </span>
                          {loan.due_date && !loan.settled && days !== null && (
                            <span className={`text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-pill ${dueChipClass(days)}`}>
                              {dueLabel(days)}
                            </span>
                          )}
                          {loan.settled && (
                            <span className="text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-pill bg-income-bg text-income-text border border-income-border">
                              Settled
                            </span>
                          )}
                          {loan.interest_rate > 0 && (
                            <span className="text-[10px] sm:text-[11px] text-ink-3">{loan.interest_rate}%/yr</span>
                          )}
                          {loan.interest_rate === 0 && !loan.settled && (
                            <span className="text-[10px] sm:text-[11px] text-ink-3">0% interest</span>
                          )}
                          {isOptimistic && (
                            <span className="text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-pill bg-warning-bg text-warning-text">
                              Syncing…
                            </span>
                          )}
                        </div>

                        {/* Note */}
                        {loan.note && (
                          <p className="text-[11px] text-ink-3 mt-1.5 truncate">{loan.note}</p>
                        )}
                      </div>

                      {/* Actions */}
                      {!loan.settled && (
                        <div className="flex flex-col gap-2 shrink-0">
                          <Button
                            onClick={() => openEditLoan(loan)}
                            disabled={!!deletingId || isOptimistic}
                            variant="secondary"
                            size="sm"
                            icon={<Pencil size={13} />}
                          >
                            Edit
                          </Button>
                          <Button
                            onClick={() => { setPayLoan(loan); setPayAmount(''); setPayErr('') }}
                            disabled={!!deletingId || isOptimistic}
                            variant="success"
                            size="sm"
                            icon={<HandCoins size={13} />}
                          >
                            Payment
                          </Button>
                          <Button
                            onClick={() => { void handleSettleFull(loan) }}
                            disabled={!!deletingId || isOptimistic || remaining <= 0}
                            variant="tonal"
                            size="sm"
                            icon={<Check size={13} />}
                            className="bg-warning-bg text-warning-text border border-warning-border hover:brightness-95"
                          >
                            Settle
                          </Button>
                          <Button
                            onClick={() => handleDelete(loan.id)}
                            disabled={!!deletingId || isOptimistic}
                            variant="danger"
                            size="sm"
                            icon={deletingId === loan.id ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                          >
                            {deletingId === loan.id ? 'Deleting…' : 'Delete'}
                          </Button>
                        </div>
                      )}

                      {loan.settled && (
                        <div className="flex flex-col gap-2 shrink-0">
                          <Button
                            onClick={() => handleDelete(loan.id)}
                            disabled={!!deletingId || isOptimistic}
                            variant="danger"
                            size="sm"
                            icon={deletingId === loan.id ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                          >
                            {deletingId === loan.id ? 'Deleting…' : 'Delete'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              {loanBottomPadding > 0 && <div aria-hidden="true" style={{ height: `${loanBottomPadding}px` }} />}
            </div>
          </div>
        )}

      </div>

      {/* ── Record Payment Sheet ──────────────────────────────────────── */}
      <AnimatePresence>
        {payLoan && (
          <>
            <motion.div className="sheet-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }}
              onClick={dismissPaySheet}
            />
            <motion.div
              ref={paySheetRef}
              className="sheet-panel"
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-label="Record payment"
              initial={{ y: '100%' }}
              animate={{ y: 0, transition: { type: 'spring', stiffness: 500, damping: 40 } }}
              exit={{ y: '100%', transition: { duration: 0.22 } }}
            >
              <div className="sheet-handle" />
              <div className="px-5 overflow-x-hidden">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-display font-bold text-ink">Record Payment</h2>
                  <button
                    type="button"
                    aria-label="Close record payment sheet"
                    onClick={dismissPaySheet}
                    className="close-btn"
                  >
                    <X size={16} className="text-ink-3" />
                  </button>
                </div>

                {/* Loan context */}
                <div className="mini-panel p-3 mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center
                      ${payLoan.direction === 'given' ? 'bg-income-bg' : 'bg-expense-bg'}`}>
                      {payLoan.direction === 'given'
                        ? <ArrowUpRight size={12} className="text-income-text" />
                        : <ArrowDownLeft size={12} className="text-expense-text" />}
                    </div>
                    <p className="text-[13px] font-semibold text-ink">{payLoan.counterparty}</p>
                  </div>
                  <div className="flex items-center gap-3 text-[12px] text-ink-3">
                    <span>Total: {fmt(+payLoan.amount)}</span>
                    <span>Paid: {fmt(+payLoan.amount_settled)}</span>
                    <span className="font-semibold text-ink">Remaining: {fmt(+payLoan.amount - +payLoan.amount_settled)}</span>
                  </div>
                </div>

                {/* Amount input */}
                <div className="bg-transparent px-1 py-2 mb-3 overflow-hidden
                                flex items-center gap-2 border-b-2 border-kosha-border
                                transition-[border-color] duration-200">
                  <span className="text-xl font-bold text-brand">₹</span>
                  <input className="flex-1 bg-transparent text-2xl font-bold text-ink outline-none min-w-0"
                    type="number" inputMode="decimal" name="payment-amount" placeholder="0"
                    value={payAmount}
                    max={Math.max(0, (+payLoan.amount - +payLoan.amount_settled) || 0)}
                    onChange={e => setPayAmount(e.target.value)}
                    autoFocus
                  />
                </div>

                <p className="text-[11px] text-ink-3 mb-2">
                  Maximum you can record now: {fmt(+payLoan.amount - +payLoan.amount_settled)}
                </p>

                {/* Quick fill buttons */}
                <div className="flex gap-2 mb-3 flex-wrap">
                  {(() => {
                    const remaining = +payLoan.amount - +payLoan.amount_settled
                    const options = [
                      { label: 'Full', value: remaining },
                      remaining >= 2 ? { label: 'Half', value: Math.round(remaining / 2) } : null,
                    ].filter(Boolean)
                    return options.map(o => (
                      <button key={o.label}
                        type="button"
                        onClick={() => setPayAmount(String(o.value))}
                        className="px-3 py-1.5 rounded-pill text-xs font-semibold border
                                   bg-kosha-surface text-ink-2 border-kosha-border
                                   active:scale-[0.97] transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] will-change-transform"
                      >
                        {o.label} ({fmt(o.value)})
                      </button>
                    ))
                  })()}
                </div>

                {payErr && (
                  <p className="text-expense-text text-sm mb-3" role="alert" aria-live="polite">
                    {payErr}
                  </p>
                )}

                <div className="sticky bottom-0 pt-2 pb-2 bg-gradient-to-t from-kosha-surface via-kosha-surface to-transparent">
                  <Button
                    variant="primary"
                    size="xl"
                    fullWidth
                    onClick={handleRecordPayment}
                    loading={paySaving}
                  >
                    {paySaving ? 'Recording…' : 'Record Payment'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Add Loan Sheet ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAdd && (
          <>
            <motion.div className="sheet-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }}
              onClick={dismissAddLoanSheet}
            />
            <motion.div
              ref={addLoanSheetRef}
              className="sheet-panel"
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-label={editLoan ? 'Edit loan' : 'Add loan'}
              initial={{ y: '100%' }}
              animate={{ y: 0, transition: { type: 'spring', stiffness: 500, damping: 40 } }}
              exit={{ y: '100%', transition: { duration: 0.22 } }}
            >
              <div className="sheet-handle" />
              <div className="px-5 overflow-x-hidden">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-display font-bold text-ink">{editLoan ? 'Edit Loan' : 'Add Loan'}</h2>
                  <button
                    type="button"
                    aria-label="Close add loan sheet"
                    onClick={dismissAddLoanSheet}
                    className="close-btn"
                  >
                    <X size={16} className="text-ink-3" />
                  </button>
                </div>

                {/* Direction toggle */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, direction: 'given' }))}
                    className={`h-11 flex items-center justify-center gap-2 rounded-card text-[13px] font-semibold border transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] will-change-transform active:scale-[0.97]
                      ${form.direction === 'given'
                        ? 'bg-income-bg text-income-text border-income-border'
                        : 'bg-kosha-surface text-ink-3 border-kosha-border'}`}
                  >
                    <ArrowUpRight size={16} /> I Gave
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, direction: 'taken' }))}
                    className={`h-11 flex items-center justify-center gap-2 rounded-card text-[13px] font-semibold border transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] will-change-transform active:scale-[0.97]
                      ${form.direction === 'taken'
                        ? 'bg-expense-bg text-expense-text border-expense-border'
                        : 'bg-kosha-surface text-ink-3 border-kosha-border'}`}
                  >
                    <ArrowDownLeft size={16} /> I Took
                  </button>
                </div>

                {/* Counterparty */}
                <div className="list-card mb-3">
                  <label className="list-row w-full cursor-pointer">
                    <div className="w-8 h-8 rounded-chip bg-kosha-surface-2 flex items-center justify-center shrink-0 border border-kosha-border">
                      <Users size={14} className="text-ink-3" />
                    </div>
                    <input className="flex-1 bg-transparent text-[15px] text-ink outline-none min-w-0"
                      name="loan-counterparty"
                      placeholder={form.direction === 'given' ? 'Who did you lend to?' : 'Who did you borrow from?'}
                      value={form.counterparty}
                      onChange={e => setForm(f => ({ ...f, counterparty: e.target.value }))}
                    />
                  </label>
                </div>

                {/* Amount */}
                <div className="bg-transparent px-1 py-2 mb-3 overflow-hidden
                                flex items-center gap-2 border-b-2 border-kosha-border
                                transition-[border-color] duration-200">
                  <span className="text-xl font-bold text-brand">₹</span>
                  <input className="flex-1 bg-transparent text-2xl font-bold text-ink outline-none min-w-0"
                    type="number" inputMode="decimal" name="loan-amount" placeholder="0"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  />
                </div>

                {/* Interest rate */}
                <div className="list-card mb-3">
                  <label className="list-row w-full cursor-pointer">
                    <div className="w-8 h-8 rounded-chip bg-warning-bg flex items-center justify-center shrink-0">
                      <Percent size={14} className="text-warning-text" />
                    </div>
                    <span className="text-[15px] text-ink-3 shrink-0">Interest</span>
                    <input className="flex-1 bg-transparent text-[15px] text-ink outline-none text-right min-w-0"
                      type="number" inputMode="decimal" name="loan-interest-rate" placeholder="0"
                      value={form.interest_rate}
                      onChange={e => setForm(f => ({ ...f, interest_rate: e.target.value }))}
                    />
                    <span className="text-[13px] text-ink-3 shrink-0">% /yr</span>
                  </label>
                </div>

                {/* Loan date */}
                <div className="list-card mb-3">
                  <div className="list-row w-full">
                    <div className="w-8 h-8 rounded-chip bg-kosha-surface-2 flex items-center justify-center shrink-0 border border-kosha-border">
                      <Calendar size={14} className="text-ink-3" />
                    </div>
                    <span className="flex-1 text-[15px] text-ink">Loan Date</span>
                    <PixelDatePicker
                      name="loan-date"
                      value={form.loan_date}
                      onChange={(nextDate) => setForm(f => ({ ...f, loan_date: nextDate }))}
                      sheetTitle="Select loan date"
                      disabled={addSaving}
                    />
                  </div>
                </div>

                {/* Due date */}
                <div className="list-card mb-3">
                  <div className="list-row w-full">
                    <div className="w-8 h-8 rounded-chip bg-kosha-surface-2 border border-kosha-border flex items-center justify-center shrink-0">
                      <CalendarDays size={14} className="text-brand" />
                    </div>
                    <span className="flex-1 text-[15px] text-ink">Expected Repayment</span>
                    <PixelDatePicker
                      name="loan-due-date"
                      value={form.due_date}
                      onChange={(nextDate) => setForm(f => ({ ...f, due_date: nextDate }))}
                      sheetTitle="Select repayment date"
                      clearable
                      disabled={addSaving}
                    />
                  </div>
                </div>

                {/* Note */}
                <div className="list-card mb-3">
                  <label className="list-row w-full cursor-pointer">
                    <div className="w-8 h-8 rounded-chip bg-kosha-surface-2 flex items-center justify-center shrink-0 border border-kosha-border">
                      <FileText size={14} className="text-ink-3" />
                    </div>
                    <input className="flex-1 bg-transparent text-[15px] text-ink outline-none min-w-0"
                      name="loan-note"
                      placeholder="Note (optional)"
                      value={form.note}
                      onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                    />
                  </label>
                </div>

                {formErr && (
                  <p className="text-expense-text text-sm mb-3" role="alert" aria-live="polite">
                    {formErr}
                  </p>
                )}

                <div className="sticky bottom-0 pt-2 pb-2 bg-gradient-to-t from-kosha-surface via-kosha-surface to-transparent">
                  <Button
                    variant="primary"
                    size="xl"
                    fullWidth
                    onClick={handleAdd}
                    loading={addSaving}
                  >
                    {addSaving ? (editLoan ? 'Saving…' : 'Adding…') : (editLoan ? 'Save Changes' : 'Add Loan')}
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* FAB */}
      {!embedded && (
        <button className="fab-loans" aria-label="Add loan" onClick={() => setShowAdd(true)}>
          <Plus size={24} className="text-white" />
        </button>
      )}

      <AppToast message={errToast} onDismiss={() => setErrToast(null)} />
    </PageHeaderPage>
  )
}
