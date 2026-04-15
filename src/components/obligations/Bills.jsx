import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Check, Repeat, Loader2, Download, BookOpen, ArrowRight, Pencil, CalendarDays } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  useLiabilities,
  addLiabilityMutation,
  updateLiabilityMutation,
  markLiabilityPaidMutation,
  deleteLiabilityMutation,
} from '../../hooks/useLiabilities'
import { supabase } from '../../lib/supabase'
import { getAuthUserId } from '../../lib/authStore'
import { downloadCsv, toCsv } from '../../lib/csv'
import { fmt, fmtDate, daysUntil, dueLabel, dueChipClass, dueShadow } from '../../lib/utils'
import { bandTextClass, scoreRiskBand } from '../../lib/insightBands'
import PageHeaderPage from '../layout/PageHeaderPage'
import SkeletonLayout from '../common/SkeletonLayout'
import EmptyState from '../common/EmptyState'
import AppToast from '../common/AppToast'
import BillPaymentInsights from '../cards/bills/BillPaymentInsights'
import Button from '../ui/Button'
import PixelDatePicker from '../ui/PixelDatePicker'
import useOverlayFocusTrap from '../../hooks/useOverlayFocusTrap'
import useWindowedList from '../../hooks/useWindowedList'

const RECURRENCE = ['monthly', 'quarterly', 'yearly']
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
} = {}) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState(() => resolveBillsTabQuery(searchParams, tabParam).value)
  const { pending, paid, loading, pendingLoading, paidLoading } = useLiabilities({ includePaid: true })
  const [showAddInternal, setShowAddInternal] = useState(false)
  const showAdd = showAddExternal !== undefined ? showAddExternal : showAddInternal
  const setShowAdd = onShowAddChange || setShowAddInternal

  const [editBill, setEditBill] = useState(null)
  const [payingId, setPayingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [highlightedBillId, setHighlightedBillId] = useState(null)
  const [showGuideHint, setShowGuideHint] = useState(true)

  const [form, setForm] = useState(() => createInitialBillForm())
  const [formErr, setFormErr] = useState('')
  const [errToast, setErrToast] = useState(null)
  const [undoToast, setUndoToast] = useState(null)
  const [undoBill, setUndoBill] = useState(null)
  const [addSaving, setAddSaving] = useState(false)
  const [hiddenBillIds, setHiddenBillIds] = useState(() => new Set())
  const undoTimerRef = useRef(null)

  const closeAddBillSheet = useCallback(() => {
    setShowAdd(false)
    setEditBill(null)
    setFormErr('')
    setForm(createInitialBillForm())
  }, [])

  const dismissAddBillSheet = useCallback(() => {
    if (addSaving) return
    closeAddBillSheet()
  }, [addSaving, closeAddBillSheet])

  const addBillSheetRef = useOverlayFocusTrap(showAdd, {
    onClose: dismissAddBillSheet,
    initialFocusSelector: 'input[name="bill-description"]',
  })

  const visiblePending = useMemo(() => pending.filter((bill) => !hiddenBillIds.has(bill.id)), [pending, hiddenBillIds])
  const visiblePaid = useMemo(() => paid.filter((bill) => !hiddenBillIds.has(bill.id)), [paid, hiddenBillIds])

  const totalPending = useMemo(() => visiblePending.reduce((s, b) => s + +b.amount, 0), [visiblePending])
  const dueSoonAmount = useMemo(() => visiblePending
    .filter((bill) => {
      const days = safeDaysUntilDate(bill.due_date)
      return days !== null && days <= 7
    })
    .reduce((s, b) => s + +b.amount, 0), [visiblePending])
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
      amount: rows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
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
    enabled: billRows.length > 18,
    resetKey: `${tab}:${billRows.length}`,
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
    try {
      const hidden = localStorage.getItem(BILLS_GUIDE_HINT_KEY) === '1'
      if (hidden) setShowGuideHint(false)
    } catch {
      // no-op
    }
  }, [])

  useEffect(() => {
    if (tabSource) {
      setTab(tabFromQuery)
      const next = new URLSearchParams(searchParams)
      next.delete(tabSource)
      setSearchParams(next, { replace: true })
    }
  }, [tabFromQuery, tabSource, searchParams, setSearchParams])

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current)
        undoTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (!focusBillId) return

    const focusIndex = billRows.findIndex((bill) => bill.id === focusBillId)
    if (focusIndex < 0) return

    scrollBillToIndex(focusIndex, { behavior: 'smooth', block: 'center' })

    setHighlightedBillId(focusBillId)
    setTimeout(() => {
      const el = document.getElementById(`bill-${focusBillId}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 70)

    const timeoutId = setTimeout(() => setHighlightedBillId(null), 2400)

    const next = new URLSearchParams(searchParams)
    next.delete('focus')
    setSearchParams(next, { replace: true })

    return () => clearTimeout(timeoutId)
  }, [focusBillId, billRows, scrollBillToIndex, searchParams, setSearchParams])

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
        setErrToast(`No ${tab} bills to export.`)
        setTimeout(() => setErrToast(null), 4000)
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
      const date = new Date().toISOString().slice(0, 10)
      downloadCsv(`kosha-${tab}-bills-${date}.csv`, csv)
    } catch (e) {
      setErrToast(e.message || 'Could not export bills CSV.')
      setTimeout(() => setErrToast(null), 4000)
    }
  }

  async function handleAdd() {
    if (!form.description.trim()) { setFormErr('Enter a description'); return }
    if (!form.amount || !Number.isFinite(+form.amount) || +form.amount <= 0) { setFormErr('Enter a valid positive amount'); return }
    if (!form.due_date) { setFormErr('Select a due date'); return }

    const billData = {
      description: form.description.trim(),
      amount: +form.amount,
      due_date: form.due_date,
      is_recurring: form.is_recurring,
      recurrence: form.is_recurring ? form.recurrence : null,
      paid: false,
    }

    setFormErr('')
    setAddSaving(true)

    if (editBill) {
      try {
        await updateLiabilityMutation(editBill.id, billData)
        setTab('pending')
        setAddSaving(false)
        closeAddBillSheet()
      } catch (e) {
        setAddSaving(false)
        setErrToast(e.message || 'Could not update bill. Check your connection.')
      }
      return
    }

    try {
      await addLiabilityMutation(billData)

      setTab('pending')
      setAddSaving(false)
      closeAddBillSheet()
    } catch (e) {
      setAddSaving(false)
      setErrToast(e.message || 'Could not add bill. Check your connection.')
    }
  }

  async function handleMarkPaid(bill) {
    if (!bill?.id || payingId) return
    setPayingId(bill.id)
    try {
      await markLiabilityPaidMutation(bill)
      setPayingId(null)
    } catch (e) {
      setPayingId(null)
      setErrToast(e.message || 'Could not mark bill as paid. Check your connection.')
    }
  }

  async function handleDelete(id) {
    if (!id || payingId || deletingId) return
    const sourceRows = tab === 'pending' ? pending : paid
    const snapshot = sourceRows.find((bill) => bill.id === id)

    setDeletingId(id)
    setHiddenBillIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
    try {
      await deleteLiabilityMutation(id)

      if (snapshot) {
        if (undoTimerRef.current) {
          clearTimeout(undoTimerRef.current)
          undoTimerRef.current = null
        }

        setUndoBill(snapshot)
        setUndoToast(`Deleted "${snapshot.description}".`)

        undoTimerRef.current = setTimeout(() => {
          setUndoToast(null)
          setUndoBill(null)
          undoTimerRef.current = null
        }, 6000)
      }
    } catch (e) {
      setHiddenBillIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setErrToast(e.message || 'Could not delete bill. Check your connection.')
    } finally {
      setDeletingId(null)
    }
  }

  const handleUndoDelete = useCallback(async () => {
    if (!undoBill) return

    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current)
      undoTimerRef.current = null
    }

    try {
      await addLiabilityMutation({
        description: undoBill.description || '',
        amount: Number(undoBill.amount || 0),
        due_date: undoBill.due_date || null,
        is_recurring: !!undoBill.is_recurring,
        recurrence: undoBill.is_recurring ? (undoBill.recurrence || 'monthly') : null,
        paid: !!undoBill.paid,
        linked_transaction_id: undoBill.linked_transaction_id || null,
      })

      setUndoToast(null)
      setUndoBill(null)
      setErrToast('Bill restored.')
      setTimeout(() => setErrToast(null), 2600)
    } catch (error) {
      setUndoToast(null)
      setErrToast(error?.message || 'Could not restore bill.')
      setTimeout(() => setErrToast(null), 3600)
    }
  }, [undoBill])

  function openEditBill(bill) {
    setEditBill(bill)
    setForm({
      description: bill.description || '',
      amount: String(bill.amount || ''),
      due_date: bill.due_date || '',
      is_recurring: !!bill.is_recurring,
      recurrence: bill.recurrence || 'monthly',
    })
    setFormErr('')
    setShowAdd(true)
  }

  function dismissGuideHint() {
    setShowGuideHint(false)
    try {
      localStorage.setItem(BILLS_GUIDE_HINT_KEY, '1')
    } catch {
      // no-op
    }
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
          {totalBills > 0 && (
            <Button
              variant="secondary"
              size="sm"
              icon={<Download size={14} />}
              onClick={handleExportCsv}
            >
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

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div className="mb-2.5 grid grid-cols-2 gap-2">
        <button
          onClick={() => setTab('pending')}
          className={`h-9 sm:h-10 w-full rounded-card text-[11px] sm:text-[12px] font-semibold transition-all duration-100 active:scale-[0.97]
            ${tab === 'pending'
              ? 'bg-brand-container text-brand border border-brand shadow-card'
              : 'bg-kosha-surface text-ink-3 border border-kosha-border'}`}
        >
          Pending ({visiblePending.length})
        </button>
        <button
          onClick={() => setTab('paid')}
          className={`h-9 sm:h-10 w-full rounded-card text-[11px] sm:text-[12px] font-semibold transition-all duration-100 active:scale-[0.97]
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
                  transition={{ duration: 0.6, ease: 'easeOut' }}
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
          <div className="card p-3.5 sm:p-4">
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
                icon={<Check size={24} className="text-income-text" />}
                title="You're all clear"
                description="No pending bills right now. Add recurring dues to keep reminders and cashflow planning accurate."
                actionLabel="Add a bill"
                onAction={() => setShowAdd(true)}
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
                title="No paid bills yet"
                description="Bills you mark as paid will show up here for history and tracking."
                actionLabel="View pending"
                onAction={() => setTab('pending')}
              />
            )}

            {/* ── Bill cards ── */}
            <div ref={billListRef} className="space-y-2.5">
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
                            {tab === 'pending' ? (
                              <span className={`text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-pill ${chipCls}`}>
                                {dueLabel(days)}
                              </span>
                            ) : (
                              <span className="text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-pill bg-kosha-surface-2 text-ink-3 border border-kosha-border">
                                Paid {fmtDate(bill.due_date)}
                              </span>
                            )}
                            {bill.is_recurring && (
                              <span className="text-[10px] sm:text-[11px] text-ink-3 capitalize">{bill.recurrence}</span>
                            )}
                            {(bill.__optimistic || String(bill.id || '').startsWith('optimistic-')) && (
                              <span className="text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 rounded-pill bg-warning-bg text-warning-text">
                                Syncing...
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 shrink-0">
                          {tab === 'pending' && (
                            <>
                              <Button
                                onClick={() => openEditBill(bill)}
                                disabled={!!payingId || !!deletingId || !!bill.__optimistic}
                                variant="secondary"
                                size="sm"
                                icon={<Pencil size={13} />}
                              >
                                Edit
                              </Button>
                              <Button
                                onClick={() => handleMarkPaid(bill)}
                                disabled={!!payingId || !!deletingId || !!bill.__optimistic}
                                variant="success"
                                size="sm"
                                icon={payingId === bill.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                              >
                                {payingId === bill.id ? 'Paying…' : 'Paid'}
                              </Button>
                            </>
                          )}
                          <Button
                            onClick={() => handleDelete(bill.id)}
                            disabled={!!payingId || !!deletingId || !!bill.__optimistic}
                            variant="danger"
                            size="sm"
                            icon={deletingId === bill.id ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                          >
                            {deletingId === bill.id ? 'Deleting…' : 'Delete'}
                          </Button>
                        </div>
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
      <AnimatePresence>
        {showAdd && (
          <>
            <motion.div className="sheet-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }}
              onClick={dismissAddBillSheet}
            />
            <motion.div
              ref={addBillSheetRef}
              className="sheet-panel"
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-label={editBill ? 'Edit bill' : 'Add bill'}
              initial={{ y: '100%' }}
              animate={{ y: 0, transition: { type: 'spring', stiffness: 400, damping: 32 } }}
              exit={{ y: '100%', transition: { duration: 0.22 } }}
            >
              <div className="sheet-handle" />
              <div className="px-5 overflow-x-hidden">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-display font-bold text-ink">{editBill ? 'Edit Bill' : 'Add Bill'}</h2>
                  <button
                    type="button"
                    aria-label="Close add bill sheet"
                    onClick={dismissAddBillSheet}
                    className="close-btn"
                  >
                    <X size={16} className="text-ink-3" />
                  </button>
                </div>

                <input
                  className="input mb-3"
                  name="bill-description"
                  placeholder="Description (e.g. Car EMI)"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />

                <div className="bg-transparent px-1 py-2 mb-3 overflow-hidden
                                flex items-center gap-2 border-b-2 border-kosha-border
                                transition-all duration-200">
                  <span className="text-xl font-bold text-brand">₹</span>
                  <input className="flex-1 bg-transparent text-2xl font-bold text-ink outline-none min-w-0"
                    type="number" inputMode="decimal" name="bill-amount" placeholder="0"
                    value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>

                <div className="list-card mb-3">
                  <div className="list-row w-full">
                    <div className="w-8 h-8 rounded-chip bg-kosha-surface-2 border border-kosha-border flex items-center justify-center shrink-0">
                      <CalendarDays size={14} className="text-brand" />
                    </div>
                    <span className="flex-1 text-[15px] text-ink">Due Date</span>
                    <PixelDatePicker
                      name="bill-due-date"
                      value={form.due_date}
                      onChange={(nextDate) => setForm(f => ({ ...f, due_date: nextDate }))}
                      sheetTitle="Select due date"
                      disabled={addSaving}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, is_recurring: !f.is_recurring }))}
                    className={`flex items-center gap-2 px-3 py-2 rounded-card text-sm font-medium
                                border transition-all
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
                          className={`px-3 py-1.5 rounded-pill text-xs font-semibold border capitalize transition-all
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
                    loading={addSaving}
                  >
                    {addSaving ? (editBill ? 'Saving…' : 'Adding…') : (editBill ? 'Save Changes' : 'Add Bill')}
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* FAB */}
      {!embedded && (
        <button className="fab-bills" aria-label="Add bill" onClick={() => setShowAdd(true)}>
          <Plus size={24} className="text-white" />
        </button>
      )}

      <AppToast
        message={undoToast || errToast}
        onDismiss={() => {
          setUndoToast(null)
          setUndoBill(null)
          setErrToast(null)
          if (undoTimerRef.current) {
            clearTimeout(undoTimerRef.current)
            undoTimerRef.current = null
          }
        }}
        action={undoToast && undoBill ? () => { void handleUndoDelete() } : undefined}
        actionLabel="Undo"
      />

    </PageHeaderPage>
  )
}
