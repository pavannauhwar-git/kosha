import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Bell, ArrowRight, Plus, ShieldAlert } from 'lucide-react'
import {
  useRecentTransactions,
  useTransactionDigest,
  useDailyExpenseTotals,
  useMonthSummary,
  useRunningBalance,
  removeTransactionMutation,
} from '../hooks/useTransactions'
import { useLiabilities } from '../hooks/useLiabilities'
import { useBudgets, budgetMap as buildBudgetMap } from '../hooks/useBudgets'
import { useAuth } from '../context/AuthContext'
import AddTransactionSheet from '../components/transactions/AddTransactionSheet'
import { fmt, savingsRate, daysUntil } from '../lib/utils'
import { useNavigate } from 'react-router-dom'
import { createFadeUp, createStagger } from '../lib/animations'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
} from 'recharts'

// FIX (defect 4.3): Extracted sub-components. Each renders independently —
// a transaction list refetch no longer re-renders the hero card,
// and a balance update no longer re-renders the transaction list.
import DashboardHeroCard from '../components/cards/dashboard/DashboardHeroCard'
import DashboardRecentTransactions from '../components/dashboard/DashboardRecentTransactions'
import DailySpendBubbleMap from '../components/dashboard/DailySpendBubbleMap'
import SpendingPaceTracker from '../components/dashboard/SpendingPaceTracker'
import DashboardNudges from '../components/dashboard/DashboardNudges'
import PageHeader from '../components/layout/PageHeader'
import AppToast from '../components/common/AppToast'
import { getReminderPrefs, maybeNotify } from '../lib/reminders'
import { CATEGORIES } from '../lib/categories'
import { C } from '../lib/colors'

const fadeUp = createFadeUp(4)
const stagger = createStagger(0.04, 0.04)
const VARIANCE_WINDOW_STORAGE_KEY = 'dashboardVarianceWindowDays'
const VARIANCE_WINDOW_MAX_DAYS = 14

function normalizeVarianceWindowDays(rawValue) {
  const parsed = Number(rawValue)
  if (parsed === 7 || parsed === 14) return parsed
  return VARIANCE_WINDOW_MAX_DAYS
}

function DuePressureTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload || {}

  return (
    <div className="mini-panel p-2.5">
      <p className="text-[11px] font-semibold text-ink mb-1">{label}</p>
      <div className="flex items-center justify-between gap-3 text-[11px]">
        <span className="text-ink-3">Cum due</span>
        <span className="font-semibold tabular-nums text-expense-text">{fmt(row.cumulativeDue || 0)}</span>
      </div>
      <div className="flex items-center justify-between gap-3 text-[11px] mt-0.5">
        <span className="text-ink-3">Cum inflow</span>
        <span className="font-semibold tabular-nums text-income-text">{fmt(row.cumulativeInflow || 0)}</span>
      </div>
      <div className="flex items-center justify-between gap-3 text-[11px] mt-0.5">
        <span className="text-ink-3">Gap</span>
        <span className={`font-semibold tabular-nums ${(row.gap || 0) >= 0 ? 'text-income-text' : 'text-expense-text'}`}>
          {(row.gap || 0) >= 0 ? '+' : '-'}{fmt(Math.abs(row.gap || 0))}
        </span>
      </div>
    </div>
  )
}

