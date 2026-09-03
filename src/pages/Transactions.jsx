import { useState, useCallback, useMemo, useEffect, useRef, startTransition } from 'react'
import { motion } from 'framer-motion'
import { X, Plus, DownloadSimple, BookOpen, ArrowRight, CircleNotch } from '@phosphor-icons/react'
import {
  useTransactions,
  useTransactionSignalAggregates,
  useDebounce,
} from '../hooks/useTransactions'
import TransactionItem from '../components/transactions/TransactionItem'
import AddTransactionSheet from '../components/transactions/AddTransactionSheet'
import EmptyState from '../components/common/EmptyState'


import PartnerViewBanner from '../components/common/PartnerViewBanner'
import { getAuthUserId } from '../lib/authStore'
import { useActiveWallet } from '../lib/walletStore'
import { useUserCategories } from '../hooks/useUserCategories'
import { CATEGORIES, PAYMENT_MODES, getCategoriesForType } from '../lib/categories'
import { groupByDate, dateLabel, fmt } from '../lib/utils'
import { bandTextClass, scoreHealthBand, scoreRiskBand } from '../lib/insightBands'

import {
  MONTH_FILTER_MIN_YEAR,
  MONTH_FILTER_MAX_YEAR,
  monthInputFromDate,
  parseMonthInput,
  formatMonthInputLabel,
  parseIsoDateInput,
  formatIsoDateLabel
} from '../lib/dateUtils'
import PageHeaderPage from '../components/layout/PageHeaderPage'
import SectionHeader from '../components/common/SectionHeader'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import SkeletonLayout from '../components/common/SkeletonLayout'
import Button from '../components/ui/Button'
import useWindowedList from '../hooks/useWindowedList'
import { useTransactionDeleter } from '../hooks/useTransactionDeleter'
import { useTransactionExporter } from '../hooks/useTransactionExporter'
import TransactionFilterBar, { DATE_PRESETS, TYPES } from '../components/transactions/TransactionFilterBar'

import { readLocalStorage, writeLocalStorage } from '../lib/safeStorage'
import { useAppToast } from '../context/ToastContext'

const TXN_GUIDE_HINT_KEY = 'kosha:dismiss-guide-transactions-v1'
const SWIPE_HINT_DISMISSED_KEY = 'kosha:swipe-delete-hint-dismissed-v1'
const SWIPE_HINT_LEARNED_KEY = 'kosha:swipe-delete-hint-learned-v1'
const SWIPE_HINT_NUDGED_KEY = 'kosha:swipe-delete-hint-nudged-v1'
const FILTER_URL_KEYS = ['month', 'day', 'type', 'category', 'payment', 'q', 'linked_loan', 'linked_bill', 'linked_split_expense', 'linked_split_settlement']




function groupNet(txns) {
  return txns.reduce((s, t) =>
    t.type === 'income' ? s + +t.amount : s - +t.amount, 0)
}

