import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, SlidersHorizontal, Plus, Download, BookOpen, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react'
import {
  useTransactions,
  removeTransactionMutation,
  useDebounce,
} from '../hooks/useTransactions'
import TransactionItem from '../components/transactions/TransactionItem'
import AddTransactionSheet from '../components/transactions/AddTransactionSheet'
import CreateCategorySheet from '../components/categories/CreateCategorySheet'
import EmptyState from '../components/common/EmptyState'
import FilterRow from '../components/common/FilterRow'
import AppToast from '../components/common/AppToast'
import { CATEGORIES, PAYMENT_MODES, getCategoriesForType } from '../lib/categories'
import { supabase } from '../lib/supabase'
import { groupByDate, dateLabel, fmt } from '../lib/utils'
import { bandTextClass, scoreHealthBand, scoreRiskBand } from '../lib/insightBands'
import { downloadCsv, toCsv } from '../lib/csv'
import { MONTH_SHORT } from '../lib/constants'
import PageHeaderPage from '../components/layout/PageHeaderPage'
import SectionHeader from '../components/common/SectionHeader'
import { getAuthUserId } from '../lib/authStore'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import SkeletonLayout from '../components/common/SkeletonLayout'
import Button from '../components/ui/Button'
import useWindowedList from '../hooks/useWindowedList'

const TXN_GUIDE_HINT_KEY = 'kosha:dismiss-guide-transactions-v1'
const SWIPE_HINT_DISMISSED_KEY = 'kosha:swipe-delete-hint-dismissed-v1'
const SWIPE_HINT_LEARNED_KEY = 'kosha:swipe-delete-hint-learned-v1'
const SWIPE_HINT_NUDGED_KEY = 'kosha:swipe-delete-hint-nudged-v1'

const TYPES = [
  { id: 'all',        label: 'All'      },
  { id: 'expense',    label: 'Expenses' },
  { id: 'income',     label: 'Income'   },
  { id: 'investment', label: 'Invest'   },
]

const DATE_PRESETS = [
  { id: 'all', label: 'All time' },
  { id: '7d', label: 'Last 7d' },
  { id: 'month', label: 'This month' },
  { id: 'prev-month', label: 'Last month' },
  { id: 'custom-month', label: 'Specific month' },
]

const MONTH_FILTER_MIN_YEAR = 1900
const MONTH_FILTER_MAX_YEAR = 2100

function monthInputFromDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function parseMonthInput(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})$/)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null

  return { year, month }
}

function formatMonthInputLabel(value) {
  const parsed = parseMonthInput(value)
  if (!parsed) return 'Specific month'

  return new Date(parsed.year, parsed.month - 1, 1).toLocaleString(undefined, {
    month: 'short',
    year: 'numeric',
  })
}

