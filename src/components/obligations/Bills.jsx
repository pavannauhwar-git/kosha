import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Plus, X, Check, Repeat, CircleNotch, DownloadSimple, BookOpen, ArrowRight, PencilSimple, CalendarDots, DotsThreeVertical, Trash, ArrowUpRight } from '@phosphor-icons/react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  useLiabilities,
  addLiabilityMutation,
  updateLiabilityMutation,
  markLiabilityPaidMutation,
  deleteLiabilityMutation,
} from '../../hooks/useLiabilities'
import { useAppMutation } from '../../hooks/useAppMutation'
import { supabase } from '../../lib/supabase'
import { getAuthUserId } from '../../lib/authStore'
import { useActiveWallet } from '../../lib/walletStore'
import { downloadCsv, toCsv } from '../../lib/csv'
import { fmt, fmtDate, round2, daysUntil, dueLabel, dueChipClass, dueShadow, todayStr } from '../../lib/utils'
import { bandTextClass, scoreRiskBand } from '../../lib/insightBands'
import PageHeaderPage from '../layout/PageHeaderPage'
import SkeletonLayout from '../common/SkeletonLayout'
import EmptyState from '../common/EmptyState'

import BillPaymentInsights from '../cards/bills/BillPaymentInsights'
import Button from '../ui/Button'
import PixelDatePicker from '../ui/PixelDatePicker'
import useWindowedList from '../../hooks/useWindowedList'
import Sheet from '../ui/Sheet'
import { useAppToast } from '../../context/ToastContext'
import { toToastMessage } from '../../lib/errorTaxonomy'
import Input from '../ui/Input'
import { readLocalStorage, writeLocalStorage } from '../../lib/safeStorage'

const RECURRENCE = ['monthly', 'quarterly', 'yearly']
const PAYMENT_MODES = [
  { id: 'upi', label: 'UPI' },
  { id: 'cash', label: 'Cash' },
  { id: 'bank', label: 'Bank' },
  { id: 'card', label: 'Card' },
]
const BILLS_GUIDE_HINT_KEY = 'kosha:dismiss-guide-bills-v1'
const BUCKET_LABEL_CLASS = {
  overdue: 'bg-expense-bg text-expense-text border border-expense-border',
  dueSoon: 'bg-warning-bg text-warning-text border border-warning-border',
  later: 'bg-kosha-surface-2 text-ink-3 border border-kosha-border',
}

function createInitialBillForm() {
  return {
    description: '',
    amount: '',
    due_date: '',
    is_recurring: false,
    recurrence: 'monthly',
    payment_mode: 'upi',
  }
}

function safeDaysUntilDate(dateValue) {
  if (!dateValue) return null
  try {
    const days = daysUntil(dateValue)
    return Number.isFinite(days) ? days : null
  } catch {
    return null
  }
}

function resolveBillsTabQuery(searchParams, tabParam) {
  const primary = String(searchParams.get(tabParam) || '').toLowerCase()
  if (primary === 'pending' || primary === 'paid') {
    return { value: primary, source: tabParam }
  }

  if (tabParam !== 'tab') {
    const legacy = String(searchParams.get('tab') || '').toLowerCase()
    if (legacy === 'pending' || legacy === 'paid') {
      return { value: legacy, source: 'tab' }
    }
  }

  return { value: 'pending', source: null }
}