export default function Transactions() {
  const navigate = useNavigate()
  const location = useLocation()
  const [typeFilter, setTypeFilter] = useState('all')
  const [catFilter, setCatFilter] = useState('')
  const [paymentModeFilter, setPaymentModeFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editTxn, setEditTxn] = useState(null)
  const [addType, setAddType] = useState('expense')
  const [datePreset, setDatePreset] = useState('all')
  const [selectedMonth, setSelectedMonth] = useState(() => monthInputFromDate())
  const [forcedDateRange, setForcedDateRange] = useState(null)
  const [displayCount, setDisplayCount] = useState(50)
  const { pushToast } = useAppToast()
  const [duplicateTxn, setDuplicateTxn] = useState(null)
  const [highlightedTxnId, setHighlightedTxnId] = useState(null)
  const [showGuideHint, setShowGuideHint] = useState(true)
  const [showSwipeHint, setShowSwipeHint] = useState(false)
  const [triggerSwipeNudge, setTriggerSwipeNudge] = useState(false)
  const [, setShowCreateCategory] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const activeWalletUserId = useActiveWallet()
  const isViewingPartner = !!activeWalletUserId && activeWalletUserId !== getAuthUserId()
  const internalUrlUpdateRef = useRef(false)
  const searchParamsRef = useRef(searchParams)
  const focusRanForRef = useRef(null)

  const debouncedSearch = useDebounce(search, 300)
  const isSearchDebouncing = search !== debouncedSearch
  const focusTxnId = searchParams.get('focus')
  const linkedLoanFilter = searchParams.get('linked_loan') || null
  const linkedBillFilter = searchParams.get('linked_bill') || null
  const linkedSplitExpenseFilter = searchParams.get('linked_split_expense') || null
  const linkedSplitSettlementFilter = searchParams.get('linked_split_settlement') || null

  const clearLinkedFilters = useCallback(() => {
    if (!linkedLoanFilter && !linkedBillFilter && !linkedSplitExpenseFilter && !linkedSplitSettlementFilter) return
    const next = new URLSearchParams(searchParams)
    next.delete('linked_loan')
    next.delete('linked_bill')
    next.delete('linked_split_expense')
    next.delete('linked_split_settlement')
    internalUrlUpdateRef.current = true
    setSearchParams(next, { replace: true })
  }, [linkedLoanFilter, linkedBillFilter, linkedSplitExpenseFilter, linkedSplitSettlementFilter, searchParams, setSearchParams])

  function handleDatePreset(nextPreset) {
    clearLinkedFilters()
    startTransition(() => {
      setDatePreset(nextPreset)
      setForcedDateRange(null)
      if (nextPreset === 'custom-month' && !parseMonthInput(selectedMonth)) {
        setSelectedMonth(monthInputFromDate())
      }
      setDisplayCount(50)
    })
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
    clearLinkedFilters()
    const safeYear = Math.min(
      MONTH_FILTER_MAX_YEAR,
      Math.max(MONTH_FILTER_MIN_YEAR, Number(nextYear) || selectedMonthParts.year)
    )
    const safeMonth = Math.min(12, Math.max(1, Number(nextMonth) || selectedMonthParts.month))

    startTransition(() => {
      setSelectedMonth(`${safeYear}-${String(safeMonth).padStart(2, '0')}`)
      setForcedDateRange(null)
      setDisplayCount(50)
    })
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
  const { customCategories } = useUserCategories()
  const filterCategories = useMemo(() => {
    void customCategories
    return getCategoriesForType(typeFilter === 'all' ? undefined : typeFilter)
  }, [typeFilter, customCategories])
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

  const getPaymentModeLabel = useCallback((modeId) => {
    if (!modeId) return 'All payment modes'
    const found = PAYMENT_MODES.find((item) => item.id === modeId)
    return found?.label || 'Custom mode'
  }, [])

  // Reset display count when filter changes to avoid cascading re-renders

  function handleTypeFilter(id) {
    startTransition(() => {
      setTypeFilter(id)
      const nextCategories = getCategoriesForType(id === 'all' ? undefined : id)
      const isCurrentCategoryAllowed = !catFilter || nextCategories.some((cat) => cat.id === catFilter)
      if (!isCurrentCategoryAllowed) setCatFilter('')
      setDisplayCount(50)   // reset in same event — single re-render
    })
  }

  function handleCatFilter(id) {
    startTransition(() => {
      setCatFilter(id)
      setDisplayCount(50)   // reset in same event — single re-render
    })
  }

  function handlePaymentModeFilter(id) {
    startTransition(() => {
      setPaymentModeFilter(id)
      setDisplayCount(50)
    })
  }

  const { data, total, loading: txnLoading, fetching: txnFetching } = useTransactions({
    type: typeFilter === 'all' ? undefined : typeFilter,
    category: catFilter || undefined,
    paymentMode: paymentModeFilter || undefined,
    search: debouncedSearch || undefined,
    startDate,
    endDate,
    linkedLoanId: linkedLoanFilter,
    linkedBillId: linkedBillFilter,
    linkedSplitExpenseId: linkedSplitExpenseFilter,
    linkedSplitSettlementId: linkedSplitSettlementFilter,
    limit: displayCount,
    withCount: true,
  })

  const shouldFetchSignalAggregates = total > data.length
  const { data: signalAggregates } = useTransactionSignalAggregates({
    type: typeFilter === 'all' ? undefined : typeFilter,
    category: catFilter || undefined,
    paymentMode: paymentModeFilter || undefined,
    search: debouncedSearch || undefined,
    startDate,
    endDate,
    linkedLoanId: linkedLoanFilter,
    linkedBillId: linkedBillFilter,
    linkedSplitExpenseId: linkedSplitExpenseFilter,
    linkedSplitSettlementId: linkedSplitSettlementFilter,
    enabled: shouldFetchSignalAggregates,
  })

  const groups = useMemo(() => {
    const grouped = groupByDate(data)
    return grouped.map(([dateKey, txns]) => [dateKey, txns, groupNet(txns)])
  }, [data])

  const estimateGroupSize = useCallback((index) => {
    const group = groups[index]
    if (!group) return 150
    const txnsCount = group[1]?.length || 0
    const spacing = index === 0 ? 0 : 16
    return 45 + (txnsCount * 76) + spacing
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
    count: groups.length,
    estimateSize: estimateGroupSize,
    overscan: 6,
    enabled: true,
    resetKey: `${typeFilter}:${catFilter}:${paymentModeFilter}:${datePreset}:${startDate || 'na'}:${endDate || 'na'}:${debouncedSearch}:${linkedLoanFilter || 'none'}:${linkedBillFilter || 'none'}:${linkedSplitExpenseFilter || 'none'}:${linkedSplitSettlementFilter || 'none'}`,
    initialCount: 15,
  })

  const hasMore = useMemo(() => total > data.length, [total, data.length])

  const renderedGroups = useMemo(
    () => groups.slice(timelineRowStartIndex, timelineRowEndIndex),
    [groups, timelineRowStartIndex, timelineRowEndIndex]
  )

  const hasActiveFilters = typeFilter !== 'all' || !!catFilter || !!paymentModeFilter || datePreset !== 'all' || !!forcedDateRange || !!debouncedSearch || !!linkedLoanFilter || !!linkedBillFilter || !!linkedSplitExpenseFilter || !!linkedSplitSettlementFilter
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
    if (signalAggregates?.rowCount >= 2) {
      const activeDays = Number(signalAggregates.activeDays || 0)
      if (activeDays <= 0) return null

      let spanDays = 1
      if (startDate && endDate) {
        const fromTs = new Date(`${startDate}T00:00:00`).getTime()
        const toTs = new Date(`${endDate}T00:00:00`).getTime()
        if (Number.isFinite(fromTs) && Number.isFinite(toTs)) {
          spanDays = Math.max(1, Math.floor((toTs - fromTs) / (24 * 60 * 60 * 1000)) + 1)
        }
      } else if (signalAggregates.minDate && signalAggregates.maxDate) {
        const fromTs = new Date(`${signalAggregates.minDate}T00:00:00`).getTime()
        const toTs = new Date(`${signalAggregates.maxDate}T00:00:00`).getTime()
        if (Number.isFinite(fromTs) && Number.isFinite(toTs)) {
          spanDays = Math.max(1, Math.floor((toTs - fromTs) / (24 * 60 * 60 * 1000)) + 1)
        } else {
          spanDays = Math.max(1, activeDays)
        }
      } else {
        spanDays = Math.max(1, activeDays)
      }

      const densityPct = Math.round((activeDays / spanDays) * 100)
      const txnsPerActiveDay = signalAggregates.rowCount / Math.max(1, activeDays)
      const band = scoreHealthBand(densityPct, { healthy: 65, watch: 35 })

      return { activeDays, spanDays, densityPct, txnsPerActiveDay, band }
    }

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
  }, [signalAggregates, data, startDate, endDate])

  const paymentModeSignal = useMemo(() => {
    if (signalAggregates?.rowCount) {
      const totalRows = signalAggregates.rowCount
      const counts = Object.entries(signalAggregates.paymentModeCounts || {})
      const rows = counts
        .map(([mode, count]) => ({
          mode,
          label: paymentModeLabelById.get(mode) || 'Other',
          count,
          pct: Math.round((count / totalRows) * 100),
        }))
        .sort((a, b) => b.count - a.count)

      if (!rows.length) return null

      const topPct = rows[0]?.pct || 0
      return {
        top: rows[0],
        secondary: rows[1] || null,
        band: scoreRiskBand(topPct, { high: 72, watch: 55 }),
        scopeLabel: 'matching rows',
      }
    }

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
      scopeLabel: 'visible rows',
    }
  }, [signalAggregates, data, paymentModeLabelById])

  const expenseFrequencySignal = useMemo(() => {
    if (signalAggregates?.expenseCount >= 3) {
      const rows = Object.entries(signalAggregates.expenseCategoryCounts || {})
        .map(([categoryId, count]) => ({
          categoryId,
          label: categoryLabelById.get(categoryId) || 'Other',
          count,
        }))
        .sort((a, b) => b.count - a.count)

      if (!rows.length) return null

      const topThreeCount = rows.slice(0, 3).reduce((sum, row) => sum + row.count, 0)
      const concentrationPct = Math.round((topThreeCount / signalAggregates.expenseCount) * 100)

      return {
        top: rows[0],
        concentrationPct,
        expenseCount: signalAggregates.expenseCount,
        band: scoreRiskBand(concentrationPct, { high: 72, watch: 56 }),
      }
    }

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
  }, [signalAggregates, data, categoryLabelById])

  useEffect(() => {
    const hidden = readLocalStorage(TXN_GUIDE_HINT_KEY, '0') === '1'
    if (hidden) setShowGuideHint(false)
  }, [])

  useEffect(() => {
    const dismissed = readLocalStorage(SWIPE_HINT_DISMISSED_KEY, '0') === '1'
    const learned = readLocalStorage(SWIPE_HINT_LEARNED_KEY, '0') === '1'
    const nudged = readLocalStorage(SWIPE_HINT_NUDGED_KEY, '0') === '1'

    setShowSwipeHint(!dismissed && !learned)
    setTriggerSwipeNudge(!nudged)
  }, [])

  useEffect(() => {
    searchParamsRef.current = searchParams

    if (internalUrlUpdateRef.current) {
      internalUrlUpdateRef.current = false
      return
    }

    const validTypeIds = new Set(TYPES.map((item) => item.id))
    const validPaymentModeIds = new Set(PAYMENT_MODES.map((item) => item.id))

    const monthParam = parseMonthInput(searchParams.get('month'))
    const dayParam = parseIsoDateInput(searchParams.get('day'))
    const typeParam = String(searchParams.get('type') || '').trim()
    const resolvedType = validTypeIds.has(typeParam) ? typeParam : 'all'
    const categoryParam = String(searchParams.get('category') || '').trim()
    const paymentModeParam = String(searchParams.get('payment') || '').trim()
    const resolvedPaymentMode = validPaymentModeIds.has(paymentModeParam) ? paymentModeParam : ''
    const queryParam = String(searchParams.get('q') || '').trim()

    setTypeFilter(resolvedType)
    setPaymentModeFilter(resolvedPaymentMode)
    setSearch(queryParam)

    const allowedCategories = getCategoriesForType(resolvedType === 'all' ? undefined : resolvedType)
    const categoryAllowed = !categoryParam || allowedCategories.some((item) => item.id === categoryParam)
    setCatFilter(categoryAllowed ? categoryParam : '')

    if (dayParam) {
      setForcedDateRange({ startDate: dayParam, endDate: dayParam })
      setDatePreset('all')
    } else if (monthParam) {
      const normalizedMonth = `${monthParam.year}-${String(monthParam.month).padStart(2, '0')}`
      setSelectedMonth(normalizedMonth)
      setForcedDateRange(null)
      setDatePreset('custom-month')
    } else {
      // If we are in a linked entity view, we let Phase 2 manage the forcedDateRange.
      // Otherwise, we clear it as the URL has no specific date context.
      const hasLinkedFilter = !!(linkedLoanFilter || linkedBillFilter || linkedSplitExpenseFilter || linkedSplitSettlementFilter)
      if (!hasLinkedFilter) {
        setForcedDateRange(null)
      }

      // Only reset to 'all' if we were on a custom month or specific day,
      // and the URL no longer has those specific params.
      if (datePreset === 'custom-month' || (forcedDateRange && !hasLinkedFilter)) {
        setDatePreset('all')
      }
    }

    setDisplayCount(50)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, linkedBillFilter, linkedLoanFilter, linkedSplitExpenseFilter, linkedSplitSettlementFilter])

  useEffect(() => {
    setSearchParams((prev) => {
      const currentSearchParams = prev
      const nextParams = new URLSearchParams()

      if (forcedDateRange?.startDate && forcedDateRange.startDate === forcedDateRange.endDate) {
        nextParams.set('day', forcedDateRange.startDate)
      } else if (datePreset === 'custom-month') {
        const parsed = parseMonthInput(selectedMonth)
        if (parsed) {
          nextParams.set('month', `${parsed.year}-${String(parsed.month).padStart(2, '0')}`)
        }
      }

      if (typeFilter !== 'all') nextParams.set('type', typeFilter)
      if (catFilter) nextParams.set('category', catFilter)
      if (paymentModeFilter) nextParams.set('payment', paymentModeFilter)

      const query = String(debouncedSearch || '').trim()
      if (query) nextParams.set('q', query)

      const focusParam = String(currentSearchParams.get('focus') || '').trim()
      if (focusParam) nextParams.set('focus', focusParam)

      if (linkedLoanFilter) nextParams.set('linked_loan', linkedLoanFilter)
      if (linkedBillFilter) nextParams.set('linked_bill', linkedBillFilter)
      if (linkedSplitExpenseFilter) nextParams.set('linked_split_expense', linkedSplitExpenseFilter)
      if (linkedSplitSettlementFilter) nextParams.set('linked_split_settlement', linkedSplitSettlementFilter)

      const mergedParams = new URLSearchParams(currentSearchParams)
      FILTER_URL_KEYS.forEach((key) => mergedParams.delete(key))
      for (const [key, value] of nextParams.entries()) {
        mergedParams.set(key, value)
      }

      mergedParams.sort()
      const prevSorted = new URLSearchParams(currentSearchParams)
      prevSorted.sort()

      if (mergedParams.toString() !== prevSorted.toString()) {
        internalUrlUpdateRef.current = true
        return mergedParams
      }
      return prev
    }, { replace: true })
  }, [
    typeFilter,
    catFilter,
    paymentModeFilter,
    datePreset,
    selectedMonth,
    forcedDateRange,
    debouncedSearch,
    setSearchParams,
    linkedBillFilter,
    linkedLoanFilter,
    linkedSplitExpenseFilter,
    linkedSplitSettlementFilter,
  ])



  const focusExpandCountRef = useRef(0)

  useEffect(() => {
    if (!focusTxnId) return
    focusExpandCountRef.current = 0
  }, [focusTxnId])

  useEffect(() => {
    if (!focusTxnId || focusRanForRef.current === focusTxnId) return

    const found = data.find(t => t.id === focusTxnId)
    if (!found) {
      if (hasMore && focusExpandCountRef.current < 10) {
        focusExpandCountRef.current += 1
        setDisplayCount(n => n + 100)
      }
      return
    }

    focusRanForRef.current = focusTxnId

    const focusGroupIndex = groups.findIndex(([_, txns]) => txns.some((row) => row.id === focusTxnId))
    if (focusGroupIndex >= 0) {
      scrollTimelineRowToIndex(focusGroupIndex, { behavior: 'smooth', block: 'center' })
    }

    setHighlightedTxnId(focusTxnId)
    const scrollTimeoutId = setTimeout(() => {
      const el = document.getElementById(`txn-${focusTxnId}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 70)

    const timeoutId = setTimeout(() => setHighlightedTxnId(null), 2400)

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('focus')
      return next
    }, { replace: true })

    return () => {
      clearTimeout(scrollTimeoutId)
      clearTimeout(timeoutId)
    }
  }, [focusTxnId, data, hasMore, groups, scrollTimelineRowToIndex, setSearchParams])

  // Phase 1: when loan filter activates, reset to All time so all repayments load
  const loanFilterRangeSetRef = useRef(null)
  useEffect(() => {
    const activeLinkedFilter = linkedLoanFilter || linkedBillFilter || linkedSplitExpenseFilter || linkedSplitSettlementFilter
    if (!activeLinkedFilter) {
      loanFilterRangeSetRef.current = null
      return
    }
    // Only reset to all-time if switching to a new linked filter
    if (loanFilterRangeSetRef.current !== activeLinkedFilter) {
      setDatePreset('all')
      setForcedDateRange(null)
    }
  }, [linkedLoanFilter, linkedBillFilter, linkedSplitExpenseFilter, linkedSplitSettlementFilter])

  // Phase 2: once data loads, compute the actual repayment date range and apply it
  useEffect(() => {
    const activeLinkedFilter = linkedLoanFilter || linkedBillFilter || linkedSplitExpenseFilter || linkedSplitSettlementFilter
    if (!activeLinkedFilter || txnLoading || !data.length) return
    // Skip if we already set the range for this linked filter
    if (loanFilterRangeSetRef.current === activeLinkedFilter) return

    const related = data
    const dates = related.map(t => t.date).filter(Boolean).sort()
    if (!dates.length) return

    const startDate = dates[0]
    const endDate = dates[dates.length - 1]
    loanFilterRangeSetRef.current = activeLinkedFilter
    setForcedDateRange({ startDate, endDate })
    setDatePreset('all')
  }, [linkedLoanFilter, linkedBillFilter, linkedSplitExpenseFilter, linkedSplitSettlementFilter, data, txnLoading])

  const { handleDelete } = useTransactionDeleter(activeWalletUserId, data)

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
    if (isViewingPartner) {
      pushToast("You can only view your partner's transactions.", { duration: 3000 })
      return
    }

    if (t?.is_repayment) {
      pushToast('Repayments are managed from Loans.')
      navigate(repaymentLoanRoute(t))
      return
    }

    setEditTxn(t)
    setDuplicateTxn(null)
    setAddType(t.type)
    setShowAdd(true)
  }, [navigate, pushToast, repaymentLoanRoute, isViewingPartner])

  const handleDuplicate = useCallback((txn) => {
    setEditTxn(null)
    setDuplicateTxn(txn)
    setAddType(txn.type)
    setShowAdd(true)
  }, [])

  const { exportCSV } = useTransactionExporter({
    activeWalletUserId,
    typeFilter,
    catFilter,
    paymentModeFilter,
    debouncedSearch,
    startDate,
    endDate,
  })

  const dismissGuideHint = useCallback(() => {
    setShowGuideHint(false)
    writeLocalStorage(TXN_GUIDE_HINT_KEY, '1')
  }, [])

  const dismissSwipeHint = useCallback(() => {
    setShowSwipeHint(false)
    writeLocalStorage(SWIPE_HINT_DISMISSED_KEY, '1')
  }, [])

  const handleSwipeHintLearned = useCallback(() => {
    setShowSwipeHint(false)
    writeLocalStorage(SWIPE_HINT_LEARNED_KEY, '1')
  }, [])

  const handleAutoNudgeDone = useCallback(() => {
    setTriggerSwipeNudge(false)
    writeLocalStorage(SWIPE_HINT_NUDGED_KEY, '1')
  }, [])

  const clearAllFilters = useCallback(() => {
    setTypeFilter('all')
    setCatFilter('')
    setPaymentModeFilter('')
    setDatePreset('all')
    setSelectedMonth(monthInputFromDate())
    setForcedDateRange(null)
    setSearch('')
    setDisplayCount(50)
    clearLinkedFilters()
  }, [clearLinkedFilters])

  useEffect(() => {
    if (!location.state?.openAddInvestment) return

    setEditTxn(null)
    setDuplicateTxn(null)
    setAddType('investment')
    setShowAdd(true)

    navigate(`${location.pathname}${location.search}`, { replace: true, state: null })
  }, [location.state, location.pathname, location.search, navigate])

  const isInitialLoad = txnLoading && data.length === 0
  const isNewUser = !txnLoading && total === 0 && !hasActiveFilters
  const showWorkspace = !isInitialLoad && !isNewUser

  return (
    <PageHeaderPage title="Transactions">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="page-stack"
      >
        {isInitialLoad && (
          <SkeletonLayout
            className="space-y-3"
            sections={[
              { type: 'block', height: 'h-[160px]' },
              { type: 'block', height: 'h-[280px]' },
              { type: 'block', height: 'h-[200px]' },
            ]}
          />
        )}

        {isNewUser && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="card p-4 border-0"
          >
            <p className="section-label mb-1.5">Start here</p>
            <p className="text-[14px] font-semibold text-ink">Add your first transaction to unlock your timeline.</p>
            <p className="text-[11px] text-ink-3 mt-1.5">Kosha will start analyzing your activity and showing insights here once you log your first transaction.</p>
            <div className="flex gap-2 mt-3">
              <Button variant="secondary" size="sm" onClick={() => { setEditTxn(null); setAddType('expense'); setShowAdd(true) }}>
                <Plus size={14} className="mr-1 inline" /> Add
              </Button>
            </div>
          </motion.div>
        )}

        {showWorkspace && (
          <div className="card p-0 border-0 overflow-hidden">
          <TransactionFilterBar
            search={search}
            setSearch={setSearch}
            isSearchDebouncing={isSearchDebouncing}
            debouncedSearch={debouncedSearch}
            linkedLoanFilter={linkedLoanFilter}
            linkedBillFilter={linkedBillFilter}
            linkedSplitExpenseFilter={linkedSplitExpenseFilter}
            linkedSplitSettlementFilter={linkedSplitSettlementFilter}
            clearLinkedFilters={clearLinkedFilters}
            total={total}
            datePreset={datePreset}
            handleDatePreset={handleDatePreset}
            selectedMonth={selectedMonth}
            selectedMonthParts={selectedMonthParts}
            updateSelectedMonth={updateSelectedMonth}
            monthFilterYearOptions={monthFilterYearOptions}
            setDisplayCount={setDisplayCount}
            typeFilter={typeFilter}
            handleTypeFilter={handleTypeFilter}
            catFilter={catFilter}
            handleCatFilter={handleCatFilter}
            getCategoryLabel={getCategoryLabel}
            paymentModeFilter={paymentModeFilter}
            handlePaymentModeFilter={handlePaymentModeFilter}
            getPaymentModeLabel={getPaymentModeLabel}
            setShowCreateCategory={setShowCreateCategory}
            filterCategories={filterCategories}
          />
          </div>
        )}

        {showGuideHint && (
          <div className="hint-card mb-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-brand-container flex items-center justify-center shrink-0">
                <BookOpen size={16} className="text-accent-text" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-body font-semibold text-ink">Transactions tip</p>
                <p className="text-label text-ink-3 mt-0.5">Use consistent categories and mark repeat payments as recurring to keep analytics accurate.</p>
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
          <div className="hint-card flex items-start gap-2.5 mb-4">
            <div className="w-5 h-5 rounded-full bg-brand-container text-brand text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
              i
            </div>
            <p className="text-[11px] text-ink-2 leading-relaxed flex-1 min-w-0">
              Quick tip: swipe left on a transaction row to Repeat or Delete.
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

        {!isInitialLoad && (
          <div>
            <SectionHeader
              title="Timeline"
              subtitle={hasActiveFilters || linkedLoanFilter ? 'Filtered rows grouped by date.' : 'Latest activity grouped by date.'}
              rightText={`${data.length} loaded`}
            />
          </div>
        )}

        {/* Transaction groups */}
        {!isInitialLoad && (
          groups.length === 0 ? (
            <EmptyState
              imageUrl={hasActiveFilters ? "/illustrations/search_empty.webp" : "/illustrations/empty_transactions.webp"}
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
            <div ref={timelineRowListRef} style={{ overflowAnchor: 'none' }}>
              {timelineRowTopPadding > 0 && <div aria-hidden="true" style={{ height: `${timelineRowTopPadding}px` }} />}
              {renderedGroups.map(([dateKey, txns, net], localGroupIndex) => {
                const groupIndex = timelineRowStartIndex + localGroupIndex
                const spacingClass = groupIndex === 0 ? '' : 'pt-4'

                return (
                  <div
                    key={dateKey}
                    ref={(node) => measureTimelineRow(groupIndex, node)}
                    className={spacingClass}
                  >
                    <div className="list-card overflow-hidden">
                      <div className="flex items-center justify-between px-5 py-3 border-b border-kosha-border bg-kosha-surface-2 sticky top-0 z-10">
                        <span className="text-caption font-semibold text-ink-3 uppercase tracking-wide">
                          {dateLabel(dateKey)}
                        </span>
                        <span className={`text-caption font-semibold ${net >= 0 ? 'text-income-text' : 'text-expense-text'}`}>
                          {net >= 0 ? '+' : ''}{fmt(net)}
                        </span>
                      </div>

                    {txns.map((txn, txnIndex) => {
                      const isLast = txnIndex === txns.length - 1
                      const isFirstItemOfFirstGroup = groupIndex === 0 && txnIndex === 0

                      return (
                        <TransactionItem
                          key={txn.id}
                          txn={txn}
                          onDelete={(isViewingPartner || txn.linked_split_expense_id || txn.linked_split_settlement_id || txn.linked_bill_id || txn.linked_loan_id) ? undefined : handleDelete}
                          onTap={handleTap}
                          isLast={isLast}
                          onDuplicate={(isViewingPartner || txn.linked_split_expense_id || txn.linked_split_settlement_id || txn.linked_bill_id || txn.linked_loan_id) ? undefined : handleDuplicate}
                          isHighlighted={highlightedTxnId === txn.id}
                          autoNudge={triggerSwipeNudge && !isViewingPartner && isFirstItemOfFirstGroup && !(txn.linked_split_expense_id || txn.linked_split_settlement_id || txn.linked_bill_id || txn.linked_loan_id)}
                          onAutoNudgeDone={handleAutoNudgeDone}
                          onSwipeHintLearned={handleSwipeHintLearned}
                          searchQuery={debouncedSearch}
                        />
                      )
                    })}
                    </div>
                  </div>
                )
              })}
              {timelineRowBottomPadding > 0 && <div aria-hidden="true" style={{ height: `${timelineRowBottomPadding}px` }} />}
            </div>
          ))}

        {hasMore && (
          <Button
            variant="ghost"
            fullWidth
            disabled={txnFetching}
            onClick={() => setDisplayCount(n => n + 50)}
            className="mt-4"
          >
            {txnFetching ? (
              <span className="flex items-center justify-center gap-2">
                <CircleNotch size={14} className="animate-spin" />
                Loading older transactions...
              </span>
            ) : (
              `Show more (${total - data.length} remaining)`
            )}
          </Button>
        )}

        {/* Transaction workspace (Summary) moved to bottom */}
        {showWorkspace && (
          <div className="card p-0 border-0 overflow-hidden">
            <div className="px-4 pt-3.5 pb-3 bg-kosha-surface-2 border-b border-kosha-border">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-ink">Timeline summary</p>
                  <p className="text-[12px] text-ink-3 mt-0.5">Quick read of the health of your currently loaded rows.</p>
                </div>
                <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-pill border whitespace-nowrap ${(hasActiveFilters || linkedLoanFilter)
                  ? 'bg-brand-container text-brand border-brand/20'
                  : 'bg-kosha-surface text-ink-3 border-kosha-border'
                  }`}>
                  {(hasActiveFilters || linkedLoanFilter) ? 'Filtered view' : 'Full timeline'}
                </span>
              </div>
            </div>

            <div className="p-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="mini-panel px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-ink-3">Rows</p>
                  <p className="text-[15px] font-semibold tabular-nums text-ink mt-1">
                    {data.length}/{total}
                  </p>
                  <p className="text-[10px] text-ink-3 mt-0.5">Loaded / matching</p>
                </div>
                <div className="mini-panel px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-wide text-ink-3">Range</p>
                  <p className="text-[12px] sm:text-[13px] font-semibold text-ink mt-1 leading-tight">{activeDatePresetLabel}</p>
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
                      <button
                        type="button"
                        onClick={() => handleDatePreset('7d')}
                        className="chip-control chip-control-sm mt-2 bg-kosha-surface text-ink-2 border-kosha-border hover:bg-kosha-surface-2 truncate max-w-full block"
                      >
                        Focus last 7d
                      </button>
                    </div>
                  )}

                  {paymentModeSignal && (
                    <div className="mini-panel px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-wide text-ink-3">Payment mode mix</p>
                      <p className={`text-[13px] font-semibold mt-1 ${bandTextClass(paymentModeSignal.band, 'text-ink')}`}>
                        {paymentModeSignal.top.label}
                      </p>
                      <p className="text-[10px] text-ink-3 mt-0.5 tabular-nums">
                        {paymentModeSignal.top.pct}% of {paymentModeSignal.scopeLabel} ({paymentModeSignal.top.count})
                      </p>
                      {paymentModeSignal.secondary && (
                        <p className="text-[10px] text-ink-3 mt-1">
                          Next: {paymentModeSignal.secondary.label} ({paymentModeSignal.secondary.pct}%)
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => handlePaymentModeFilter(paymentModeSignal.top.mode)}
                        className="chip-control chip-control-sm mt-2 bg-kosha-surface text-ink-2 border-kosha-border hover:bg-kosha-surface-2 truncate max-w-full block"
                      >
                        Filter {paymentModeSignal.top.label}
                      </button>
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
                      <button
                        type="button"
                        onClick={() => {
                          if (typeFilter !== 'expense') {
                            handleTypeFilter('expense')
                          }
                          handleCatFilter(expenseFrequencySignal.top.categoryId)
                        }}
                        className="chip-control chip-control-sm mt-2 bg-kosha-surface text-ink-2 border-kosha-border hover:bg-kosha-surface-2 truncate max-w-full block"
                      >
                        Filter {expenseFrequencySignal.top.label}
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="chip-control chip-control-sm bg-kosha-surface text-ink-2 border-kosha-border">{activeCategoryLabel}</span>
                <span className="chip-control chip-control-sm bg-kosha-surface text-ink-2 border-kosha-border">{activePaymentModeLabel}</span>
                {linkedLoanFilter && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = new URLSearchParams(searchParams)
                      next.delete('linked_loan')
                      setSearchParams(next, { replace: true })
                    }}
                    className="chip-control chip-control-sm bg-brand-container text-brand border-brand/20 flex items-center gap-1"
                  >
                    Loan repayments
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                )}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {total > 0 && !isViewingPartner ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<DownloadSimple size={14} />}
                    onClick={exportCSV}
                  >
                    Export CSV
                  </Button>
                ) : null}

                {(hasActiveFilters || linkedLoanFilter) ? (
                  <button
                    type="button"
                    onClick={() => {
                      clearAllFilters()
                      const next = new URLSearchParams(searchParams)
                      next.delete('linked_loan')
                      setSearchParams(next, { replace: true })
                    }}
                    className="chip-control chip-control-sm bg-kosha-surface text-ink-2 border-kosha-border hover:bg-kosha-surface-2"
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* FAB — hidden in partner wallet view-only mode */}
      {!isViewingPartner && (
        <button
          className="fab"
          aria-label="Add transaction"
          onClick={() => { setEditTxn(null); setAddType('expense'); setShowAdd(true) }}
          onPointerUp={() => {
            // Bypass Safari blur swallow but wait for finger release so it feels natural
            setEditTxn(null); setAddType('expense'); setShowAdd(true)
          }}
        >
          <Plus size={24} className="text-white" />
        </button>
      )}

      <PartnerViewBanner />

      {!isViewingPartner && (
        <AddTransactionSheet
          open={showAdd}
          duplicateTxn={duplicateTxn}
          onClose={() => { setShowAdd(false); setEditTxn(null); setDuplicateTxn(null) }}
          editTxn={editTxn}
          initialType={addType}
        />
      )}
    </PageHeaderPage>
  )
}