function compactTick(value) {
  const n = Number(value || 0)
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${Math.round((n / 1_000_000) * 10) / 10}M`
  if (abs >= 1_000) return `${Math.round(n / 1_000)}k`
  return `${Math.round(n)}`
}

function resolveTxnTimestamp(row) {
  const rawDate = String(row?.date || '').trim()
  if (rawDate) {
    const dateOnlyMatch = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (dateOnlyMatch) {
      const ts = new Date(
        Number(dateOnlyMatch[1]),
        Number(dateOnlyMatch[2]) - 1,
        Number(dateOnlyMatch[3]),
        12,
        0,
        0,
        0,
      ).getTime()
      if (Number.isFinite(ts)) return ts
    }

    const dateTs = new Date(rawDate).getTime()
    if (Number.isFinite(dateTs)) return dateTs
  }

  const createdRaw = String(row?.created_at || '').trim()
  if (!createdRaw) return null

  const createdTs = new Date(createdRaw).getTime()
  return Number.isFinite(createdTs) ? createdTs : null
}

function DuePipelineTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload || {}

  return (
    <div className="mini-panel p-2.5 min-w-[172px]">
      <p className="text-[11px] font-semibold text-ink mb-1">{label}</p>
      <div className="space-y-0.5 text-[11px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-3">Bills</span>
          <span className="font-semibold tabular-nums text-ink">{Math.round(Number(row?.count || 0))}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-3">Amount</span>
          <span className="font-semibold tabular-nums text-expense-text">{fmt(Number(row?.amount || 0))}</span>
        </div>
      </div>
    </div>
  )
}

function WeeklyDigestTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload || {}

  return (
    <div className="mini-panel p-2.5">
      <p className="text-[11px] font-semibold text-ink mb-1">{label}</p>
      <div className="flex items-center justify-between gap-3 text-[11px]">
        <span className="text-ink-3">Current 7d</span>
        <span className="font-semibold tabular-nums text-brand">{fmt(Number(row.current || 0))}</span>
      </div>
      <div className="flex items-center justify-between gap-3 text-[11px] mt-0.5">
        <span className="text-ink-3">Previous 7d</span>
        <span className="font-semibold tabular-nums text-ink">{fmt(Number(row.previous || 0))}</span>
      </div>
      <div className="flex items-center justify-between gap-3 text-[11px] mt-0.5">
        <span className="text-ink-3">Delta</span>
        <span className={`font-semibold tabular-nums ${(Number(row.delta || 0) <= 0 && row.metric === 'Spend') || (Number(row.delta || 0) >= 0 && row.metric !== 'Spend') ? 'text-income-text' : 'text-expense-text'}`}>
          {Number(row.delta || 0) >= 0 ? '+' : '-'}{fmt(Math.abs(Number(row.delta || 0)))}
        </span>
      </div>
    </div>
  )
}

function DashboardHeroSkeleton() {
  return (
    <div className="card-hero p-6 relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="h-3 w-28 rounded-full shimmer opacity-80" />
        <div className="h-3 w-14 rounded-full shimmer opacity-70" />
      </div>

      <div className="mb-1 h-3 w-24 rounded-full shimmer opacity-70" />
      <div className="h-11 w-44 rounded-2xl shimmer opacity-85" />

      <div className="mt-3 mb-5 h-6 w-32 rounded-full shimmer opacity-75" />

      <div className="border-t mb-4 border-white/15" />

      <div className="flex justify-between gap-1.5 sm:gap-2">
        {[1, 2, 3].map((slot) => (
          <div key={slot} className="flex-1 min-w-0 px-2 sm:px-3 py-2.5 rounded-2xl bg-white/10">
            <div className="h-2.5 w-12 rounded-full shimmer opacity-70" />
            <div className="mt-1 h-3.5 w-16 rounded-full shimmer opacity-85" />
          </div>
        ))}
      </div>

      <div className="mt-4">
        <div className="flex justify-between mb-2">
          <div className="h-2.5 w-20 rounded-full shimmer opacity-70" />
          <div className="h-2.5 w-8 rounded-full shimmer opacity-80" />
        </div>
        <div className="h-2.5 rounded-full bg-white/15 overflow-hidden">
          <div className="h-full w-[56%] shimmer opacity-80" />
        </div>
      </div>
    </div>
  )
}

function DashboardRecentSkeleton() {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="section-label">Latest</p>
        <div className="h-3 w-14 rounded-full shimmer opacity-75" />
      </div>

      <div className="list-card">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={`recent-skeleton-${i}`} className="px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full shimmer opacity-80 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="h-3 w-2/5 rounded-full shimmer opacity-85" />
              <div className="mt-1.5 h-2.5 w-1/4 rounded-full shimmer opacity-70" />
            </div>
            <div className="h-3 w-16 rounded-full shimmer opacity-80" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    // FIX (defect 5.6): The old setInterval(60s) could take up to 60 seconds
    // to detect a month rollover at midnight on the 1st. The running balance
    // query would continue using the old month for that entire window.
    //
    // Fix: align the first tick to the start of the next minute for precision,
    // then use 60s intervals. On each tick, compare date/month/year and only
    // update state if something meaningful changed — avoids re-renders on ticks
    // where nothing visible to the user has changed.
    let intervalId = null

    function tick() {
      const next = new Date()
      setNow(prev => {
        if (
          prev.getFullYear() !== next.getFullYear() ||
          prev.getMonth() !== next.getMonth() ||
          prev.getDate() !== next.getDate() ||
          prev.getHours() !== next.getHours()
        ) {
          return next
        }
        return prev  // same object reference — no re-render
      })
    }

    const msUntilNextMinute = (60 - new Date().getSeconds()) * 1000
    const timeoutId = setTimeout(() => {
      tick()
      intervalId = setInterval(tick, 60_000)
    }, msUntilNextMinute)

    return () => {
      clearTimeout(timeoutId)
      if (intervalId) clearInterval(intervalId)
    }
  }, [])

  const { profile } = useAuth()

  const [showAdd, setShowAdd] = useState(false)
  const [editTxn, setEditTxn] = useState(null)
  const [addType, setAddType] = useState('expense')
  const [duplicateTxn, setDuplicateTxn] = useState(null)
  const [heroMode, setHeroMode] = useState('balance')
  const [toast, setToast] = useState(null)
  const [heavyReady, setHeavyReady] = useState(false)
  const [varianceWindowDays, setVarianceWindowDays] = useState(() => {
    if (typeof window === 'undefined') return VARIANCE_WINDOW_MAX_DAYS
    return normalizeVarianceWindowDays(window.localStorage.getItem(VARIANCE_WINDOW_STORAGE_KEY))
  })

  useEffect(() => {
    const timer = setTimeout(() => setHeavyReady(true), 16)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(VARIANCE_WINDOW_STORAGE_KEY, String(varianceWindowDays))
  }, [varianceWindowDays])

  // ── Data fetching ─────────────────────────────────────────────────────
  const {
    data: recent = [],
    loading: recentLoading,
    fetching: recentFetching,
  } = useRecentTransactions(5)
  const { data: digestTxnRows = [] } = useTransactionDigest(70, 900, { enabled: heavyReady })
  const { data: dailyExpenseTotals = {} } = useDailyExpenseTotals(VARIANCE_WINDOW_MAX_DAYS, { enabled: heavyReady })
  const {
    data: summary,
    loading: summaryLoading,
    fetching: summaryFetching,
  } = useMonthSummary(now.getFullYear(), now.getMonth() + 1)
  // Total balance should reflect all scheduled/future-dated transactions.
  // Month-level detail remains available via monthly summaries elsewhere.
  const balanceHorizonDate = useMemo(() => new Date(2099, 11, 31), [])

  const {
    balance: runningBalance,
    loading: runningBalanceLoading,
    fetching: runningBalanceFetching,
  } = useRunningBalance(
    balanceHorizonDate.getFullYear(),
    balanceHorizonDate.getMonth() + 1
  )
  const { pending: bills = [], paid: paidBills = [] } = useLiabilities({ includePaid: true, enabled: heavyReady })
  const { budgets } = useBudgets({ enabled: heavyReady })
  const bMap = useMemo(() => buildBudgetMap(budgets), [budgets])

  const heroLoading = summaryLoading || runningBalanceLoading
  const isBackgroundFetching = (!summaryLoading && summaryFetching) || (!runningBalanceLoading && runningBalanceFetching) || (!recentLoading && recentFetching)

  // ── Derived values ─────────────────────────────────────────────────────
  const earned = summary?.earned || 0
  const spent = summary?.expense || 0
  const invested = summary?.investment || 0
  const rate = savingsRate(earned, spent)

  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning'
    : hour < 17 ? 'Good afternoon'
      : hour < 21 ? 'Good evening'
        : 'Good night'

  const firstName = useMemo(
    () => profile?.display_name?.split(' ')[0] || '',
    [profile?.display_name]
  )

  const categoryLabelMap = useMemo(
    () => new Map(CATEGORIES.map((category) => [category.id, category.label])),
    []
  )

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const dayOfMonth = now.getDate()

  // FIX (defect 5.3): The old code derived dueSoon and insight from `bills`
  // directly. When the liabilities query refetched (even with identical data),
  // `bills` got a new array reference, invalidating dueSoon's memo, which
  // invalidated insight's memo — a chain re-evaluation on every background
  // refetch regardless of whether any data actually changed.
  //
  // Fix: derive stable primitive values from bills ONCE, then use those
  // primitives as memo deps. Array reference changes that don't change the
  // derived values no longer trigger downstream recalculations.
  const { dueSoonCount, dueSoonDescs, dueSoonAmount } = useMemo(() => {
    let count = 0
    let amount = 0
    const descs = []

    for (const b of bills) {
      if (daysUntil(b.due_date) <= 7) {
        count += 1
        amount += Number(b.amount || 0)
        if (descs.length < 2) descs.push(b.description)
      }
    }

    return {
      dueSoonCount: count,
      dueSoonDescs: descs.join(' · '),
      dueSoonAmount: amount,
    }
  }, [bills])

  const weeklyDigest = useMemo(() => {
    const current = now.getTime()
    const dayMs = 24 * 60 * 60 * 1000
    const last7Start = current - (7 * dayMs)
    const prev7Start = current - (14 * dayMs)

    const inLast7 = digestTxnRows.filter((row) => {
      const ts = resolveTxnTimestamp(row)
      return Number.isFinite(ts) && ts >= last7Start && ts <= current
    })
    const inPrev7 = digestTxnRows.filter((row) => {
      const ts = resolveTxnTimestamp(row)
      return Number.isFinite(ts) && ts >= prev7Start && ts < last7Start
    })

    const spendLast7 = inLast7
      .filter((row) => row?.type === 'expense')
      .reduce((sum, row) => sum + Number(row?.amount || 0), 0)
    const spendPrev7 = inPrev7
      .filter((row) => row?.type === 'expense')
      .reduce((sum, row) => sum + Number(row?.amount || 0), 0)

    const incomeLast7 = inLast7
      .filter((row) => row?.type === 'income' && !row?.is_repayment)
      .reduce((sum, row) => sum + Number(row?.amount || 0), 0)
    const incomePrev7 = inPrev7
      .filter((row) => row?.type === 'income' && !row?.is_repayment)
      .reduce((sum, row) => sum + Number(row?.amount || 0), 0)

    const categoryTotals = new Map()
    for (const row of inLast7) {
      if (row?.type !== 'expense') continue
      const key = String(row?.category || 'other')
      categoryTotals.set(key, (categoryTotals.get(key) || 0) + Number(row?.amount || 0))
    }

    const spendDelta = spendLast7 - spendPrev7
    const incomeDelta = incomeLast7 - incomePrev7
    const netLast7 = incomeLast7 - spendLast7
    const netPrev7 = incomePrev7 - spendPrev7
    const netDelta = netLast7 - netPrev7

    const comparisonSeries = [
      {
        metric: 'Spend',
        current: spendLast7,
        previous: spendPrev7,
        delta: spendDelta,
      },
      {
        metric: 'Income',
        current: incomeLast7,
        previous: incomePrev7,
        delta: incomeDelta,
      },
      {
        metric: 'Net',
        current: netLast7,
        previous: netPrev7,
        delta: netDelta,
      },
    ]

    const topCategories = [...categoryTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, value]) => ({
        id,
        label: categoryLabelMap.get(id) || id.replace(/_/g, ' '),
        value,
        sharePct: spendLast7 > 0 ? Math.round((value / spendLast7) * 100) : 0,
      }))

    return {
      spendLast7,
      spendPrev7,
      incomeLast7,
      incomePrev7,
      spendDelta,
      incomeDelta,
      netLast7,
      netPrev7,
      netDelta,
      comparisonSeries,
      topCategories,
      hasSignals: inLast7.length > 0 || inPrev7.length > 0,
    }
  }, [digestTxnRows, now, categoryLabelMap])

  const dailyVariance = useMemo(() => {
    const lookbackDays = varianceWindowDays
    const heatmapDays = []
    for (let i = lookbackDays - 1; i >= 0; i -= 1) {
      const d = new Date(now)
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const rawValue = Number(dailyExpenseTotals[key] || 0)
      const value = Number.isFinite(rawValue) ? rawValue : 0
      const weekdayIndex = (d.getDay() + 6) % 7
      heatmapDays.push({
        key,
        value,
        label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        weekdayIndex,
      })
    }

    const heatmapMax = Math.max(...heatmapDays.map((row) => row.value), 1)
    const bubbleRows = heatmapDays.map((day) => {
      const intensity = day.value > 0 ? (day.value / heatmapMax) : 0
      const bubbleSize = day.value <= 0 ? 8 : Math.round(8 + (intensity * 16))
      const bubbleFill = day.value <= 0
        ? 'rgba(16,33,63,0.10)'
        : `rgba(10,103,216,${Math.min(0.96, 0.20 + (intensity * 0.70))})`

      return {
        ...day,
        bubbleSize,
        bubbleFill,
      }
    })

    const trackedDays = bubbleRows.filter((row) => row.value > 0)
    const firstWeekdayIndex = bubbleRows[0]?.weekdayIndex || 0
    const paddedRows = [...Array(firstWeekdayIndex).fill(null), ...bubbleRows]
    while (paddedRows.length % 7 !== 0) paddedRows.push(null)

    const heatmapWeeks = []
    for (let i = 0; i < paddedRows.length; i += 7) {
      heatmapWeeks.push(paddedRows.slice(i, i + 7))
    }

    return {
      lookbackDays,
      weekdayLabels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      heatmapWeeks,
      heatmapMax,
      activeDays: trackedDays.length,
      trackedTotal: trackedDays.reduce((sum, row) => sum + row.value, 0),
      heatmapRange: `${heatmapDays[0]?.label || ''} - ${heatmapDays[heatmapDays.length - 1]?.label || ''}`,
    }
  }, [dailyExpenseTotals, now, varianceWindowDays])

  const duePipeline = useMemo(() => {
    const pendingRows = Array.isArray(bills) ? bills : []
    const paidRows = Array.isArray(paidBills) ? paidBills : []

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    monthStart.setHours(0, 0, 0, 0)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    monthEnd.setHours(23, 59, 59, 999)

    const inMonth = [...pendingRows, ...paidRows].filter((row) => {
      const ts = new Date(row?.due_date || 0).getTime()
      return Number.isFinite(ts) && ts >= monthStart.getTime() && ts <= monthEnd.getTime()
    })

    const pendingInMonth = inMonth.filter((row) => !row?.paid)
    const paidInMonth = inMonth.filter((row) => !!row?.paid)
    const overdueRows = pendingInMonth.filter((row) => daysUntil(row?.due_date) < 0)
    const dueSoonRows = pendingInMonth.filter((row) => {
      const d = daysUntil(row?.due_date)
      return d >= 0 && d <= 7
    })
    const upcomingRows = pendingInMonth.filter((row) => daysUntil(row?.due_date) > 7)

    const amountOf = (rows) => rows.reduce((sum, row) => sum + Number(row?.amount || 0), 0)

    const stageRows = [
      {
        stage: 'Planned',
        count: inMonth.length,
        amount: amountOf(inMonth),
      },
      {
        stage: 'Paid',
        count: paidInMonth.length,
        amount: amountOf(paidInMonth),
      },
      {
        stage: 'Due soon',
        count: dueSoonRows.length,
        amount: amountOf(dueSoonRows),
      },
      {
        stage: 'Overdue',
        count: overdueRows.length,
        amount: amountOf(overdueRows),
      },
      {
        stage: 'Upcoming',
        count: upcomingRows.length,
        amount: amountOf(upcomingRows),
      },
    ]

    const plannedCount = stageRows[0].count
    const paidCount = stageRows[1].count
    const overdueCount = stageRows[3].count
    const completionPct = plannedCount > 0 ? Math.round((paidCount / plannedCount) * 100) : 100
    const leakagePct = plannedCount > 0 ? Math.round((overdueCount / plannedCount) * 100) : 0

    let action = {
      label: 'Open bills',
      route: '/bills',
      note: 'Pipeline is healthy. Keep paying bills before they slide into overdue.',
    }

    if (overdueCount > 0) {
      action = {
        label: 'Fix overdue first',
        route: '/bills',
        note: `${overdueCount} bill${overdueCount > 1 ? 's are' : ' is'} overdue. Clear these first to reduce leakage in the due pipeline.`,
      }
    } else if (dueSoonRows.length > 0) {
      action = {
        label: 'Prepare due-soon bills',
        route: '/bills',
        note: `${dueSoonRows.length} bill${dueSoonRows.length > 1 ? 's are' : ' is'} due in the next 7 days. Queue payment now to preserve conversion.`,
      }
    }

    return {
      stageRows,
      completionPct,
      leakagePct,
      plannedCount,
      paidCount,
      overdueCount,
      action,
      hasData: stageRows.some((row) => row.count > 0),
    }
  }, [bills, paidBills, now])

  const cashRiskRadar = useMemo(() => {
    const current = now.getTime()
    const dayMs = 24 * 60 * 60 * 1000
    const riskHorizonDays = 14
    const timelineHorizonDays = 30
    const riskHorizonEnd = current + (riskHorizonDays * dayMs)
    const timelineHorizonEnd = current + (timelineHorizonDays * dayMs)

    const upcomingDueRows = (Array.isArray(bills) ? bills : []).filter((bill) => {
      const ts = new Date(bill?.due_date || 0).getTime()
      return Number.isFinite(ts) && ts <= riskHorizonEnd
    })

    const timelineDueRows = (Array.isArray(bills) ? bills : []).filter((bill) => {
      const ts = new Date(bill?.due_date || 0).getTime()
      return Number.isFinite(ts) && ts <= timelineHorizonEnd
    })

    const obligations14 = upcomingDueRows.reduce((sum, bill) => sum + Number(bill?.amount || 0), 0)

    const income28 = (Array.isArray(digestTxnRows) ? digestTxnRows : [])
      .filter((row) => {
        if (row?.type !== 'income' || row?.is_repayment) return false
        const ts = resolveTxnTimestamp(row)
        return Number.isFinite(ts) && ts >= (current - (28 * dayMs)) && ts <= current
      })
      .reduce((sum, row) => sum + Number(row?.amount || 0), 0)

    const projectedInflow14 = income28 > 0
      ? (income28 / 28) * 14
      : (earned > 0 ? (earned / Math.max(dayOfMonth, 1)) * 14 : 0)
    const projectedDailyInflow = projectedInflow14 > 0 ? projectedInflow14 / 14 : 0

    const coverageRatio = projectedInflow14 > 0
      ? obligations14 / projectedInflow14
      : (obligations14 > 0 ? 9 : 0)

    let risk = 'Low'
    if (coverageRatio > 0.85) risk = 'High'
    else if (coverageRatio > 0.45) risk = 'Medium'

    const buffer = projectedInflow14 - obligations14

    const dueByDate = new Map()
    for (const bill of timelineDueRows) {
      const key = String(bill?.due_date || '').slice(0, 10)
      if (!key) continue
      dueByDate.set(key, (dueByDate.get(key) || 0) + Number(bill?.amount || 0))
    }

    let cumulativeDue = 0
    let cumulativeInflow = 0
    const timelineSeries = Array.from({ length: timelineHorizonDays }, (_, index) => {
      const d = new Date(now)
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() + index)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const due = dueByDate.get(key) || 0

      cumulativeDue += due
      cumulativeInflow += projectedDailyInflow

      return {
        day: index + 1,
        label: index % 5 === 0
          ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
          : '',
        cumulativeDue,
        cumulativeInflow,
        gap: cumulativeInflow - cumulativeDue,
      }
    })

    const worstGap = Math.min(...timelineSeries.map((row) => row.gap), buffer)

    let action = {
      label: 'Open monthly plan',
      route: '/monthly',
      note: 'Buffer looks healthy. Keep planned due coverage and route extra cash intentionally.',
    }

    if (risk === 'High') {
      action = {
        label: 'Review bills now',
        route: '/bills',
        note: 'Obligations are close to predicted inflow. Sequence due dates and cut discretionary spend this week.',
      }
    } else if (risk === 'Medium') {
      action = {
        label: 'Protect cash buffer',
        route: '/monthly',
        note: 'Coverage is moderate. Reserve bill cash before optional spending this week.',
      }
    }

    return {
      obligations14,
      projectedInflow14,
      buffer,
      risk,
      dueCount: upcomingDueRows.length,
      timelineSeries,
      worstGap,
      action,
    }
  }, [bills, digestTxnRows, earned, dayOfMonth, now])

  useEffect(() => {
    const prefs = getReminderPrefs()
    if (!prefs.enabled) return

    if (prefs.bill_due && dueSoonCount > 0) {
      maybeNotify({
        id: 'bill-due',
        title: 'Kosha reminder: bills due soon',
        body: `${dueSoonCount} bill${dueSoonCount > 1 ? 's' : ''} need attention.`,
        cooldownMs: 12 * 60 * 60 * 1000,
      })
    }

    if (prefs.spending_pace && earned > 0) {
      const spendPct = spent / earned
      const dayPct = dayOfMonth / daysInMonth
      if (spendPct > dayPct + 0.15) {
        maybeNotify({
          id: 'spending-pace',
          title: 'Kosha reminder: spending pace is high',
          body: 'Current spending is running above this month\'s pace.',
          cooldownMs: 12 * 60 * 60 * 1000,
        })
      }
    }

    // Daily spend spike alert (yesterday > 2x average)
    if (prefs.spending_pace && dailyExpenseTotals && typeof dailyExpenseTotals === 'object') {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const yKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`
      const ySpend = Number(dailyExpenseTotals[yKey] || 0)
      const vals = Object.values(dailyExpenseTotals).map(Number).filter(v => Number.isFinite(v) && v > 0)
      const avg = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0
      if (ySpend > 0 && avg > 0 && ySpend > avg * 2) {
        maybeNotify({
          id: 'daily-spike',
          title: 'Kosha: unusual spend spike',
          body: `Yesterday\'s spend was ${Math.round(ySpend / avg)}× your daily average.`,
          cooldownMs: 24 * 60 * 60 * 1000,
        })
      }
    }
  }, [dueSoonCount, earned, spent, dayOfMonth, daysInMonth, dailyExpenseTotals])

  // ── Stable callbacks — useCallback deps are all stable primitives ──────
  const handleDelete = useCallback(async (id) => {
    if (!id) return
    try {
      await removeTransactionMutation(id)
    } catch (e) {
      setToast(e.message || 'Could not delete transaction.')
      setTimeout(() => setToast(null), 4000)
    }
  }, [])

  const handleTap = useCallback((t) => {
    setEditTxn(t)
    setDuplicateTxn(null)
    setAddType(t.type)
    setShowAdd(true)
  }, [])

  const handleDuplicate = useCallback((txn) => {
    setEditTxn(null)
    setDuplicateTxn(txn)
    setAddType(txn.type)
    setShowAdd(true)
  }, [])

  const handleHeroModeToggle = useCallback(() => {
    setHeroMode(m => m === 'balance' ? 'safe' : 'balance')
  }, [])

  const handleVarianceWindowChange = useCallback((nextDays) => {
    setVarianceWindowDays((prev) => {
      const normalized = normalizeVarianceWindowDays(nextDays)
      return prev === normalized ? prev : normalized
    })
  }, [])

  return (
    <div className="page">
      <PageHeader title="Dashboard" className="mb-3" />
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="page-stack pt-0"
      >

        {/* ── Greeting ──────────────────────────────────────────────── */}
        <motion.div variants={fadeUp}>
          <p className="text-caption text-ink-3">
            {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="text-[20px] md:text-[24px] font-bold text-ink tracking-tight">
            {greeting}{firstName ? `, ${firstName}` : ''} 👋
          </h1>
          {isBackgroundFetching && (
            <p className="text-[11px] text-ink-3 mt-1">Syncing latest data...</p>
          )}
        </motion.div>

        {/* ── Hero card — sub-component, renders independently ─────── */}
        <motion.div variants={fadeUp}>
          {heroLoading ? <DashboardHeroSkeleton /> : (
            <DashboardHeroCard
              now={balanceHorizonDate}
              runningBalance={runningBalance}
              rate={rate}
              earned={earned}
              spent={spent}
              invested={invested}
              bills={bills}
              heroMode={heroMode}
              onHeroModeToggle={handleHeroModeToggle}
            />
          )}
        </motion.div>

        {/* ── Actionable nudges ─────────────────────────────────── */}
        {heavyReady && (earned > 0 || dueSoonCount > 0) && (
          <motion.div variants={fadeUp}>
            <DashboardNudges
              earned={earned}
              spent={spent}
              invested={invested}
              dayOfMonth={dayOfMonth}
              daysInMonth={daysInMonth}
              dailyExpenseTotals={dailyExpenseTotals}
              dueSoonCount={dueSoonCount}
              dueSoonAmount={dueSoonAmount}
              weeklyDigest={weeklyDigest}
              budgetMap={bMap}
              byCategory={summary?.byCategory}
            />
          </motion.div>
        )}

        {/* ── Daily spend bubble map ─────────────────────────────── */}
        <motion.div variants={fadeUp}>
          <DailySpendBubbleMap
            dailyVariance={dailyVariance}
            selectedWindowDays={varianceWindowDays}
            onWindowDaysChange={handleVarianceWindowChange}
          />
        </motion.div>

        {/* ── Spending pace tracker ──────────────────────────────── */}
        {heavyReady && earned > 0 && (
          <motion.div variants={fadeUp}>
            <SpendingPaceTracker
              dailyExpenseTotals={dailyExpenseTotals}
              now={now}
              earned={earned}
              spent={spent}
            />
          </motion.div>
        )}

        <motion.div variants={fadeUp}>
          <div className="card p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-warning-bg flex items-center justify-center shrink-0">
                  <ShieldAlert size={15} className="text-warning-text" />
                </div>
                <div>
                  <p className="section-label">Cash Risk Radar</p>
                  <p className="text-caption text-ink-3 mt-0.5">14-day obligations vs predicted inflow coverage</p>
                </div>
              </div>
              <span className={`text-[10px] px-2 py-1 rounded-pill font-semibold ${cashRiskRadar.risk === 'Low'
                ? 'bg-income-bg text-income-text'
                : cashRiskRadar.risk === 'Medium'
                  ? 'bg-warning-bg text-warning-text'
                  : 'bg-expense-bg text-expense-text'
                }`}>
                {cashRiskRadar.risk} risk
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-2.5">
              <div className="mini-panel p-2.5">
                <p className="text-[10px] text-ink-3">Obligations</p>
                <p className="text-[12px] font-bold text-warning-text tabular-nums">{fmt(cashRiskRadar.obligations14)}</p>
              </div>
              <div className="mini-panel p-2.5">
                <p className="text-[10px] text-ink-3">Pred. inflow</p>
                <p className="text-[12px] font-bold text-income-text tabular-nums">{fmt(cashRiskRadar.projectedInflow14)}</p>
              </div>
              <div className="mini-panel p-2.5">
                <p className="text-[10px] text-ink-3">Buffer</p>
                <p className={`text-[12px] font-bold tabular-nums ${cashRiskRadar.buffer >= 0 ? 'text-income-text' : 'text-expense-text'}`}>
                  {cashRiskRadar.buffer >= 0 ? '+' : '-'}{fmt(Math.abs(cashRiskRadar.buffer))}
                </p>
              </div>
            </div>

            <div className="h-2 rounded-pill bg-kosha-surface-2 overflow-hidden">
              <div className="h-full rounded-pill bg-kosha-border" />
            </div>

            <div className="mt-2.5 mini-panel p-2.5">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={cashRiskRadar.timelineSeries} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(16,33,63,0.10)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: 'rgba(94,109,143,0.95)' }}
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                  />
                  <YAxis hide />
                  <RechartsTooltip content={<DuePressureTooltip />} />
                  <ReferenceLine y={0} stroke="rgba(16,33,63,0.18)" />
                  <Line
                    type="monotone"
                    dataKey="cumulativeDue"
                    stroke={C.chartExpense}
                    strokeWidth={2.1}
                    dot={false}
                    activeDot={{ r: 4, fill: C.chartExpense, stroke: '#fff', strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulativeInflow"
                    stroke={C.chartIncome}
                    strokeWidth={2.1}
                    dot={false}
                    activeDot={{ r: 4, fill: C.chartIncome, stroke: '#fff', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <p className="text-[11px] text-ink-3 mt-2">
              {cashRiskRadar.dueCount} bill{cashRiskRadar.dueCount !== 1 ? 's' : ''} fall in the next 14 days. {cashRiskRadar.action.note}
            </p>
            <p className="text-[11px] text-ink-3 mt-1">
              30-day projected worst cash gap: {cashRiskRadar.worstGap >= 0 ? '+' : '-'}{fmt(Math.abs(cashRiskRadar.worstGap))}.
            </p>

            <button
              type="button"
              onClick={() => navigate(cashRiskRadar.action.route)}
              className="btn-secondary h-9 px-3 text-[11px] mt-2"
            >
              {cashRiskRadar.action.label}
            </button>
          </div>
        </motion.div>

        <motion.div variants={fadeUp}>
          <div className="card p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <p className="section-label">Due pipeline conversion</p>
                <p className="text-caption text-ink-3 mt-0.5">Lifecycle conversion for this month: planned, paid, due soon, overdue</p>
              </div>
              <span className={`text-[10px] px-2 py-1 rounded-pill font-semibold ${duePipeline.leakagePct > 0 ? 'bg-warning-bg text-warning-text' : 'bg-income-bg text-income-text'}`}>
                {duePipeline.completionPct}% converted
              </span>
            </div>

            {duePipeline.hasData ? (
              <>
                <div className="grid grid-cols-3 gap-2 mb-2.5">
                  <div className="mini-panel p-2.5">
                    <p className="text-[10px] text-ink-3">Planned bills</p>
                    <p className="text-[12px] font-bold tabular-nums text-ink">{duePipeline.plannedCount}</p>
                  </div>
                  <div className="mini-panel p-2.5">
                    <p className="text-[10px] text-ink-3">Paid bills</p>
                    <p className="text-[12px] font-bold tabular-nums text-income-text">{duePipeline.paidCount}</p>
                  </div>
                  <div className="mini-panel p-2.5">
                    <p className="text-[10px] text-ink-3">Leakage</p>
                    <p className={`text-[12px] font-bold tabular-nums ${duePipeline.overdueCount > 0 ? 'text-warning-text' : 'text-income-text'}`}>
                      {duePipeline.leakagePct}%
                    </p>
                  </div>
                </div>

                <div className="mini-panel p-2.5">
                  <ResponsiveContainer width="100%" height={198}>
                    <BarChart data={duePipeline.stageRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(16,33,63,0.10)" />
                      <XAxis
                        dataKey="stage"
                        tick={{ fontSize: 10, fill: 'rgba(94,109,143,0.95)', fontWeight: 600 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        yAxisId="left"
                        allowDecimals={false}
                        tick={{ fontSize: 10, fill: 'rgba(94,109,143,0.95)' }}
                        axisLine={false}
                        tickLine={false}
                        width={28}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tickFormatter={compactTick}
                        tick={{ fontSize: 10, fill: 'rgba(94,109,143,0.95)' }}
                        axisLine={false}
                        tickLine={false}
                        width={34}
                      />
                      <RechartsTooltip content={<DuePipelineTooltip />} />
                      <Bar yAxisId="left" dataKey="count" name="Bills" fill={C.brandMid} radius={[6, 6, 0, 0]} maxBarSize={18} />
                      <Bar yAxisId="right" dataKey="amount" name="Amount" fill="rgba(242,106,134,0.72)" radius={[6, 6, 0, 0]} maxBarSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <p className="text-[11px] text-ink-3 mt-2">{duePipeline.action.note}</p>

                <button
                  type="button"
                  onClick={() => navigate(duePipeline.action.route)}
                  className="btn-secondary h-9 px-3 text-[11px] mt-2"
                >
                  {duePipeline.action.label}
                </button>
              </>
            ) : (
              <p className="text-[11px] text-ink-3">No bills in this month yet. Add due items to start pipeline tracking.</p>
            )}
          </div>
        </motion.div>

        {/* ── Bill alert ────────────────────────────────────────────── */}
        {dueSoonCount > 0 && (
          <motion.div variants={fadeUp}>
            <button onClick={() => navigate('/bills')}
              className="card w-full flex items-center justify-between px-4 py-4 text-left">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-warning-bg flex items-center justify-center shrink-0">
                  <Bell size={16} className="text-warning-text" />
                </div>
                <div>
                  <p className="text-body font-semibold text-ink">
                    {dueSoonCount} bill{dueSoonCount > 1 ? 's' : ''} due soon
                  </p>
                  <p className="text-label text-ink-3">{dueSoonDescs}</p>
                </div>
              </div>
              <ArrowRight size={15} className="text-ink-4 shrink-0" />
            </button>
          </motion.div>
        )}

        {heavyReady && weeklyDigest.hasSignals && (
          <motion.div variants={fadeUp}>
            <div className="card p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="section-label">What changed this week</p>
                  <p className="text-caption text-ink-3 mt-0.5">7-day vs previous 7-day digest</p>
                </div>
                <span className={`text-[11px] px-2.5 py-1 rounded-pill font-semibold border ${weeklyDigest.spendDelta <= 0 ? 'bg-income-bg text-income-text border-income-border' : 'bg-warning-bg text-warning-text border-warning-border'}`}>
                  {weeklyDigest.spendDelta <= 0 ? 'Spending cooled' : 'Spending up'}
                </span>
              </div>

              <div className="mini-panel p-2.5 mb-2.5">
                <ResponsiveContainer width="100%" height={214}>
                  <BarChart data={weeklyDigest.comparisonSeries} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(16,33,63,0.10)" />
                    <XAxis
                      dataKey="metric"
                      tick={{ fontSize: 10, fill: 'rgba(94,109,143,0.95)', fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={compactTick}
                      tick={{ fontSize: 10, fill: 'rgba(94,109,143,0.95)' }}
                      axisLine={false}
                      tickLine={false}
                      width={34}
                    />
                    <RechartsTooltip content={<WeeklyDigestTooltip />} />
                    <Bar dataKey="current" name="Current 7d" fill={C.brand} radius={[6, 6, 0, 0]} />
                    <Bar dataKey="previous" name="Previous 7d" fill="rgba(10, 103, 216, 0.34)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-2.5">
                <div className="mini-panel p-2.5">
                  <p className="text-[10px] text-ink-3">Spend delta</p>
                  <p className={`text-[12px] font-bold tabular-nums ${weeklyDigest.spendDelta <= 0 ? 'text-income-text' : 'text-expense-text'}`}>
                    {weeklyDigest.spendDelta >= 0 ? '+' : '-'}{fmt(Math.abs(weeklyDigest.spendDelta))}
                  </p>
                </div>
                <div className="mini-panel p-2.5">
                  <p className="text-[10px] text-ink-3">Income delta</p>
                  <p className={`text-[12px] font-bold tabular-nums ${weeklyDigest.incomeDelta >= 0 ? 'text-income-text' : 'text-expense-text'}`}>
                    {weeklyDigest.incomeDelta >= 0 ? '+' : '-'}{fmt(Math.abs(weeklyDigest.incomeDelta))}
                  </p>
                </div>
                <div className="mini-panel p-2.5">
                  <p className="text-[10px] text-ink-3">Net delta</p>
                  <p className={`text-[12px] font-bold tabular-nums ${weeklyDigest.netDelta >= 0 ? 'text-income-text' : 'text-expense-text'}`}>
                    {weeklyDigest.netDelta >= 0 ? '+' : '-'}{fmt(Math.abs(weeklyDigest.netDelta))}
                  </p>
                </div>
              </div>

              {weeklyDigest.topCategories.length > 0 && (() => {
                const row = weeklyDigest.topCategories[0]
                return (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-ink-3">Top spend category this week</p>
                    <div key={row.id} className="mini-panel px-2.5 py-2">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-[11px] font-semibold text-ink-2 truncate">{row.label}</p>
                        <p className="text-[11px] font-semibold text-expense-text tabular-nums shrink-0">{fmt(row.value)}</p>
                      </div>
                      <div className="h-1.5 rounded-pill bg-kosha-border overflow-hidden">
                        <div className="h-full rounded-pill bg-expense-text" style={{ width: `${Math.max(8, row.sharePct)}%` }} />
                      </div>
                      <p className="text-[10px] text-ink-3 tabular-nums mt-1">{row.sharePct}% of current-week spend</p>
                    </div>
                  </div>
                )
              })()}
            </div>
          </motion.div>
        )}

        {/* ── Recent transactions — sub-component ──────────────────── */}
        <motion.div variants={fadeUp}>
          {recentLoading ? <DashboardRecentSkeleton /> : (
            <DashboardRecentTransactions
              recent={recent}
              onDelete={handleDelete}
              onTap={handleTap}
              onDuplicate={handleDuplicate}
            />
          )}
        </motion.div>

      </motion.div>

      <AppToast message={toast} onDismiss={() => setToast(null)} />

      {/* FAB */}
      <button className="fab" onClick={() => { setEditTxn(null); setAddType('expense'); setShowAdd(true) }}>
        <Plus size={24} className="text-white" />
      </button>

      <AddTransactionSheet
        open={showAdd}
        duplicateTxn={duplicateTxn}
        onClose={() => { setShowAdd(false); setDuplicateTxn(null) }}
        editTxn={editTxn}
        initialType={addType}
      />
    </div>
  )
}