export default function Bills({
  embedded = false,
  tabParam = 'tab',
  showAddExternal,
  onShowAddChange,
  isViewingPartner: isViewingPartnerProp,
} = {}) {
  const activeWalletUserId = useActiveWallet()
  const isViewingPartner = isViewingPartnerProp ?? (!!activeWalletUserId && activeWalletUserId !== getAuthUserId())

  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState(() => resolveBillsTabQuery(searchParams, tabParam).value)
  const { pending, paid, loading, pendingLoading, paidLoading } = useLiabilities({ includePaid: true })
  const [showAddInternal, setShowAddInternal] = useState(false)
  const showAdd = showAddExternal !== undefined ? showAddExternal : showAddInternal
  const setShowAdd = onShowAddChange || setShowAddInternal

  const [editBill, setEditBill] = useState(null)
  const [payingId, setPayingId] = useState(null)
  const [deletingId] = useState(null)
  const [highlightedBillId, setHighlightedBillId] = useState(null)
  const [showGuideHint, setShowGuideHint] = useState(true)
  const actionGuard = useRef(false)

  const [form, setForm] = useState(() => createInitialBillForm())
  const [formErr, setFormErr] = useState('')
  const { pushToast } = useAppToast()
  const pendingDeleteRef = useRef(null)
  const [overflowBillId, setOverflowBillId] = useState(null)
  const overflowBillRef = useRef(null)
  const focusRanForRef = useRef(null)

  useEffect(() => {
    if (!overflowBillId) return
    function handleClickOutside(e) {
      if (overflowBillRef.current && !overflowBillRef.current.contains(e.target)) {
        setOverflowBillId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [overflowBillId])


  const addLiability = useAppMutation(addLiabilityMutation, { context: 'bills:add' })
  const updateLiability = useAppMutation(
    ({ id, updates }) => updateLiabilityMutation(id, updates), 
    { context: 'bills:update' }
  )
  const markLiabilityPaid = useAppMutation(markLiabilityPaidMutation, { context: 'bills:markPaid' })
  const deleteLiability = useAppMutation(deleteLiabilityMutation, { context: 'bills:delete' })

  const isSaving = addLiability.isPending || updateLiability.isPending

  const commitPendingDelete = useCallback(async (pending) => {
    if (!pending?.id) return
    try {
      await deleteLiability.mutateAsync(pending.id)
    } catch (e) {
      // Re-insert into appropriate cache if server delete fails
      const method = pending.bill.paid ? 'paid' : 'pending'
      if (method === 'pending') {
        import('../../hooks/useLiabilities').then(m => m.optimisticallyInsertPendingLiability(pending.bill, activeWalletUserId))
      } else {
        import('../../hooks/useLiabilities').then(m => m.optimisticallyMarkLiabilityPaid(pending.bill, activeWalletUserId, { optimistic: false }))
      }
      pushToast(e.message || 'Could not delete bill.', { duration: 4200 })
    }
  }, [pushToast, activeWalletUserId, deleteLiability])

  async function handleDelete(id) {
    if (!id || payingId) return false

    const pendingDelete = pendingDeleteRef.current
    if (pendingDelete?.id && pendingDelete.id !== id) {
      if (pendingDelete.timeoutId) clearTimeout(pendingDelete.timeoutId)
      pendingDeleteRef.current = null
      void commitPendingDelete(pendingDelete)
    }

    const sourceRows = tab === 'pending' ? pending : paid
    const bill = sourceRows.find((b) => b.id === id)
    if (!bill) return false

    const snapshot = { ...bill }
    setHiddenBillIds(prev => { const n = new Set(prev); n.add(id); return n })
    import('../../hooks/useLiabilities').then(m => m.optimisticallyDeleteLiabilityFromCache(id, activeWalletUserId))
    import('../../hooks/useTransactions').then(m => m.optimisticallyDeleteTransactionsByBillId(id, activeWalletUserId))

    const undoDelete = () => {
      const pending = pendingDeleteRef.current
      if (!pending || pending.id !== id) return
      if (pending.timeoutId) clearTimeout(pending.timeoutId)
      pendingDeleteRef.current = null
      setHiddenBillIds(prev => { const n = new Set(prev); n.delete(id); return n })

      if (snapshot.paid) {
        import('../../hooks/useLiabilities').then(m => m.optimisticallyMarkLiabilityPaid(snapshot, activeWalletUserId, { optimistic: false }))
      } else {
        import('../../hooks/useLiabilities').then(m => m.optimisticallyInsertPendingLiability(snapshot, activeWalletUserId))
      }
      pushToast('Deletion canceled.', { duration: 2200 })
    }

    const timeoutId = setTimeout(() => {
      const pending = pendingDeleteRef.current
      if (!pending || pending.id !== id) return
      pendingDeleteRef.current = null
      void commitPendingDelete(pending)
    }, 4200)

    pendingDeleteRef.current = { id, bill: snapshot, timeoutId }

    pushToast('Bill deleted.', {
      action: undoDelete,
      actionLabel: 'Undo',
      duration: 4200,
    })

    return true
  }

  const [hiddenBillIds, setHiddenBillIds] = useState(() => new Set())

  const closeAddBillSheet = useCallback(() => {
    setShowAdd(false)
    setEditBill(null)
    setFormErr('')
    setForm(createInitialBillForm())
  }, [setShowAdd])

  const dismissAddBillSheet = useCallback(() => {
    if (isSaving) return
    closeAddBillSheet()
  }, [isSaving, closeAddBillSheet])


  const visiblePending = useMemo(() => pending.filter((bill) => !hiddenBillIds.has(bill.id)), [pending, hiddenBillIds])
  const visiblePaid = useMemo(() => paid.filter((bill) => !hiddenBillIds.has(bill.id)), [paid, hiddenBillIds])

  const totalPending = useMemo(() => round2(visiblePending.reduce((s, b) => s + +b.amount, 0)), [visiblePending])
  const dueSoonAmount = useMemo(() => round2(visiblePending
    .filter((bill) => {
      const days = safeDaysUntilDate(bill.due_date)
      return days !== null && days <= 7
    })
    .reduce((s, b) => s + +b.amount, 0)), [visiblePending])
  const dueSoonCount = useMemo(() => visiblePending
    .filter((bill) => {
      const days = safeDaysUntilDate(bill.due_date)
      return days !== null && days <= 7
    }).length, [visiblePending])
  const dueThisMonth = useMemo(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = now.getMonth()
    const rows = visiblePending.filter((bill) => {
      const parsed = new Date(`${bill.due_date}T00:00:00`)
      if (Number.isNaN(parsed.getTime())) return false
      return parsed.getFullYear() === y && parsed.getMonth() === m
    })
    return {
      count: rows.length,
      amount: round2(rows.reduce((sum, row) => sum + Number(row.amount || 0), 0)),
    }
  }, [visiblePending])

  const overdueSummary = useMemo(() => {
    const rows = visiblePending.filter((bill) => {
      const days = safeDaysUntilDate(bill.due_date)
      return days !== null && days < 0
    })

    return {
      count: rows.length,
      amount: rows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    }
  }, [visiblePending])

  const duePressureIndex = useMemo(() => {
    if (!visiblePending.length) return 0
    const weightedPressure = (overdueSummary.count * 2) + dueSoonCount
    const maxWeightedPressure = visiblePending.length * 2
    return Math.round((weightedPressure / Math.max(1, maxWeightedPressure)) * 100)
  }, [visiblePending.length, overdueSummary.count, dueSoonCount])

  const duePressureBand = useMemo(
    () => scoreRiskBand(duePressureIndex, { high: 35, watch: 15 }),
    [duePressureIndex]
  )

  const recurringBurden = useMemo(() => {
    const recurringRows = visiblePending.filter((bill) => !!bill.is_recurring)
    const recurringAmount = recurringRows.reduce((sum, row) => sum + Number(row.amount || 0), 0)

    return {
      count: recurringRows.length,
      amount: recurringAmount,
      ratioPct: totalPending > 0 ? Math.round((recurringAmount / totalPending) * 100) : 0,
    }
  }, [visiblePending, totalPending])

  const recurringBurdenBand = useMemo(
    () => scoreRiskBand(recurringBurden.ratioPct, { high: 45, watch: 30 }),
    [recurringBurden.ratioPct]
  )

  const forecast30Days = useMemo(() => {
    const rows = visiblePending
      .map((bill) => ({
        ...bill,
        days: safeDaysUntilDate(bill.due_date),
      }))
      .filter((bill) => bill.days !== null && bill.days >= 0 && bill.days <= 30)

    const weeklyBuckets = [0, 0, 0, 0, 0]
    for (const row of rows) {
      const bucketIndex = Math.min(4, Math.floor(row.days / 7))
      weeklyBuckets[bucketIndex] += 1
    }

    const peakWeek = weeklyBuckets.reduce((best, count, index) => {
      if (count > best.count) return { week: index + 1, count }
      return best
    }, { week: 0, count: 0 })

    return {
      count: rows.length,
      amount: rows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
      peakWeek,
    }
  }, [visiblePending])

  const pendingWithBucket = useMemo(() => {
    const bucketRank = { overdue: 0, dueSoon: 1, later: 2 }
    return visiblePending
      .map((bill) => {
        const days = safeDaysUntilDate(bill.due_date)
        const bucket = days < 0 ? 'overdue' : days <= 7 ? 'dueSoon' : 'later'
        return { ...bill, _days: days ?? 9999, _bucket: bucket }
      })
      .sort((a, b) => {
        const rankDiff = bucketRank[a._bucket] - bucketRank[b._bucket]
        if (rankDiff !== 0) return rankDiff
        return String(a.due_date || '').localeCompare(String(b.due_date || ''))
      })
  }, [visiblePending])

  const billRows = useMemo(
    () => (tab === 'pending' ? pendingWithBucket : visiblePaid),
    [tab, pendingWithBucket, visiblePaid]
  )

  const {
    containerRef: billListRef,
    startIndex: billStartIndex,
    endIndex: billEndIndex,
    topPadding: billTopPadding,
    bottomPadding: billBottomPadding,
    measureElement: measureBillRow,
    scrollToIndex: scrollBillToIndex,
  } = useWindowedList({
    count: billRows.length,
    estimateSize: tab === 'pending' ? 154 : 128,
    overscan: 6,
    enabled: true,
    resetKey: `${tab}`,
    initialCount: 22,
  })

  const renderedBills = useMemo(
    () => billRows.slice(billStartIndex, billEndIndex),
    [billRows, billStartIndex, billEndIndex]
  )

  const nextDueInDays = useMemo(() => {
    const allDays = visiblePending
      .map((bill) => safeDaysUntilDate(bill.due_date))
      .filter((value) => value !== null)
    if (!allDays.length) return null
    return Math.max(0, Math.min(...allDays))
  }, [visiblePending])

  const recurrenceStartsImmediately = useMemo(() => {
    if (!form.is_recurring || !form.due_date) return false
    const due = new Date(`${form.due_date}T00:00:00`)
    if (Number.isNaN(due.getTime())) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return due.getTime() <= today.getTime()
  }, [form.is_recurring, form.due_date])

  const barPct = totalPending > 0 ? Math.round((dueSoonAmount / totalPending) * 100) : 0
  const totalBills = visiblePending.length + visiblePaid.length
  const focusBillId = searchParams.get('focus')
  const { value: tabFromQuery, source: tabSource } = resolveBillsTabQuery(searchParams, tabParam)

  useEffect(() => {
    const hidden = readLocalStorage(BILLS_GUIDE_HINT_KEY, '0') === '1'
    if (hidden) setShowGuideHint(false)
  }, [])

  useEffect(() => {
    if (tabSource) {
      setTab(tabFromQuery)
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.delete(tabSource)
        return next
      }, { replace: true })
    }
  }, [tabFromQuery, tabSource, setSearchParams])

  useEffect(() => {
    if (!focusBillId || pendingLoading || paidLoading) return

    const isInPending = pending.some(b => b.id === focusBillId)
    const isInPaid = paid.some(b => b.id === focusBillId)

    if (tab === 'pending' && !isInPending && isInPaid) {
      setTab('paid')
    } else if (tab === 'paid' && !isInPaid && isInPending) {
      setTab('pending')
    }
    // NOTE: `tab` is intentionally excluded from deps. Including it would
    // cause the effect to re-run after setTab fires, potentially toggling
    // the tab back before the data stabilizes → infinite loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusBillId, pending, paid, pendingLoading, paidLoading])

  useEffect(() => {
    return () => {
      // Commit any pending delete if the component unmounts
      if (pendingDeleteRef.current) {
        const pending = pendingDeleteRef.current
        pendingDeleteRef.current = null
        if (pending.timeoutId) clearTimeout(pending.timeoutId)
        void commitPendingDelete(pending)
      }
    }
  }, [commitPendingDelete])

  useEffect(() => {
    if (!focusBillId || focusRanForRef.current === focusBillId) return

    const focusIndex = billRows.findIndex((bill) => bill.id === focusBillId)
    if (focusIndex < 0) return

    // Mark as handled BEFORE any state/URL updates to prevent re-entry
    // if scrollBillToIndex identity changes (useWindowedList revision bumps).
    focusRanForRef.current = focusBillId

    scrollBillToIndex(focusIndex, { behavior: 'smooth', block: 'center' })

    setHighlightedBillId(focusBillId)
    setTimeout(() => {
      const el = document.getElementById(`bill-${focusBillId}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 70)

    const timeoutId = setTimeout(() => setHighlightedBillId(null), 2400)

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('focus')
      return next
    }, { replace: true })

    return () => clearTimeout(timeoutId)
  }, [focusBillId, billRows, scrollBillToIndex, setSearchParams])

  async function handleExportCsv() {
    try {
      const userId = getAuthUserId()
      const paidFilter = tab === 'paid'
      const { data: rows, error } = await supabase
        .from('liabilities')
        .select('description, amount, due_date, is_recurring, recurrence, paid, linked_transaction_id')
        .eq('user_id', userId)
        .eq('paid', paidFilter)
        .order('due_date', { ascending: true })

      if (error) throw error
      if (!rows?.length) {
        pushToast(`No ${tab} bills to export.`)
        return
      }

      const headers = [
        'Description',
        'Amount',
        'Due Date',
        'Status',
        'Recurring',
        'Recurrence',
        'Linked Transaction ID',
      ]

      const csvRows = rows.map((row) => [
        row.description || '',
        row.amount,
        row.due_date || '',
        row.paid ? 'paid' : 'pending',
        row.is_recurring ? 'yes' : 'no',
        row.recurrence || '',
        row.linked_transaction_id || '',
      ])

      const csv = toCsv(headers, csvRows)
      const date = todayStr()
      downloadCsv(`kosha-${tab}-bills-${date}.csv`, csv)
    } catch (e) {
      pushToast(toToastMessage(e, 'Could not export bills CSV.'))
    }
  }

  async function handleAdd() {
    if (isSaving) return
    if (!form.description.trim()) { setFormErr('Enter a description'); return }
    if (!form.amount || !Number.isFinite(+form.amount) || +form.amount <= 0) { setFormErr('Enter a valid positive amount'); return }
    if (!form.due_date) { setFormErr('Select a due date'); return }

    const billData = {
      description: form.description.trim(),
      amount: +form.amount,
      due_date: form.due_date,
      is_recurring: form.is_recurring,
      recurrence: form.is_recurring ? form.recurrence : null,
      payment_mode: form.payment_mode || 'upi',
      paid: false,
    }

    setFormErr('')

    if (editBill) {
      try {
        await updateLiability.mutateAsync({ id: editBill.id, updates: billData })
        setTab('pending')
        closeAddBillSheet()
      } catch (e) {
        pushToast(toToastMessage(e, 'Could not update bill. Check your connection.'))
      }
      return
    }

    try {
      await addLiability.mutateAsync(billData)

      setTab('pending')
      closeAddBillSheet()
    } catch (e) {
      pushToast(toToastMessage(e, 'Could not add bill. Check your connection.'))
    }
  }
  async function handleMarkPaid(bill) {
    if (!bill?.id || payingId || actionGuard.current) return
    actionGuard.current = true
    setPayingId(bill.id)
    try {
      await markLiabilityPaid.mutateAsync(bill)
      setPayingId(null)
    } catch (e) {
      setPayingId(null)
      pushToast(toToastMessage(e, 'Could not mark bill as paid. Check your connection.'))
    } finally {
      actionGuard.current = false
    }
  }

  function openEditBill(bill) {
    setEditBill(bill)
    setForm({
      description: bill.description || '',
      amount: String(bill.amount || ''),
      due_date: bill.due_date || '',
      is_recurring: !!bill.is_recurring,
      recurrence: bill.recurrence || 'monthly',
      payment_mode: bill.payment_mode || 'upi',
    })
    setFormErr('')
    setShowAdd(true)
  }

  function dismissGuideHint() {
    setShowGuideHint(false)
    writeLocalStorage(BILLS_GUIDE_HINT_KEY, '1')
  }

  return (
    <PageHeaderPage
      title="Bills & Dues"
      showHeader={!embedded}
      withHeaderOffset={!embedded}
      pageClassName={embedded ? 'pb-5' : 'page'}
    >

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div>
          {tab === 'pending' && visiblePending.length > 0 && nextDueInDays !== null ? (
            <p className="text-caption text-ink-3 mt-0.5">
              Next due in {nextDueInDays} days
            </p>
          ) : tab === 'paid' ? (
            <p className="text-caption text-ink-3 mt-0.5">{visiblePaid.length} paid bill{visiblePaid.length !== 1 ? 's' : ''}</p>
          ) : (
            <p className="text-caption text-ink-3 mt-0.5">{totalBills} bill{totalBills !== 1 ? 's' : ''}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {totalBills > 0 && !isViewingPartner && (
            <Button
              variant="secondary"
              size="sm"
              icon={<DownloadSimple size={14} />}
              onClick={handleExportCsv}
            >
              Export CSV
            </Button>
          )}
          {embedded && !isViewingPartner && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => setShowAdd(true)}
            >
              Add
            </Button>
          )}
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div className="mb-2.5 grid grid-cols-2 gap-2">
        <button
          onClick={() => setTab('pending')}
          className={`h-9 sm:h-10 w-full rounded-card text-[11px] sm:text-[12px] font-semibold transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] will-change-transform active:scale-[0.97]
            ${tab === 'pending'
              ? 'bg-brand-container text-brand border border-brand shadow-card'
              : 'bg-kosha-surface text-ink-3 border border-kosha-border'}`}
        >
          Pending ({visiblePending.length})
        </button>
        <button
          onClick={() => setTab('paid')}
          className={`h-9 sm:h-10 w-full rounded-card text-[11px] sm:text-[12px] font-semibold transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] will-change-transform active:scale-[0.97]
            ${tab === 'paid'
              ? 'bg-income-bg text-income-text border border-income-border shadow-card'
              : 'bg-kosha-surface text-ink-3 border border-kosha-border'}`}
        >
          Paid ({visiblePaid.length})
        </button>
      </div>

      <div className="space-y-3">

        {/* ── Summary card ─────────────────────────────────────────────── */}
        {tab === 'pending' && visiblePending.length > 0 && (
          <div className="card p-3.5 sm:p-4">
            <div className="flex items-start justify-between gap-3 border-b border-kosha-border pb-4">
              <div>
                <p className="section-label mb-0.5">Total pending</p>
                <p className="text-value font-semibold text-ink tracking-tight tabular-nums leading-none">
                  {fmt(totalPending)}
                </p>
              </div>
              <span className="text-caption font-semibold text-ink-3 bg-kosha-surface-2 px-2.5 py-1 rounded-pill border border-kosha-border">
                {visiblePending.length} bill{visiblePending.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="mini-panel px-3 py-2.5">
                <p className="text-caption text-ink-3 mb-1">Due in 7 days</p>
                <p className="text-base font-semibold text-warning-text tabular-nums leading-none">{fmt(dueSoonAmount)}</p>
                <p className="text-caption text-ink-3 mt-1">{dueSoonCount} bill{dueSoonCount !== 1 ? 's' : ''}</p>
              </div>
              <div className="mini-panel px-3 py-2.5">
                <p className="text-caption text-ink-3 mb-1">Due this month</p>
                <p className="text-base font-semibold text-ink tabular-nums leading-none">{fmt(dueThisMonth.amount)}</p>
                <p className="text-caption text-ink-3 mt-1">{dueThisMonth.count} bill{dueThisMonth.count !== 1 ? 's' : ''}</p>
              </div>
            </div>

            <div className="mt-3.5">
              <div className="h-1.5 bg-kosha-border rounded-pill overflow-hidden mb-1.5">
                <motion.div
                  className={`h-full rounded-pill ${dueSoonCount > 0 ? 'bg-warning-text' : 'bg-income-text'}`}
                  initial={{ width: 0 }} animate={{ width: `${barPct || 100}%` }}
                  transition={{ duration: 0.4, ease: [0.05, 0.7, 0.1, 1] }}
                />
              </div>
              <div className="flex justify-between">
                <span className="text-caption text-ink-3">
                  {dueSoonCount > 0 ? `${fmt(dueSoonAmount)} due this week` : 'All bills on schedule'}
                </span>
                <span className={`text-caption font-semibold ${barPct > 0 ? 'text-warning-text' : 'text-income-text'}`}>
                  {barPct > 0 ? `${barPct}% urgent` : 'Stable'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3">
              <div className="mini-panel px-3 py-2.5">
                <p className="text-[10px] text-ink-3 uppercase tracking-wide">Due pressure</p>
                <p className={`text-label font-semibold tabular-nums mt-1 ${bandTextClass(duePressureBand)}`}>
                  {duePressureIndex}/100
                </p>
                <p className="text-[10px] text-ink-3 mt-0.5 tabular-nums">
                  {overdueSummary.count} overdue · {dueSoonCount} due soon
                </p>
              </div>

              <div className="mini-panel px-3 py-2.5">
                <p className="text-[10px] text-ink-3 uppercase tracking-wide">Recurring burden</p>
                <p className={`text-label font-semibold tabular-nums mt-1 ${bandTextClass(recurringBurdenBand, 'text-ink')}`}>
                  {recurringBurden.ratioPct}%
                </p>
                <p className="text-[10px] text-ink-3 mt-0.5 tabular-nums">
                  {recurringBurden.count} recurring · {fmt(recurringBurden.amount)}
                </p>
              </div>

              <div className="mini-panel px-3 py-2.5">
                <p className="text-[10px] text-ink-3 uppercase tracking-wide">Next 30 days</p>
                <p className="text-label font-semibold tabular-nums mt-1 text-ink">
                  {fmt(forecast30Days.amount)}
                </p>
                <p className="text-[10px] text-ink-3 mt-0.5 tabular-nums">
                  {forecast30Days.count} bill{forecast30Days.count === 1 ? '' : 's'}
                  {forecast30Days.peakWeek.count > 0 ? ` · Peak week ${forecast30Days.peakWeek.week}` : ''}
                </p>
              </div>
            </div>
          </div>
        )}

        {showGuideHint && (
          <div className="hint-card">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-kosha-surface-2 flex items-center justify-center shrink-0 border border-kosha-border">
                <BookOpen size={16} className="text-brand" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-ink">Bills setup tip</p>
                <p className="text-[12px] text-ink-3 mt-0.5 leading-relaxed">Mark recurring bills properly to keep due alerts and auto-generation accurate.</p>
                <button
                  onClick={() => navigate('/guide')}
                  className="text-[12px] font-semibold text-brand mt-2 inline-flex items-center gap-1"
                >
                  Open guide <ArrowRight size={12} />
                </button>
              </div>
              <button onClick={dismissGuideHint} className="text-ink-4 hover:text-ink-2 transition-colors shrink-0" aria-label="Dismiss bills hint">
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {loading && pendingLoading && visiblePending.length === 0 ? (
          <SkeletonLayout
            className="space-y-3"
            sections={[
              { type: 'block', height: 'h-[120px]' },
              { type: 'block', height: 'h-[92px]' },
              { type: 'block', height: 'h-[92px]' },
              { type: 'block', height: 'h-[92px]' },
            ]}
          />
        ) : (
          <div className="space-y-3">

            {/* ── Pending empty state ── */}
            {tab === 'pending' && visiblePending.length === 0 && (
              <EmptyState
                className="py-8"
                imageUrl="/illustrations/coffee_chill.webp"
                title="You're all clear"
                description={isViewingPartner ? "This partner has no pending bills." : "No pending bills right now. Add recurring dues to keep reminders and cashflow planning accurate."}
                actionLabel={isViewingPartner ? undefined : "Add a bill"}
                onAction={isViewingPartner ? undefined : () => setShowAdd(true)}
              />
            )}

            {tab === 'paid' && !paidLoading && visiblePaid.length > 0 && (
              <BillPaymentInsights paidBills={visiblePaid} pendingBills={visiblePending} />
            )}

            {tab === 'paid' && paidLoading && visiblePaid.length === 0 && (
              <div className="card p-4">
                <p className="section-label">Paid bills</p>
                <p className="text-[12px] text-ink-3 mt-1">Loading paid history...</p>
              </div>
            )}

            {tab === 'paid' && !paidLoading && visiblePaid.length === 0 && (
              <EmptyState
                className="py-8"
                imageUrl="/illustrations/all_done.webp"
                title="No paid bills yet"
                description="Bills you mark as paid will show up here for history and tracking."
                actionLabel="View pending"
                onAction={() => setTab('pending')}
              />
            )}

            {/* ── Bill cards ── */}
            <div ref={billListRef} className="space-y-2.5" style={{ overflowAnchor: 'none' }}>
              {billTopPadding > 0 && <div aria-hidden="true" style={{ height: `${billTopPadding}px` }} />}
              {renderedBills.map((bill, localIndex) => {
                const index = billStartIndex + localIndex
                const previousRow = billRows[index - 1]
                const days = daysUntil(bill.due_date)
                const shadow = tab === 'pending' ? dueShadow(days) : 'card'
                const chipCls = dueChipClass(days)
                const showBucketHeader = tab === 'pending' && (index === 0 || previousRow?._bucket !== bill._bucket)
                const bucketLabelClass = BUCKET_LABEL_CLASS[bill._bucket] || BUCKET_LABEL_CLASS.later
                return (
                  <div key={bill.id} ref={(node) => measureBillRow(index, node)}>
                    {showBucketHeader && (
                      <div className="px-1 mb-1 mt-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-pill text-[10px] font-semibold uppercase tracking-wide ${bucketLabelClass}`}>
                          {bill._bucket === 'overdue' ? 'Overdue' : bill._bucket === 'dueSoon' ? 'Due this week' : 'Later'}
                        </span>
                      </div>
                    )}
                    <div
                      id={`bill-${bill.id}`}
                      className={`${shadow} p-3 sm:p-3.5 ${highlightedBillId === bill.id ? 'txn-focus-highlight' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          {/* ── Pending bill layout ── */}
                          {tab === 'pending' && (
                            <>
                              <div className="flex items-center gap-2 mb-1">
                                {bill.is_recurring && (
                                  <Repeat size={12} className="text-ink-3 shrink-0" />
                                )}
                                <p className="text-[13px] sm:text-sm font-semibold text-ink truncate">
                                  {bill.description}
                                </p>
                              </div>
                              <p className="text-[17px] sm:text-lg font-semibold amt-expense mb-2">{fmt(+bill.amount)}</p>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-pill ${chipCls}`}>
                                  {dueLabel(days)}
                                </span>
                                {bill.is_recurring && (
                                  <span className="text-[10px] sm:text-[11px] text-ink-3 capitalize">{bill.recurrence}</span>
                                )}
                                {(bill.__optimistic || String(bill.id || '').startsWith('optimistic-')) && (
                                  <span className="text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-pill bg-warning-bg text-warning-text">
                                    Syncing...
                                  </span>
                                )}
                              </div>
                            </>
                          )}

                          {/* ── Paid bill layout — richer info ── */}
                          {tab === 'paid' && (
                            <>
                              {/* Header: description + Paid ✓ badge */}
                              <div className="flex items-center gap-2 mb-1.5">
                                {bill.is_recurring && (
                                  <Repeat size={11} className="text-ink-3 shrink-0" />
                                )}
                                <p className="text-[13px] font-semibold text-ink truncate flex-1">
                                  {bill.description}
                                </p>
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-pill bg-income-bg text-income-text border border-income-border shrink-0">
                                  Paid ✓
                                </span>
                              </div>

                              {/* Amount + due date compact row */}
                              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                <span className="text-[15px] font-semibold tabular-nums amt-expense">{fmt(+bill.amount)}</span>
                                {bill.due_date && (
                                  <span className="text-[11px] text-ink-3">· Due {fmtDate(bill.due_date)}</span>
                                )}
                                {bill.is_recurring && (
                                  <span className="text-[11px] text-ink-3 capitalize">· {bill.recurrence}</span>
                                )}
                              </div>

                              {/* View history link */}
                              {bill.linked_transaction_id && (
                                <button
                                  onClick={() => navigate(`/transactions?linked_bill=${bill.id}&focus=${bill.linked_transaction_id}`)}
                                  className="flex items-center gap-1 text-[11px] font-semibold text-brand active:opacity-60 transition-opacity w-fit"
                                >
                                  <ArrowUpRight size={10} />
                                  View history
                                </button>
                              )}
                            </>
                          )}
                        </div>

                        {!isViewingPartner && (
                          <div className="flex flex-col gap-2 shrink-0">
                            {tab === 'pending' && (
                              <>
                                <Button
                                  onClick={() => openEditBill(bill)}
                                  disabled={!!payingId || !!deletingId || !!bill.__optimistic}
                                  variant="secondary"
                                  size="sm"
                                  icon={<PencilSimple size={13} />}
                                >
                                  Edit
                                </Button>
                                <Button
                                  onClick={() => handleMarkPaid(bill)}
                                  disabled={!!payingId || !!deletingId || !!bill.__optimistic}
                                  variant="success"
                                  size="sm"
                                  icon={payingId === bill.id ? <CircleNotch size={13} className="animate-spin" /> : <Check size={13} />}
                                >
                                  {payingId === bill.id ? 'Paying…' : 'Paid'}
                                </Button>
                                <Button
                                  onClick={() => handleDelete(bill.id)}
                                  disabled={!!payingId || !!deletingId || !!bill.__optimistic}
                                  variant="danger"
                                  size="sm"
                                  icon={deletingId === bill.id ? <CircleNotch size={13} className="animate-spin" /> : <X size={13} />}
                                >
                                  {deletingId === bill.id ? 'Deleting…' : 'Delete'}
                                </Button>
                              </>
                            )}
                            {/* Paid bills only: 3-dot warns that linked payment transaction is also removed */}
                            {tab === 'paid' && (
                              <div className="relative" ref={overflowBillId === bill.id ? overflowBillRef : null}>
                                <button
                                  onClick={() => setOverflowBillId(overflowBillId === bill.id ? null : bill.id)}
                                  disabled={!!payingId || !!deletingId || !!bill.__optimistic}
                                  className="w-8 h-8 flex items-center justify-center rounded-full text-ink-3 active:bg-kosha-surface-2 transition-colors disabled:opacity-40"
                                  aria-label="More options"
                                >
                                  {deletingId === bill.id
                                    ? <CircleNotch size={14} className="animate-spin" />
                                    : <DotsThreeVertical size={16} />}
                                </button>
                                {overflowBillId === bill.id && (
                                  <div className="absolute right-0 top-full mt-1 z-30 bg-kosha-surface rounded-2xl border border-kosha-border shadow-apple-card min-w-[200px] overflow-hidden">
                                    <button
                                      onClick={() => { setOverflowBillId(null); handleDelete(bill.id) }}
                                      className="w-full flex items-start gap-2.5 px-3.5 py-3 text-left active:bg-kosha-surface-2 transition-colors"
                                    >
                                      <Trash size={14} className="text-expense-text mt-0.5 shrink-0" />
                                      <div>
                                        <p className="text-[13px] font-semibold text-expense-text leading-snug">Delete bill</p>
                                        <p className="text-[11px] text-ink-3 mt-0.5 leading-snug">
                                          Linked payment transaction will also be removed
                                        </p>
                                      </div>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              {billBottomPadding > 0 && <div aria-hidden="true" style={{ height: `${billBottomPadding}px` }} />}
            </div>
          </div>
        )}

      </div>

      {/* ── Add Bill Sheet ────────────────────────────────────────────── */}
      <Sheet
        open={showAdd}
        onClose={dismissAddBillSheet}
        title={editBill ? 'Edit Bill' : 'Add Bill'}
        initialFocusSelector='input[name="bill-description"]'
        contentClassName="px-5 pt-2 overflow-x-hidden"
      >
                <div className="mb-3">
                  <Input
                    label="Description"
                    placeholder="e.g. Car EMI"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  />
                </div>

                <div className="mb-3">
                  <Input
                    label="Amount"
                    icon={<span className="text-brand font-bold">₹</span>}
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9.]*"
                    placeholder="0"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  />
                </div>

                <div className="list-card mb-3">
                  <div className="list-row w-full">
                    <div className="w-8 h-8 rounded-chip bg-kosha-surface-2 border border-kosha-border flex items-center justify-center shrink-0">
                      <CalendarDots size={14} className="text-brand" />
                    </div>
                    <span className="flex-1 text-[15px] text-ink">Due Date</span>
                    <PixelDatePicker
                      name="bill-due-date"
                      value={form.due_date}
                      onChange={(nextDate) => setForm(f => ({ ...f, due_date: nextDate }))}
                      sheetTitle="Select due date"
                      disabled={isSaving}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-wide w-full">Payment Mode</p>
                  <div className="flex flex-wrap gap-2">
                    {PAYMENT_MODES.map(m => (
                      <button key={m.id}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, payment_mode: m.id }))}
                        className={`px-3 py-1.5 rounded-pill text-xs font-semibold border capitalize transition-all
                          ${form.payment_mode === m.id
                            ? 'bg-brand-container text-brand border-brand/20'
                            : 'bg-kosha-surface text-ink-2 border-kosha-border'}`}
                      >{m.label}</button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, is_recurring: !f.is_recurring }))}
                    className={`flex items-center gap-2 px-3 py-2 rounded-card text-sm font-medium
                                border transition-[background-color,border-color,color] duration-150
                      ${form.is_recurring
                        ? 'bg-brand-container text-brand border-brand/20'
                        : 'bg-kosha-surface text-ink-2 border-kosha-border'}`}
                  >
                    <Repeat size={14} /> Recurring
                  </button>
                  {form.is_recurring && (
                    <div className="flex flex-wrap gap-2">
                      {RECURRENCE.map(r => (
                        <button key={r}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, recurrence: r }))}
                          className={`px-3 py-1.5 rounded-pill text-xs font-semibold border capitalize transition-[background-color,border-color,color] duration-150
                            ${form.recurrence === r
                              ? 'bg-brand-container text-brand border-brand/20'
                              : 'bg-kosha-surface text-ink-2 border-kosha-border'}`}
                        >{r}</button>
                      ))}
                    </div>
                  )}
                </div>

                {recurrenceStartsImmediately && (
                  <p className="text-[12px] text-warning-text mb-3">
                    Recurrence starts from this due date. If this bill is already due, next cycle may generate immediately.
                  </p>
                )}

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
                    loading={isSaving}
                  >
                    {isSaving ? (editBill ? 'Saving…' : 'Adding…') : (editBill ? 'Save Changes' : 'Add Bill')}
                  </Button>
                </div>
      </Sheet>
      {/* FAB */}
      {!embedded && !isViewingPartner && (
        <button
          className="fab-bills"
          aria-label="Add bill"
          onClick={() => setShowAdd(true)}
          onPointerUp={(e) => {
            e.preventDefault()
            // Bypass Safari blur swallow but wait for finger release so it feels natural
            setShowAdd(true)
          }}
        >
          <Plus size={24} className="text-white" />
        </button>
      )}

    </PageHeaderPage>
  )
}