function parseIsoDateInput(value) {
  const trimmed = String(value || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null

  const [year, month, day] = trimmed.split('-').map(Number)
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null

  const date = new Date(`${trimmed}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  if (date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day) return null

  return trimmed
}

function formatIsoDateLabel(value) {
  const parsed = parseIsoDateInput(value)
  if (!parsed) return 'Custom range'

  return new Date(`${parsed}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const TYPE_CHIP = {
  all:        'bg-brand text-brand-on border-brand',
  expense:    'bg-expense-bg text-expense-text border-expense-border',
  income:     'bg-income-bg text-income-text border-income-border',
  investment: 'bg-invest-bg text-invest-text border-invest-border',
}

function groupNet(txns) {
  return txns.reduce((s, t) =>
    t.type === 'income' ? s + +t.amount : s - +t.amount, 0)
}

export default function Transactions() {
  const navigate = useNavigate()
  const location = useLocation()
  const [typeFilter,    setTypeFilter]    = useState('all')
  const [catFilter,     setCatFilter]     = useState('')
  const [paymentModeFilter, setPaymentModeFilter] = useState('')
  const [search,        setSearch]        = useState('')
  const [showAdd,       setShowAdd]       = useState(false)
  const [editTxn,       setEditTxn]       = useState(null)
  const [showCats,      setShowCats]      = useState(false)
  const [showPaymentModes, setShowPaymentModes] = useState(false)
  const [addType,       setAddType]       = useState('expense')
  const [datePreset,    setDatePreset]    = useState('all')
  const [selectedMonth, setSelectedMonth] = useState(() => monthInputFromDate())
  const [forcedDateRange, setForcedDateRange] = useState(null)
  const [displayCount,  setDisplayCount]  = useState(50)
  const [toast,         setToast]         = useState(null)
  const [duplicateTxn,  setDuplicateTxn]  = useState(null)
  const [highlightedTxnId, setHighlightedTxnId] = useState(null)
  const [showGuideHint, setShowGuideHint] = useState(true)
  const [showSwipeHint, setShowSwipeHint] = useState(false)
  const [triggerSwipeNudge, setTriggerSwipeNudge] = useState(false)
  const [showCreateCategory, setShowCreateCategory] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const categoryPanelRef = useRef(null)
  const paymentPanelRef = useRef(null)
  const categoryTriggerRef = useRef(null)
  const paymentTriggerRef = useRef(null)

  const debouncedSearch = useDebounce(search, 300)
  const isSearchDebouncing = search !== debouncedSearch

  function handleDatePreset(nextPreset) {
    setDatePreset(nextPreset)
    setForcedDateRange(null)
    if (nextPreset === 'custom-month' && !parseMonthInput(selectedMonth)) {
      setSelectedMonth(monthInputFromDate())
    }
    setDisplayCount(50)
  }

  const selectedMonthParts = useMemo(
    () => parseMonthInput(selectedMonth)
      || parseMonthInput(monthInputFromDate())
      || { year: new Date().getFullYear(), month: new Date().getMonth() + 1 },
    [selectedMonth]
  )

  const monthFilterYearOptions = useMemo(() => {
    const options = []
    for (let optionYear = MONTH_FILTER_MAX_YEAR; optionYear >= MONTH_FILTER_MIN_YEAR; optionYear -= 1) {
      options.push(optionYear)
    }
    return options
  }, [])

  function updateSelectedMonth(nextYear, nextMonth) {
    const safeYear = Math.min(
      MONTH_FILTER_MAX_YEAR,
      Math.max(MONTH_FILTER_MIN_YEAR, Number(nextYear) || selectedMonthParts.year)
    )
    const safeMonth = Math.min(12, Math.max(1, Number(nextMonth) || selectedMonthParts.month))

    setSelectedMonth(`${safeYear}-${String(safeMonth).padStart(2, '0')}`)
    setForcedDateRange(null)
    setDisplayCount(50)
  }

  const presetDateRange = useMemo(() => {
    const now = new Date()
    const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

    if (datePreset === '7d') {
      const start = new Date(now)
      start.setDate(now.getDate() - 6)
      return { startDate: toISO(start), endDate: toISO(now) }
    }

    if (datePreset === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { startDate: toISO(start), endDate: toISO(end) }
    }

    if (datePreset === 'prev-month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      return { startDate: toISO(start), endDate: toISO(end) }
    }

    if (datePreset === 'custom-month') {
      const parsed = parseMonthInput(selectedMonth)
      if (!parsed) return { startDate: undefined, endDate: undefined }

      const start = new Date(parsed.year, parsed.month - 1, 1)
      const end = new Date(parsed.year, parsed.month, 0)
      return { startDate: toISO(start), endDate: toISO(end) }
    }

    return { startDate: undefined, endDate: undefined }
  }, [datePreset, selectedMonth])

  const startDate = forcedDateRange?.startDate || presetDateRange.startDate
  const endDate = forcedDateRange?.endDate || presetDateRange.endDate
  const filterCategories = useMemo(
    () => getCategoriesForType(typeFilter === 'all' ? undefined : typeFilter),
    [typeFilter]
  )
  const getCategoryLabel = useCallback((categoryId) => {
    if (!categoryId) return 'All categories'

    const pools = [
      ...getCategoriesForType('expense'),
      ...getCategoriesForType('income'),
      ...getCategoriesForType('investment'),
      ...CATEGORIES,
    ]

    const found = pools.find((item) => item.id === categoryId)
    return found?.label || 'Custom category'
  }, [])

  // FIX (defect 5.2): Replaced the useEffect that called setDisplayCount(50)
  // when debouncedSearch/typeFilter/catFilter changed. That caused a triple
  // render cascade per search keystroke:
  //   render 1 → search changes
  //   render 2 → debouncedSearch updates (from useDebounce's internal effect)
  //   render 3 → setDisplayCount(50) from useEffect fires
  //
  // Fix: pass displayCount into the query key directly. When typeFilter or
  // catFilter changes, reset displayCount in the same event handler that
  // updates the filter — one state update, one render. Search keystrokes
  // only trigger the debounce timer and then one re-render when it fires.
  // No useEffect needed.

  function handleTypeFilter(id) {
    setTypeFilter(id)
    const nextCategories = getCategoriesForType(id === 'all' ? undefined : id)
    const isCurrentCategoryAllowed = !catFilter || nextCategories.some((cat) => cat.id === catFilter)
    if (!isCurrentCategoryAllowed) setCatFilter('')
    setDisplayCount(50)   // reset in same event — single re-render
  }

  function handleCatFilter(id) {
    setCatFilter(id)
    setDisplayCount(50)   // reset in same event — single re-render
  }

  function handlePaymentModeFilter(id) {
    setPaymentModeFilter(id)
    setDisplayCount(50)
  }

  const { data, total, loading: txnLoading } = useTransactions({
    type:      typeFilter === 'all' ? undefined : typeFilter,
    category:  catFilter || undefined,
    paymentMode: paymentModeFilter || undefined,
    search:    debouncedSearch || undefined,
    startDate,
    endDate,
    limit:     displayCount,
    withCount: true,
  })

  const groups = useMemo(() => {
    const grouped = groupByDate(data)
    return grouped.map(([dateKey, txns]) => [dateKey, txns, groupNet(txns)])
  }, [data])

  const timelineRows = useMemo(() => {
    const rows = []
    groups.forEach(([dateKey, txns, net], groupIndex) => {
      txns.forEach((txn, txnIndex) => {
        rows.push({
          txn,
          dateKey,
          net,
          groupIndex,
          isGroupFirst: txnIndex === 0,
          isGroupLast: txnIndex === txns.length - 1,
        })
      })
    })
    return rows
  }, [groups])

  const {
    containerRef: timelineRowListRef,
    startIndex: timelineRowStartIndex,
    endIndex: timelineRowEndIndex,
    topPadding: timelineRowTopPadding,
    bottomPadding: timelineRowBottomPadding,
    measureElement: measureTimelineRow,
    scrollToIndex: scrollTimelineRowToIndex,
  } = useWindowedList({
    count: timelineRows.length,
    estimateSize: 88,
    overscan: 10,
    enabled: timelineRows.length > 40,
    resetKey: `${typeFilter}:${catFilter}:${paymentModeFilter}:${datePreset}:${startDate || 'na'}:${endDate || 'na'}:${debouncedSearch}:${displayCount}`,
    initialCount: 36,
  })

  const renderedTimelineRows = useMemo(
    () => timelineRows.slice(timelineRowStartIndex, timelineRowEndIndex),
    [timelineRows, timelineRowStartIndex, timelineRowEndIndex]
  )

  const hasMore = useMemo(() => total > data.length, [total, data.length])
  const focusTxnId = searchParams.get('focus')
  const hasActiveFilters = typeFilter !== 'all' || !!catFilter || !!paymentModeFilter || datePreset !== 'all' || !!forcedDateRange || !!debouncedSearch
  const activeDatePresetLabel = useMemo(
    () => {
      if (forcedDateRange?.startDate && forcedDateRange?.startDate === forcedDateRange?.endDate) {
        return formatIsoDateLabel(forcedDateRange.startDate)
      }

      if (forcedDateRange?.startDate && forcedDateRange?.endDate) {
        return `${formatIsoDateLabel(forcedDateRange.startDate)} - ${formatIsoDateLabel(forcedDateRange.endDate)}`
      }

      if (datePreset === 'custom-month') return formatMonthInputLabel(selectedMonth)
      return DATE_PRESETS.find((preset) => preset.id === datePreset)?.label || 'All time'
    },
    [datePreset, selectedMonth, forcedDateRange]
  )
  const activeCategoryLabel = useMemo(
    () => getCategoryLabel(catFilter),
    [catFilter, getCategoryLabel]
  )
  const activePaymentModeLabel = useMemo(
    () => (paymentModeFilter ? PAYMENT_MODES.find((item) => item.id === paymentModeFilter)?.label || 'Custom mode' : 'All payment modes'),
    [paymentModeFilter]
  )
  const categoryLabelById = useMemo(
    () => new Map(CATEGORIES.map((category) => [category.id, category.label])),
    []
  )
  const paymentModeLabelById = useMemo(
    () => new Map(PAYMENT_MODES.map((mode) => [mode.id, mode.label])),
    []
  )
  const visibleSummary = useMemo(() => {
    return data.reduce((acc, txn) => {
      const amount = Number(txn?.amount || 0)
      if (!Number.isFinite(amount) || amount <= 0) return acc

      if (txn.type === 'income') {
        acc.income += amount
        acc.net += amount
      } else {
        acc.outflow += amount
        acc.net -= amount
      }
      return acc
    }, { income: 0, outflow: 0, net: 0 })
  }, [data])

  const timelineActivitySignal = useMemo(() => {
    if (data.length < 2) return null

    const dateValues = data
      .map((txn) => String(txn?.date || '').trim())
      .filter(Boolean)

    if (!dateValues.length) return null

    const activeDays = new Set(dateValues).size

    let spanDays = 1
    if (startDate && endDate) {
      const fromTs = new Date(`${startDate}T00:00:00`).getTime()
      const toTs = new Date(`${endDate}T00:00:00`).getTime()
      if (Number.isFinite(fromTs) && Number.isFinite(toTs)) {
        spanDays = Math.max(1, Math.floor((toTs - fromTs) / (24 * 60 * 60 * 1000)) + 1)
      }
    } else {
      const parsed = dateValues
        .map((value) => new Date(`${value}T00:00:00`).getTime())
        .filter((value) => Number.isFinite(value))
      if (parsed.length > 0) {
        spanDays = Math.max(1, Math.floor((Math.max(...parsed) - Math.min(...parsed)) / (24 * 60 * 60 * 1000)) + 1)
      } else {
        spanDays = Math.max(1, activeDays)
      }
    }

    const densityPct = Math.round((activeDays / spanDays) * 100)
    const txnsPerActiveDay = data.length / Math.max(1, activeDays)
    const band = scoreHealthBand(densityPct, { healthy: 65, watch: 35 })

    return { activeDays, spanDays, densityPct, txnsPerActiveDay, band }
  }, [data, startDate, endDate])

  const paymentModeSignal = useMemo(() => {
    if (!data.length) return null

    const counts = new Map()
    for (const txn of data) {
      const mode = String(txn?.payment_mode || 'other')
      counts.set(mode, (counts.get(mode) || 0) + 1)
    }

    const rows = [...counts.entries()]
      .map(([mode, count]) => ({
        mode,
        label: paymentModeLabelById.get(mode) || 'Other',
        count,
        pct: Math.round((count / data.length) * 100),
      }))
      .sort((a, b) => b.count - a.count)

    if (!rows.length) return null

    const topPct = rows[0]?.pct || 0

    return {
      top: rows[0],
      secondary: rows[1] || null,
      band: scoreRiskBand(topPct, { high: 72, watch: 55 }),
    }
  }, [data, paymentModeLabelById])

  const expenseFrequencySignal = useMemo(() => {
    const expenseRows = data.filter((txn) => txn?.type === 'expense')
    if (expenseRows.length < 3) return null

    const counts = new Map()
    for (const txn of expenseRows) {
      const categoryId = String(txn?.category || 'other')
      counts.set(categoryId, (counts.get(categoryId) || 0) + 1)
    }

    const rows = [...counts.entries()]
      .map(([categoryId, count]) => ({
        categoryId,
        label: categoryLabelById.get(categoryId) || 'Other',
        count,
      }))
      .sort((a, b) => b.count - a.count)

    if (!rows.length) return null

    const topThreeCount = rows.slice(0, 3).reduce((sum, row) => sum + row.count, 0)
    const concentrationPct = Math.round((topThreeCount / expenseRows.length) * 100)

    return {
      top: rows[0],
      concentrationPct,
      expenseCount: expenseRows.length,
      band: scoreRiskBand(concentrationPct, { high: 72, watch: 56 }),
    }
  }, [data, categoryLabelById])

  useEffect(() => {
    try {
      const hidden = localStorage.getItem(TXN_GUIDE_HINT_KEY) === '1'
      if (hidden) setShowGuideHint(false)
    } catch {
      // no-op
    }
  }, [])

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(SWIPE_HINT_DISMISSED_KEY) === '1'
      const learned = localStorage.getItem(SWIPE_HINT_LEARNED_KEY) === '1'
      const nudged = localStorage.getItem(SWIPE_HINT_NUDGED_KEY) === '1'

      setShowSwipeHint(!dismissed && !learned)
      setTriggerSwipeNudge(!nudged)
    } catch {
      setShowSwipeHint(true)
      setTriggerSwipeNudge(true)
    }
  }, [])

  useEffect(() => {
    let shouldResetCount = false
    const validTypeIds = new Set(TYPES.map((item) => item.id))

    const monthParam = searchParams.get('month')
    const parsed = parseMonthInput(monthParam)
    if (parsed) {
      const normalizedMonth = `${parsed.year}-${String(parsed.month).padStart(2, '0')}`
      setSelectedMonth(normalizedMonth)
      setDatePreset('custom-month')
      shouldResetCount = true
    }

    const typeParam = String(searchParams.get('type') || '').trim()
    const hasValidType = validTypeIds.has(typeParam)
    if (hasValidType) {
      setTypeFilter(typeParam)
      shouldResetCount = true
    }

    const categoryParam = String(searchParams.get('category') || '').trim()
    if (categoryParam) {
      if (!hasValidType) {
        setTypeFilter('all')
      }
      setCatFilter(categoryParam)
      shouldResetCount = true
    }

    if (searchParams.has('q')) {
      const queryParam = String(searchParams.get('q') || '').trim()
      setSearch(queryParam)
      shouldResetCount = true
    }

    if (searchParams.has('day')) {
      const dayParam = parseIsoDateInput(searchParams.get('day'))
      if (dayParam) {
        setForcedDateRange({ startDate: dayParam, endDate: dayParam })
        setDatePreset('all')
        shouldResetCount = true
      } else {
        setForcedDateRange(null)
      }
    } else {
      setForcedDateRange(null)
    }

    if (shouldResetCount) {
      setDisplayCount(50)
    }
  }, [searchParams])

  useEffect(() => {
    if (!showCats && !showPaymentModes) return

    function handlePointerDown(event) {
      const target = event.target
      if (!(target instanceof Node)) return

      const insideCategory =
        categoryPanelRef.current?.contains(target) ||
        categoryTriggerRef.current?.contains(target)
      const insidePayment =
        paymentPanelRef.current?.contains(target) ||
        paymentTriggerRef.current?.contains(target)

      if (!insideCategory && !insidePayment) {
        setShowCats(false)
        setShowPaymentModes(false)
      }
    }

    function handleEscape(event) {
      if (event.key !== 'Escape') return
      setShowCats(false)
      setShowPaymentModes(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [showCats, showPaymentModes])

  const focusExpandCountRef = useRef(0)

  useEffect(() => {
    if (!focusTxnId) return
    focusExpandCountRef.current = 0
  }, [focusTxnId])

  useEffect(() => {
    if (!focusTxnId) return

    const found = data.find(t => t.id === focusTxnId)
    if (!found) {
      if (hasMore && focusExpandCountRef.current < 10) {
        focusExpandCountRef.current += 1
        setDisplayCount(n => n + 100)
      }
      return
    }

    const focusRowIndex = timelineRows.findIndex((row) => row.txn.id === focusTxnId)
    if (focusRowIndex >= 0) {
      scrollTimelineRowToIndex(focusRowIndex, { behavior: 'smooth', block: 'center' })
    }

    setHighlightedTxnId(focusTxnId)
    setTimeout(() => {
      const el = document.getElementById(`txn-${focusTxnId}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 70)

    const timeoutId = setTimeout(() => setHighlightedTxnId(null), 2400)

    const next = new URLSearchParams(searchParams)
    next.delete('focus')
    setSearchParams(next, { replace: true })

    return () => clearTimeout(timeoutId)
  }, [focusTxnId, data, hasMore, timelineRows, scrollTimelineRowToIndex, searchParams, setSearchParams])

  const handleDelete = useCallback(async (id) => {
    if (!id) return false
    try {
      await removeTransactionMutation(id)
      return true
    } catch (e) {
      setToast(e.message || 'Could not delete transaction.')
      setTimeout(() => setToast(null), 4000)
      throw e
    }
  }, [])

  const inferRepaymentTab = useCallback((txn, loanRow = null) => {
    if (loanRow?.settled) return 'settled'
    if (loanRow?.direction === 'taken') return 'taken'
    if (loanRow?.direction === 'given') return 'given'
    if (txn?.type === 'expense') return 'taken'
    if (txn?.type === 'income') return 'given'
    return null
  }, [])

  const extractRepaymentCounterparty = useCallback((txn) => {
    const description = String(txn?.description || '')
    const notes = String(txn?.notes || '')
    const counterpartyMatch =
      description.match(/^loan payment:\s*(.+)$/i) ||
      notes.match(/payment\s+(?:received\s+from|made\s+to)\s+(.+)$/i)

    return counterpartyMatch?.[1]?.trim() || ''
  }, [])

  const repaymentLoanRoute = useCallback((txn) => {
    const params = new URLSearchParams()

    if (txn?.id) params.set('repaymentTxn', String(txn.id))
    const routeLoanId = txn?.loan_id
    if (routeLoanId) params.set('repaymentLoan', String(routeLoanId))

    const routeTab = inferRepaymentTab(txn)
    if (routeTab) params.set('repaymentTab', routeTab)

    if (txn?.type) params.set('repaymentType', String(txn.type))

    const amount = Number(txn?.amount)
    if (Number.isFinite(amount) && amount > 0) {
      params.set('repaymentAmount', String(amount))
    }

    if (txn?.date) params.set('repaymentDate', String(txn.date))

    const counterparty = extractRepaymentCounterparty(txn)
    if (counterparty) params.set('repaymentCounterparty', counterparty)

    const query = params.toString()
    return query ? `/loans?${query}` : '/loans'
  }, [extractRepaymentCounterparty, inferRepaymentTab])

  const handleTap = useCallback((t) => {
    if (t?.is_repayment) {
      setToast('Repayments are managed from Loans.')
      navigate(repaymentLoanRoute(t))
      return
    }

    setEditTxn(t)
    setDuplicateTxn(null)
    setAddType(t.type)
    setShowAdd(true)
  }, [navigate, repaymentLoanRoute])

  const handleDuplicate = useCallback((txn) => {
    setEditTxn(null)
    setDuplicateTxn(txn)
    setAddType(txn.type)
    setShowAdd(true)
  }, [])

  const exportCSV = useCallback(async () => {
    try {
      const userId = getAuthUserId()
      let q = supabase
        .from('transactions')
        .select('date, type, description, amount, category, investment_vehicle, payment_mode, notes, is_recurring, recurrence, is_auto_generated, source_transaction_id')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

      if (typeFilter !== 'all') q = q.eq('type', typeFilter)
      if (catFilter)            q = q.eq('category', catFilter)
      if (paymentModeFilter)    q = q.eq('payment_mode', paymentModeFilter)
      if (debouncedSearch)      q = q.ilike('description', `%${debouncedSearch}%`)
      if (startDate)            q = q.gte('date', startDate)
      if (endDate)              q = q.lte('date', endDate)

      const { data: exportRows, error } = await q
      if (error) throw error
      if (!exportRows?.length) {
        setToast('No transactions to export for current filters.')
        setTimeout(() => setToast(null), 3000)
        return
      }

      const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map(c => [c.id, c.label]))
      const PAYMENT_MODE_LABELS = Object.fromEntries(PAYMENT_MODES.map((mode) => [mode.id, mode.label]))
      const headers = [
        'Date',
        'Type',
        'Description',
        'Amount',
        'Category',
        'Investment Vehicle',
        'Payment Mode',
        'Notes',
        'Is Recurring',
        'Recurrence',
        'Auto Generated',
        'Source Transaction ID',
      ]
      const rows = exportRows.map(t => [
        t.date,
        t.type,
        t.description || '',
        t.amount,
        CATEGORY_LABELS[t.category] || t.category || '',
        t.investment_vehicle || '',
        t.payment_mode || '',
        t.notes || '',
        t.is_recurring ? 'yes' : 'no',
        t.recurrence || '',
        t.is_auto_generated ? 'yes' : 'no',
        t.source_transaction_id || '',
      ])

      const csv = toCsv(headers, rows)
      const filters = [
        typeFilter !== 'all' ? typeFilter : '',
        catFilter  ? (CATEGORY_LABELS[catFilter] || catFilter) : '',
        paymentModeFilter ? (PAYMENT_MODE_LABELS[paymentModeFilter] || paymentModeFilter) : '',
      ].filter(Boolean).join('-')

      const fileName = `kosha-${filters || 'transactions'}-${new Date().toISOString().slice(0, 10)}.csv`
      downloadCsv(fileName, csv)
      setToast(`Downloaded ${fileName} (${exportRows.length} rows).`)
    } catch (e) {
      setToast(e.message || 'Could not export transactions.')
      setTimeout(() => setToast(null), 4000)
    }
  }, [typeFilter, catFilter, paymentModeFilter, debouncedSearch, startDate, endDate])

  useEffect(() => {
    if (!toast) return
    const timeoutId = setTimeout(() => setToast(null), 3600)
    return () => clearTimeout(timeoutId)
  }, [toast])

  const dismissGuideHint = useCallback(() => {
    setShowGuideHint(false)
    try {
      localStorage.setItem(TXN_GUIDE_HINT_KEY, '1')
    } catch {
      // no-op
    }
  }, [])

  const dismissSwipeHint = useCallback(() => {
    setShowSwipeHint(false)
    try {
      localStorage.setItem(SWIPE_HINT_DISMISSED_KEY, '1')
    } catch {
      // no-op
    }
  }, [])

  const handleSwipeHintLearned = useCallback(() => {
    setShowSwipeHint(false)
    try {
      localStorage.setItem(SWIPE_HINT_LEARNED_KEY, '1')
    } catch {
      // no-op
    }
  }, [])

  const handleAutoNudgeDone = useCallback(() => {
    setTriggerSwipeNudge(false)
    try {
      localStorage.setItem(SWIPE_HINT_NUDGED_KEY, '1')
    } catch {
      // no-op
    }
  }, [])

  const clearAllFilters = useCallback(() => {
    setTypeFilter('all')
    setCatFilter('')
    setPaymentModeFilter('')
    setDatePreset('all')
    setSelectedMonth(monthInputFromDate())
    setForcedDateRange(null)
    setSearch('')
    setShowCats(false)
    setShowPaymentModes(false)
    setDisplayCount(50)
  }, [])

  useEffect(() => {
    if (!location.state?.openAddInvestment) return

    setEditTxn(null)
    setDuplicateTxn(null)
    setAddType('investment')
    setShowAdd(true)

    navigate(`${location.pathname}${location.search}`, { replace: true, state: null })
  }, [location.state, location.pathname, location.search, navigate])

  return (
    <PageHeaderPage title="Transactions">

      <div className="card p-0 border-0 overflow-hidden mb-3">
        <div className="px-4 pt-3.5 pb-3 bg-kosha-surface-2 border-b border-kosha-border">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-ink">Transaction workspace</p>
              <p className="text-[12px] text-ink-3 mt-0.5">Quick read of loaded timeline health before you edit rows.</p>
            </div>
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-pill border whitespace-nowrap ${
              hasActiveFilters
                ? 'bg-brand-container text-brand border-brand/20'
                : 'bg-kosha-surface text-ink-3 border-kosha-border'
            }`}>
              {hasActiveFilters ? 'Filtered view' : 'Full timeline'}
            </span>
          </div>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="mini-panel px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-ink-3">Rows</p>
              <p className="text-[15px] font-semibold tabular-nums text-ink mt-1">{data.length}/{total}</p>
              <p className="text-[10px] text-ink-3 mt-0.5">Loaded / matching</p>
            </div>
            <div className="mini-panel px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-ink-3">Range</p>
              <p className="text-[13px] font-semibold text-ink mt-1 truncate">{activeDatePresetLabel}</p>
              <p className="text-[10px] text-ink-3 mt-0.5">Timeline window</p>
            </div>
            <div className="mini-panel px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-ink-3">Income</p>
              <p className="text-[13px] font-semibold tabular-nums text-income-text mt-1">{fmt(visibleSummary.income)}</p>
              <p className="text-[10px] text-ink-3 mt-0.5">Loaded rows</p>
            </div>
            <div className="mini-panel px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-ink-3">Net flow</p>
              <p className={`text-[13px] font-semibold tabular-nums mt-1 ${visibleSummary.net >= 0 ? 'text-income-text' : 'text-expense-text'}`}>
                {visibleSummary.net >= 0 ? '+' : '-'}{fmt(Math.abs(visibleSummary.net))}
              </p>
              <p className="text-[10px] text-ink-3 mt-0.5">Income - outflow</p>
            </div>
          </div>

          {(timelineActivitySignal || paymentModeSignal || expenseFrequencySignal) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-2.5">
              {timelineActivitySignal && (
                <div className="mini-panel px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-ink-3">Activity density</p>
                  <p className="text-[13px] font-semibold text-ink mt-1 tabular-nums">
                    {timelineActivitySignal.txnsPerActiveDay.toFixed(1)} txns / active day
                  </p>
                  <p className="text-[10px] text-ink-3 mt-0.5">
                    {timelineActivitySignal.activeDays}/{timelineActivitySignal.spanDays} days active ({timelineActivitySignal.densityPct}%)
                  </p>
                  <p className={`text-[10px] font-semibold mt-1 ${bandTextClass(timelineActivitySignal.band)}`}>
                    {timelineActivitySignal.band === 'healthy' ? 'Frequent logging' : timelineActivitySignal.band === 'watch' ? 'Steady logging' : 'Sparse logging'}
                  </p>
                </div>
              )}

              {paymentModeSignal && (
                <div className="mini-panel px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-ink-3">Payment mode mix</p>
                  <p className={`text-[13px] font-semibold mt-1 ${bandTextClass(paymentModeSignal.band, 'text-ink')}`}>
                    {paymentModeSignal.top.label}
                  </p>
                  <p className="text-[10px] text-ink-3 mt-0.5 tabular-nums">
                    {paymentModeSignal.top.pct}% of visible rows ({paymentModeSignal.top.count})
                  </p>
                  {paymentModeSignal.secondary && (
                    <p className="text-[10px] text-ink-3 mt-1">
                      Next: {paymentModeSignal.secondary.label} ({paymentModeSignal.secondary.pct}%)
                    </p>
                  )}
                </div>
              )}

              {expenseFrequencySignal && (
                <div className="mini-panel px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-ink-3">Expense frequency</p>
                  <p className="text-[13px] font-semibold text-ink mt-1 truncate" title={expenseFrequencySignal.top.label}>
                    {expenseFrequencySignal.top.label}
                  </p>
                  <p className="text-[10px] text-ink-3 mt-0.5 tabular-nums">
                    {expenseFrequencySignal.top.count} of {expenseFrequencySignal.expenseCount} expense rows
                  </p>
                  <p className={`text-[10px] mt-1 tabular-nums ${bandTextClass(expenseFrequencySignal.band, 'text-ink-3')}`}>
                    Top-3 categories cover {expenseFrequencySignal.concentrationPct}%
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="chip-control chip-control-sm bg-kosha-surface text-ink-2 border-kosha-border">{activeCategoryLabel}</span>
            <span className="chip-control chip-control-sm bg-kosha-surface text-ink-2 border-kosha-border">{activePaymentModeLabel}</span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => {
                setEditTxn(null)
                setDuplicateTxn(null)
                setAddType('expense')
                setShowAdd(true)
              }}
            >
              Add transaction
            </Button>

            {total > 0 ? (
              <Button
                variant="secondary"
                size="sm"
                icon={<Download size={14} />}
                onClick={exportCSV}
              >
                Export CSV
              </Button>
            ) : null}

            {hasActiveFilters ? (
              <button
                type="button"
                onClick={clearAllFilters}
                className="chip-control chip-control-sm bg-kosha-surface text-ink-2 border-kosha-border hover:bg-kosha-surface-2"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="card p-0 border-0 overflow-hidden mb-3">
        <div className="px-4 pt-3.5 pb-3 border-b border-kosha-border bg-kosha-surface-2">
          <p className="text-[15px] font-semibold text-ink">Find and filter</p>
          <p className="text-[12px] text-ink-3 mt-0.5">Search by merchant or note, then narrow by date, type, category, and payment mode.</p>

          <div className="relative mt-3">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
          <input
            className="input pl-8 pr-8 py-2 md:py-2.5 text-[14px]"
            name="transaction-search"
            placeholder="Search transactions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {isSearchDebouncing ? (
            <Loader2 size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3 animate-spin" />
          ) : search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3"
            >
              <X size={13} />
            </button>
          )}
          </div>

          {isSearchDebouncing && (
            <p className="text-[11px] text-ink-3 mt-1.5">Updating results…</p>
          )}
        </div>

        <div className="px-4 py-3.5 space-y-2.5">
        <SectionHeader
          title="Date window"
          subtitle="Set the time horizon for visible transaction rows."
        />
        <FilterRow>
          {DATE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleDatePreset(preset.id)}
              className={`chip-control chip-control-sm ${
                datePreset === preset.id
                  ? 'bg-brand text-brand-on border-brand'
                  : 'bg-kosha-surface text-ink-3 border-kosha-border hover:bg-kosha-surface-2'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </FilterRow>

        <AnimatePresence>
          {datePreset === 'custom-month' && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="mini-panel p-3"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-[11px] uppercase tracking-wide text-ink-3">Choose month</p>
                <button
                  type="button"
                  onClick={() => {
                    const current = monthInputFromDate()
                    setSelectedMonth(current)
                    setDisplayCount(50)
                  }}
                  className="chip-control chip-control-sm bg-kosha-surface text-ink-2 border-kosha-border hover:bg-kosha-surface-2"
                >
                  Current month
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-2">
                <select
                  name="transactions-month-filter-month"
                  value={selectedMonthParts.month}
                  onChange={(event) => updateSelectedMonth(selectedMonthParts.year, event.target.value)}
                  className="w-full h-10 rounded-card border border-kosha-border bg-kosha-surface-2 px-3 text-[14px] text-ink focus:outline-none focus:border-brand"
                >
                  {MONTH_SHORT.map((monthLabel, index) => (
                    <option key={monthLabel} value={index + 1}>{monthLabel}</option>
                  ))}
                </select>

                <select
                  name="transactions-month-filter-year"
                  value={selectedMonthParts.year}
                  onChange={(event) => updateSelectedMonth(event.target.value, selectedMonthParts.month)}
                  className="w-full h-10 rounded-card border border-kosha-border bg-kosha-surface-2 px-3 text-[14px] text-ink focus:outline-none focus:border-brand"
                >
                  {monthFilterYearOptions.map((optionYear) => (
                    <option key={optionYear} value={optionYear}>{optionYear}</option>
                  ))}
                </select>
              </div>

              <p className="text-[10px] text-ink-3 mt-1">Filtering: {formatMonthInputLabel(selectedMonth)}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <SectionHeader
          title="Type and facets"
          subtitle="Combine type, category, and payment chips to isolate exact rows quickly."
        />

        <FilterRow>
          {TYPES.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTypeFilter(t.id)}
              className={`chip-control chip-control-sm ${typeFilter === t.id
                ? TYPE_CHIP[t.id]
                : 'bg-kosha-surface text-ink-3 border-kosha-border hover:bg-kosha-surface-2'}`}
            >
              {t.label}
            </button>
          ))}

          <button
            ref={categoryTriggerRef}
            type="button"
            onClick={() => {
              setShowCats(v => !v)
              setShowPaymentModes(false)
            }}
            aria-expanded={showCats}
            aria-controls="txn-category-filter-panel"
            className={`chip-control chip-control-sm ${catFilter
              ? 'bg-brand text-brand-on border-brand'
              : 'bg-kosha-surface text-ink-3 border-kosha-border hover:bg-kosha-surface-2'}`}
          >
            <SlidersHorizontal size={11} />
            {catFilter ? getCategoryLabel(catFilter) : 'Category'}
          </button>

          <button
            ref={paymentTriggerRef}
            type="button"
            onClick={() => {
              setShowPaymentModes(v => !v)
              setShowCats(false)
            }}
            aria-expanded={showPaymentModes}
            aria-controls="txn-payment-filter-panel"
            className={`chip-control chip-control-sm ${paymentModeFilter
              ? 'bg-brand text-brand-on border-brand'
              : 'bg-kosha-surface text-ink-3 border-kosha-border hover:bg-kosha-surface-2'}`}
          >
            <SlidersHorizontal size={11} />
            {paymentModeFilter
              ? PAYMENT_MODES.find((mode) => mode.id === paymentModeFilter)?.label || 'Payment'
              : 'Payment'}
          </button>

          {catFilter ? (
            <button
              type="button"
              onClick={() => handleCatFilter('')}
              className="chip-control chip-control-sm bg-kosha-surface text-ink-2 border-kosha-border hover:bg-kosha-surface-2"
            >
              Clear category
            </button>
          ) : null}

          {paymentModeFilter ? (
            <button
              type="button"
              onClick={() => handlePaymentModeFilter('')}
              className="chip-control chip-control-sm bg-kosha-surface text-ink-2 border-kosha-border hover:bg-kosha-surface-2"
            >
              Clear payment
            </button>
          ) : null}
        </FilterRow>

        <AnimatePresence>
          {showCats && (
            <motion.div
              ref={categoryPanelRef}
              id="txn-category-filter-panel"
              role="region"
              aria-label="Category filters"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="mini-panel p-3 flex flex-wrap gap-2"
            >
              {filterCategories.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    handleCatFilter(catFilter === c.id ? '' : c.id)
                    setShowCats(false)
                  }}
                  className={`chip-control chip-control-sm ${catFilter === c.id
                    ? 'bg-brand text-brand-on border-brand'
                    : 'bg-kosha-surface text-ink-3 border-kosha-border hover:bg-kosha-surface-2'}`}
                >
                  {c.label}
                </button>
              ))}

              <button
                type="button"
                onClick={() => {
                  setShowCats(false)
                  setShowCreateCategory(true)
                }}
                className="chip-control chip-control-sm bg-kosha-surface text-ink-2 border-kosha-border hover:bg-kosha-surface-2"
              >
                <Plus size={11} />
                Create category
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showPaymentModes && (
            <motion.div
              ref={paymentPanelRef}
              id="txn-payment-filter-panel"
              role="region"
              aria-label="Payment mode filters"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="mini-panel p-3 flex flex-wrap gap-2"
            >
              {PAYMENT_MODES.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => {
                    handlePaymentModeFilter(paymentModeFilter === mode.id ? '' : mode.id)
                    setShowPaymentModes(false)
                  }}
                  className={`chip-control chip-control-sm ${paymentModeFilter === mode.id
                    ? 'bg-brand text-brand-on border-brand'
                    : 'bg-kosha-surface text-ink-3 border-kosha-border hover:bg-kosha-surface-2'}`}
                >
                  {mode.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>

      {showGuideHint && (
        <div className="card mb-4 p-4 border border-brand-border bg-brand-container/40">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-container flex items-center justify-center shrink-0">
              <BookOpen size={16} className="text-accent-text" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-body font-semibold text-ink">Transactions tips</p>
              <p className="text-label text-ink-3 mt-0.5">Use consistent categories and recurring labels for cleaner analytics.</p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/guide')}
                iconRight={<ArrowRight size={13} />}
                className="mt-2 px-0 h-auto text-label font-semibold text-accent-text"
              >
                Open guide
              </Button>
            </div>
            <button type="button" onClick={dismissGuideHint} className="text-ink-4 hover:text-ink-2 transition-colors" aria-label="Dismiss transactions hint">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {showSwipeHint && groups.length > 0 && (
        <div className="mini-panel mb-3 px-3 py-2.5 flex items-start gap-2.5">
          <div className="w-5 h-5 rounded-full bg-brand-container text-brand text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
            i
          </div>
          <p className="text-[11px] text-ink-2 leading-relaxed flex-1 min-w-0">
            Quick tip: swipe left on a row to Repeat or Delete.
          </p>
          <button
            type="button"
            onClick={dismissSwipeHint}
            className="text-ink-4 hover:text-ink-2 transition-colors"
            aria-label="Dismiss swipe hint"
          >
            <X size={13} />
          </button>
        </div>
      )}

      <div className="mb-2.5">
        <SectionHeader
          title="Timeline"
          subtitle={hasActiveFilters ? 'Filtered rows grouped by date.' : 'Latest activity grouped by date.'}
          rightText={`${data.length} loaded`}
        />
      </div>

      {/* Transaction groups */}
      {txnLoading && data.length === 0 ? (
        <SkeletonLayout
          className="space-y-3"
          sections={[
            { type: 'block', height: 'h-[280px]' },
            { type: 'block', height: 'h-[200px]' },
            { type: 'block', height: 'h-[160px]' },
          ]}
        />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 size={24} className="text-accent-text" />}
          title={hasActiveFilters ? 'No transactions match these filters' : 'No transactions yet'}
          description={
            hasActiveFilters
              ? 'Try broadening your filters or clearing search to see more results.'
              : 'Start by adding your first transaction to build your timeline and insights.'
          }
          actionLabel={hasActiveFilters ? 'Clear filters' : 'Add transaction'}
          onAction={hasActiveFilters
            ? clearAllFilters
            : () => {
                setEditTxn(null)
                setAddType('expense')
                setShowAdd(true)
              }}
        />
      ) : (
        <div ref={timelineRowListRef}>
          {timelineRowTopPadding > 0 && <div aria-hidden="true" style={{ height: `${timelineRowTopPadding}px` }} />}
          {renderedTimelineRows.map((row, localRowIndex) => {
            const rowIndex = timelineRowStartIndex + localRowIndex
            const rowSpacingClass = row.isGroupFirst
              ? row.groupIndex === 0
                ? ''
                : 'mt-3.5'
              : 'mt-1'

            return (
              <div
                key={row.txn.id}
                ref={(node) => measureTimelineRow(rowIndex, node)}
                className={`list-card overflow-hidden ${rowSpacingClass}`}
              >
                {row.isGroupFirst && (
                  <div className="flex items-center justify-between px-4 py-3 border-b border-kosha-border bg-kosha-surface-2">
                    <span className="text-caption font-semibold text-ink-3 uppercase tracking-wide">
                      {dateLabel(row.dateKey)}
                    </span>
                    <span className={`text-caption font-semibold ${row.net >= 0 ? 'text-income-text' : 'text-expense-text'}`}>
                      {row.net >= 0 ? '+' : ''}{fmt(row.net)}
                    </span>
                  </div>
                )}

                <TransactionItem
                  txn={row.txn}
                  onDelete={handleDelete}
                  onTap={handleTap}
                  isLast={row.isGroupLast}
                  onDuplicate={handleDuplicate}
                  isHighlighted={highlightedTxnId === row.txn.id}
                  autoNudge={triggerSwipeNudge && row.groupIndex === 0 && row.isGroupFirst}
                  onAutoNudgeDone={handleAutoNudgeDone}
                  onSwipeHintLearned={handleSwipeHintLearned}
                />
              </div>
            )
          })}
          {timelineRowBottomPadding > 0 && <div aria-hidden="true" style={{ height: `${timelineRowBottomPadding}px` }} />}
        </div>
      )}

      {hasMore && (
        <Button
          variant="ghost"
          fullWidth
          onClick={() => setDisplayCount(n => n + 50)}
          className="mt-4"
        >
          Show more ({total - data.length} remaining)
        </Button>
      )}

      <AppToast message={toast} onDismiss={() => setToast(null)} />

      <button className="fab" aria-label="Add transaction" onClick={() => { setEditTxn(null); setAddType('expense'); setShowAdd(true) }}>
        <Plus size={24} className="text-white" />
      </button>

      <AnimatePresence>
        {showCreateCategory && (
          <CreateCategorySheet
            type={typeFilter === 'all' ? 'expense' : typeFilter}
            onClose={() => setShowCreateCategory(false)}
            onCreated={(createdCategory) => {
              setShowCreateCategory(false)

              if (!createdCategory?.id) return

              const createdType = createdCategory.type || 'expense'
              if (typeFilter !== createdType) {
                handleTypeFilter(createdType)
              }
              handleCatFilter(createdCategory.id)
              setShowCats(false)
              setToast(`Created ${createdCategory.label} category.`)
            }}
          />
        )}
      </AnimatePresence>

      <AddTransactionSheet
        open={showAdd}
        duplicateTxn={duplicateTxn}
        onClose={() => { setShowAdd(false); setEditTxn(null); setDuplicateTxn(null) }}
        editTxn={editTxn}
        initialType={addType}
      />
    </PageHeaderPage>
  )
}
