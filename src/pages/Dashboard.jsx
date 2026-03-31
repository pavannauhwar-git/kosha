import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Bell, ArrowRight, Plus, ShieldAlert, TrendingUp, WalletCards } from 'lucide-react'
import {
  useRecentTransactions,
  useTransactionDigest,
  useTodayExpenses,
  useMonthSummary,
  useRunningBalance,
  removeTransactionMutation,
} from '../hooks/useTransactions'
import { useLiabilities } from '../hooks/useLiabilities'
import { useAuth } from '../context/AuthContext'
import AddTransactionSheet from '../components/transactions/AddTransactionSheet'
import { fmt, savingsRate, daysUntil } from '../lib/utils'
import { useNavigate } from 'react-router-dom'
import { createFadeUp, createStagger } from '../lib/animations'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
} from 'recharts'

// FIX (defect 4.3): Extracted sub-components. Each renders independently —
// a transaction list refetch no longer re-renders the hero card or pace card,
// and a balance update no longer re-renders the transaction list.
import DashboardHeroCard from '../components/cards/dashboard/DashboardHeroCard'
import DashboardPaceCard from '../components/cards/dashboard/DashboardPaceCard'
import DashboardRecentTransactions from '../components/dashboard/DashboardRecentTransactions'
import DashboardActivityFeed from '../components/dashboard/DashboardActivityFeed'
import PageHeader from '../components/layout/PageHeader'
import AppToast from '../components/common/AppToast'
import { useFinancialEvents } from '../hooks/useFinancialEvents'
import { getReminderPrefs, maybeNotify } from '../lib/reminders'
import { CATEGORIES } from '../lib/categories'

const fadeUp = createFadeUp(4, 0.18)
const stagger = createStagger(0.04, 0.04)

const CONTROLLABLE_CATEGORY_IDS = new Set([
  'food',
  'groceries',
  'entertainment',
  'shopping',
  'dining_out',
  'travel',
  'personal',
  'subscription',
  'salon',
  'gym',
  'pets',
  'electronics',
  'home',
  'other',
])

function quantile(sortedValues, p) {
  if (!sortedValues.length) return 0
  const index = (sortedValues.length - 1) * p
  const lowerIndex = Math.floor(index)
  const upperIndex = Math.ceil(index)

  if (lowerIndex === upperIndex) return sortedValues[lowerIndex]

  const weight = index - lowerIndex
  return (sortedValues[lowerIndex] * (1 - weight)) + (sortedValues[upperIndex] * weight)
}

function DuePressureTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload || {}

  return (
    <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5 shadow-card">
      <p className="text-[11px] font-semibold text-ink mb-1">{label}</p>
      <div className="flex items-center justify-between gap-3 text-[11px]">
        <span className="text-ink-3">Cum due</span>
        <span className="font-semibold tabular-nums text-warning-text">{fmt(row.cumulativeDue || 0)}</span>
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

function DigestMetricCard({ label, value, tone = 'text-ink', caption }) {
  return (
    <div className="rounded-card bg-kosha-surface px-3 py-2.5">
      <p className="text-[10px] text-ink-3 mb-1">{label}</p>
      <p className={`text-[19px] leading-none font-bold tabular-nums ${tone}`}>{value}</p>
      {caption && <p className="text-[10px] text-ink-3 mt-1">{caption}</p>}
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
  const [opportunityCutPct, setOpportunityCutPct] = useState(12)
  const [heatmapScale, setHeatmapScale] = useState('quantile')

  useEffect(() => {
    const timer = setTimeout(() => setHeavyReady(true), 50)
    return () => clearTimeout(timer)
  }, [])

  // ── Data fetching ─────────────────────────────────────────────────────
  const {
    data: recent = [],
    loading: recentLoading,
    fetching: recentFetching,
  } = useRecentTransactions(5)
  const { data: digestTxnRows = [] } = useTransactionDigest(70, 900, { enabled: heavyReady })
  const { todaySpend, loading: todaySpendLoading } = useTodayExpenses({ enabled: heavyReady })
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
  const { pending: bills = [] } = useLiabilities({ includePaid: false, enabled: heavyReady })
  const { data: financialEvents = [] } = useFinancialEvents(3, { enabled: heavyReady })

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
  const paceOk = earned === 0 || spent / earned <= dayOfMonth / daysInMonth + 0.05

  // FIX (defect 5.3): The old code derived dueSoon and insight from `bills`
  // directly. When the liabilities query refetched (even with identical data),
  // `bills` got a new array reference, invalidating dueSoon's memo, which
  // invalidated insight's memo — a chain re-evaluation on every background
  // refetch regardless of whether any data actually changed.
  //
  // Fix: derive stable primitive values from bills ONCE, then use those
  // primitives as memo deps. Array reference changes that don't change the
  // derived values no longer trigger downstream recalculations.
  const { dueSoonCount, dueSoonDescs } = useMemo(() => {
    let count = 0
    const descs = []

    for (const b of bills) {
      if (daysUntil(b.due_date) <= 7) {
        count += 1
        if (descs.length < 2) descs.push(b.description)
      }
    }

    return {
      dueSoonCount: count,
      dueSoonDescs: descs.join(' · '),
    }
  }, [bills])

  const weeklyDigest = useMemo(() => {
    const current = now.getTime()
    const dayMs = 24 * 60 * 60 * 1000
    const last7Start = current - (7 * dayMs)
    const prev7Start = current - (14 * dayMs)

    const inLast7 = digestTxnRows.filter((row) => {
      const ts = new Date(row?.date || row?.created_at || 0).getTime()
      return Number.isFinite(ts) && ts >= last7Start && ts <= current
    })
    const inPrev7 = digestTxnRows.filter((row) => {
      const ts = new Date(row?.date || row?.created_at || 0).getTime()
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

    const topCategory = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1])[0] || null
    const spendDelta = spendLast7 - spendPrev7
    const incomeDelta = incomeLast7 - incomePrev7

    return {
      spendLast7,
      incomeLast7,
      spendDelta,
      incomeDelta,
      topCategory,
      hasSignals: inLast7.length > 0 || inPrev7.length > 0,
    }
  }, [digestTxnRows, now])

  const dailyVariance = useMemo(() => {
    const byDate = new Map()
    for (const row of digestTxnRows) {
      if (row?.type !== 'expense') continue
      const key = String(row?.date || '').slice(0, 10)
      if (!key) continue
      byDate.set(key, (byDate.get(key) || 0) + Number(row?.amount || 0))
    }

    const baselineSeries = []
    for (let i = 7; i >= 1; i -= 1) {
      const d = new Date(now)
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      baselineSeries.push(byDate.get(key) || 0)
    }

    const baseline = baselineSeries.length
      ? baselineSeries.reduce((sum, value) => sum + value, 0) / baselineSeries.length
      : 0

    const todayValue = Number(todaySpend || 0)
    const variance = todayValue - baseline
    const variancePct = baseline > 0 ? Math.round((variance / baseline) * 100) : null
    const sparkValues = [...baselineSeries, todayValue]
    const sparkMax = Math.max(...sparkValues, 1)

    const heatmapDays = []
    for (let i = 55; i >= 0; i -= 1) {
      const d = new Date(now)
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const value = byDate.get(key) || 0
      heatmapDays.push({
        key,
        value,
        label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      })
    }

    const heatmapMax = Math.max(...heatmapDays.map((row) => row.value), 1)
    const nonZeroHeatmapValues = heatmapDays
      .map((row) => row.value)
      .filter((value) => value > 0)
      .sort((a, b) => a - b)
    const heatmapQuantiles = {
      q25: quantile(nonZeroHeatmapValues, 0.25),
      q50: quantile(nonZeroHeatmapValues, 0.5),
      q75: quantile(nonZeroHeatmapValues, 0.75),
      q90: quantile(nonZeroHeatmapValues, 0.9),
    }
    const heatmapWeeks = []
    for (let i = 0; i < heatmapDays.length; i += 7) {
      heatmapWeeks.push(heatmapDays.slice(i, i + 7))
    }

    return {
      baseline,
      variance,
      variancePct,
      todayValue,
      sparkValues,
      sparkMax,
      heatmapWeeks,
      heatmapMax,
      heatmapQuantiles,
      heatmapRange: `${heatmapDays[0]?.label || ''} - ${heatmapDays[heatmapDays.length - 1]?.label || ''}`,
    }
  }, [digestTxnRows, now, todaySpend])

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
        const ts = new Date(row?.date || row?.created_at || 0).getTime()
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

  const spendingDrift = useMemo(() => {
    const current = now.getTime()
    const dayMs = 24 * 60 * 60 * 1000
    const thisWeekStart = current - (7 * dayMs)
    const prior4WeekStart = thisWeekStart - (28 * dayMs)

    const thisWeekRows = (Array.isArray(digestTxnRows) ? digestTxnRows : []).filter((row) => {
      if (row?.type !== 'expense') return false
      const ts = new Date(row?.date || row?.created_at || 0).getTime()
      return Number.isFinite(ts) && ts >= thisWeekStart && ts <= current
    })

    const prior4WeekRows = (Array.isArray(digestTxnRows) ? digestTxnRows : []).filter((row) => {
      if (row?.type !== 'expense') return false
      const ts = new Date(row?.date || row?.created_at || 0).getTime()
      return Number.isFinite(ts) && ts >= prior4WeekStart && ts < thisWeekStart
    })

    const thisWeekSpend = thisWeekRows.reduce((sum, row) => sum + Number(row?.amount || 0), 0)
    const prior4WeekSpend = prior4WeekRows.reduce((sum, row) => sum + Number(row?.amount || 0), 0)
    const avg4WeekSpend = prior4WeekSpend / 4
    const driftAmount = thisWeekSpend - avg4WeekSpend
    const driftPct = avg4WeekSpend > 0 ? Math.round((driftAmount / avg4WeekSpend) * 100) : null

    const spendByDate = new Map()
    for (const row of (Array.isArray(digestTxnRows) ? digestTxnRows : [])) {
      if (row?.type !== 'expense') continue
      const key = String(row?.date || '').slice(0, 10)
      if (!key) continue
      spendByDate.set(key, (spendByDate.get(key) || 0) + Number(row?.amount || 0))
    }

    const nowStart = new Date(now)
    nowStart.setHours(0, 0, 0, 0)
    const daysSinceMonday = (nowStart.getDay() + 6) % 7
    const currentWeekMonday = new Date(nowStart)
    currentWeekMonday.setDate(nowStart.getDate() - daysSinceMonday)

    const seasonalityWeeks = []
    for (let weekOffset = 7; weekOffset >= 0; weekOffset -= 1) {
      const weekStart = new Date(currentWeekMonday)
      weekStart.setDate(currentWeekMonday.getDate() - (weekOffset * 7))

      const days = []
      for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
        const d = new Date(weekStart)
        d.setDate(weekStart.getDate() + dayOffset)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        const isFuture = d.getTime() > nowStart.getTime()
        const value = isFuture ? 0 : (spendByDate.get(key) || 0)

        days.push({
          key,
          value,
          isFuture,
          label: d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        })
      }

      seasonalityWeeks.push({
        label: weekStart.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
        days,
      })
    }

    const seasonalityValues = seasonalityWeeks
      .flatMap((week) => week.days)
      .filter((day) => !day.isFuture && day.value > 0)
      .map((day) => day.value)
      .sort((a, b) => a - b)

    const seasonalityQuantiles = {
      q25: quantile(seasonalityValues, 0.25),
      q50: quantile(seasonalityValues, 0.5),
      q75: quantile(seasonalityValues, 0.75),
      q90: quantile(seasonalityValues, 0.9),
    }

    return {
      thisWeekSpend,
      avg4WeekSpend,
      driftAmount,
      driftPct,
      seasonalityWeeks,
      seasonalityQuantiles,
      weekdayLabels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
      hasData: thisWeekRows.length > 0 || prior4WeekRows.length > 0,
    }
  }, [digestTxnRows, now])

  const opportunityWallet = useMemo(() => {
    const categoryRows = Object.entries(summary?.byCategory || {})
      .map(([id, amount]) => ({
        id,
        label: categoryLabelMap.get(id) || id,
        amount: Number(amount || 0),
      }))
      .filter((row) => row.amount > 0 && CONTROLLABLE_CATEGORY_IDS.has(row.id))
      .sort((a, b) => b.amount - a.amount)

    const selectedRows = categoryRows.slice(0, 3).map((row) => ({
      ...row,
      targetCut: (row.amount * opportunityCutPct) / 100,
    }))

    const recoverable = selectedRows.reduce((sum, row) => sum + row.targetCut, 0)
    const monthNet = earned - spent - invested
    const projectedNet = monthNet + recoverable

    return {
      hasData: selectedRows.length > 0,
      rows: selectedRows,
      recoverable,
      monthNet,
      projectedNet,
    }
  }, [summary?.byCategory, categoryLabelMap, opportunityCutPct, earned, spent, invested])

  const weeklyTopCategoryLabel = useMemo(() => {
    if (!weeklyDigest.topCategory) return null
    const raw = String(weeklyDigest.topCategory[0] || '')
    return categoryLabelMap.get(raw) || raw.replace(/_/g, ' ')
  }, [weeklyDigest.topCategory, categoryLabelMap])

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
  }, [dueSoonCount, earned, spent, dayOfMonth, daysInMonth])

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

        {/* ── Daily variance ──────────────────────────────────────── */}
        <motion.div variants={fadeUp}>
          <div className="card p-4 border-0">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <p className="section-label">Daily variance</p>
                <p className="text-caption text-ink-3 mt-0.5">Today vs trailing 7-day daily spend</p>
              </div>
              {!todaySpendLoading && (
                <span className={`text-[11px] px-2 py-1 rounded-pill font-semibold ${dailyVariance.variance <= 0 ? 'bg-income-bg text-income-text' : 'bg-warning-bg text-warning-text'}`}>
                  {dailyVariance.variance === 0
                    ? 'On baseline'
                    : dailyVariance.variance < 0
                      ? `${fmt(Math.abs(dailyVariance.variance))} below`
                      : `${fmt(Math.abs(dailyVariance.variance))} above`}
                </span>
              )}
            </div>

            {todaySpendLoading ? (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-card h-14 shimmer opacity-80" />
                  <div className="rounded-card h-14 shimmer opacity-80" />
                </div>
                <div className="h-2.5 w-full rounded-full shimmer opacity-70" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 mb-2.5">
                  <div className="rounded-card bg-kosha-surface-2 p-2.5">
                    <p className="text-[10px] text-ink-3">Today spend</p>
                    <p className="text-[13px] font-bold text-expense-text tabular-nums">{fmt(dailyVariance.todayValue)}</p>
                  </div>
                  <div className="rounded-card bg-kosha-surface-2 p-2.5">
                    <p className="text-[10px] text-ink-3">7-day avg/day</p>
                    <p className="text-[13px] font-bold text-ink tabular-nums">{fmt(dailyVariance.baseline)}</p>
                  </div>
                </div>

                <p className="text-[11px] text-ink-3">
                  {dailyVariance.variancePct == null
                    ? 'No recent daily baseline yet. Keep logging daily expenses for variance trends.'
                    : `Variance is ${dailyVariance.variancePct >= 0 ? '+' : ''}${dailyVariance.variancePct}% vs trailing daily average.`}
                </p>

                <div className="mt-2.5 space-y-1.5">
                  {dailyVariance.sparkValues.map((value, index) => {
                    const widthPct = Math.max(10, Math.round((value / dailyVariance.sparkMax) * 100))
                    const isToday = index === dailyVariance.sparkValues.length - 1
                    return (
                      <div key={`variance-bar-${index}`} className="flex items-center gap-2">
                        <span className="w-10 shrink-0 text-[10px] text-ink-3 tabular-nums">
                          {isToday ? 'Today' : `D-${dailyVariance.sparkValues.length - index - 1}`}
                        </span>
                        <div className="h-2 w-full rounded-pill bg-kosha-surface-2 overflow-hidden">
                          <div
                            className={`h-full rounded-pill ${isToday ? 'bg-brand' : 'bg-brand-container'}`}
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="mt-3 border-t border-kosha-border pt-2.5">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <p className="text-[11px] text-ink-3">8-week spend heatmap</p>
                    <div className="inline-flex rounded-pill border border-kosha-border bg-kosha-surface p-0.5">
                      {[
                        { id: 'quantile', label: 'Relative' },
                        { id: 'linear', label: 'Absolute' },
                      ].map((mode) => (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={() => setHeatmapScale(mode.id)}
                          className={`h-6 px-2 rounded-pill text-[10px] font-semibold transition-colors ${
                            heatmapScale === mode.id
                              ? 'bg-brand text-white'
                              : 'text-ink-2 hover:bg-kosha-surface-2'
                          }`}
                        >
                          {mode.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <p className="text-[10px] text-ink-3 mb-1.5">
                    {heatmapScale === 'quantile'
                      ? 'Relative mode ranks each day into percentile bands, so you can compare pattern intensity even when spend values are tightly clustered.'
                      : 'Absolute mode maps raw spend directly to color intensity, so the darkest cell is the highest-spend day in this range.'}
                  </p>

                  <p className="text-[10px] text-ink-3 mb-1.5">
                    {heatmapScale === 'quantile'
                      ? (dailyVariance.heatmapQuantiles.q90 > 0
                          ? `Relative bands: Q25 ${fmt(dailyVariance.heatmapQuantiles.q25)} · Q50 ${fmt(dailyVariance.heatmapQuantiles.q50)} · Q75 ${fmt(dailyVariance.heatmapQuantiles.q75)} · Q90 ${fmt(dailyVariance.heatmapQuantiles.q90)}.`
                          : 'Relative bands will appear after a few non-zero spend days are available.')
                      : `Absolute range: 0 to ${fmt(dailyVariance.heatmapMax)} across the last 8 weeks.`}
                  </p>

                  <div className="space-y-1">
                    {dailyVariance.heatmapWeeks.map((week, weekIndex) => (
                      <div key={`heatmap-week-${weekIndex}`} className="grid grid-cols-7 gap-1">
                        {week.map((day) => {
                          let alpha = 0.08
                          if (day.value > 0) {
                            if (heatmapScale === 'linear') {
                              const intensity = day.value / dailyVariance.heatmapMax
                              alpha = Math.min(0.9, 0.18 + (intensity * 0.68))
                            } else {
                              const { q25, q50, q75, q90 } = dailyVariance.heatmapQuantiles
                              if (day.value <= q25) alpha = 0.28
                              else if (day.value <= q50) alpha = 0.42
                              else if (day.value <= q75) alpha = 0.58
                              else if (day.value <= q90) alpha = 0.74
                              else alpha = 0.9
                            }
                          }

                          const cellColor = day.value <= 0
                            ? 'rgba(16, 33, 63, 0.08)'
                            : `rgba(10, 103, 216, ${alpha})`

                          return (
                            <div
                              key={day.key}
                              title={`${day.label}: ${fmt(day.value)}`}
                              aria-label={`${day.label} spend ${fmt(day.value)}`}
                              className="h-3 rounded-[3px]"
                              style={{ background: cellColor }}
                            />
                          )
                        })}
                      </div>
                    ))}
                  </div>

                  <p className="text-[10px] text-ink-3 mt-1.5">{dailyVariance.heatmapRange}</p>
                </div>
              </>
            )}
          </div>
        </motion.div>

        <motion.div variants={fadeUp}>
          <div className="card p-4 border-0">
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
              <div className="rounded-card bg-kosha-surface-2 p-2.5">
                <p className="text-[10px] text-ink-3">Obligations</p>
                <p className="text-[12px] font-bold text-warning-text tabular-nums">{fmt(cashRiskRadar.obligations14)}</p>
              </div>
              <div className="rounded-card bg-kosha-surface-2 p-2.5">
                <p className="text-[10px] text-ink-3">Pred. inflow</p>
                <p className="text-[12px] font-bold text-income-text tabular-nums">{fmt(cashRiskRadar.projectedInflow14)}</p>
              </div>
              <div className="rounded-card bg-kosha-surface-2 p-2.5">
                <p className="text-[10px] text-ink-3">Buffer</p>
                <p className={`text-[12px] font-bold tabular-nums ${cashRiskRadar.buffer >= 0 ? 'text-income-text' : 'text-expense-text'}`}>
                  {cashRiskRadar.buffer >= 0 ? '+' : '-'}{fmt(Math.abs(cashRiskRadar.buffer))}
                </p>
              </div>
            </div>

            <div className="h-2 rounded-pill bg-kosha-surface-2 overflow-hidden">
              <div className="h-full rounded-pill bg-kosha-border" />
            </div>

            <div className="mt-2.5 rounded-card border border-kosha-border bg-kosha-surface-2 p-2.5">
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
                    stroke="#E11D48"
                    strokeWidth={2.1}
                    dot={false}
                    activeDot={{ r: 4, fill: '#E11D48', stroke: '#fff', strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cumulativeInflow"
                    stroke="#0E9F6E"
                    strokeWidth={2.1}
                    dot={false}
                    activeDot={{ r: 4, fill: '#0E9F6E', stroke: '#fff', strokeWidth: 2 }}
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
          <div className="card p-4 border-0">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand-container flex items-center justify-center shrink-0">
                  <TrendingUp size={15} className="text-brand" />
                </div>
                <div>
                  <p className="section-label">Spending Drift</p>
                  <p className="text-caption text-ink-3 mt-0.5">This week vs 4-week average weekly spend</p>
                </div>
              </div>
              <span className={`text-[10px] px-2 py-1 rounded-pill font-semibold ${spendingDrift.driftAmount <= 0 ? 'bg-income-bg text-income-text' : 'bg-warning-bg text-warning-text'}`}>
                {spendingDrift.driftAmount <= 0 ? 'Stable' : 'Drifting'}
              </span>
            </div>

            {spendingDrift.hasData ? (
              <>
                <div className="grid grid-cols-2 gap-2 mb-2.5">
                  <div className="rounded-card bg-kosha-surface-2 p-2.5">
                    <p className="text-[10px] text-ink-3">This week</p>
                    <p className="text-[12px] font-bold text-expense-text tabular-nums">{fmt(spendingDrift.thisWeekSpend)}</p>
                  </div>
                  <div className="rounded-card bg-kosha-surface-2 p-2.5">
                    <p className="text-[10px] text-ink-3">4w avg/week</p>
                    <p className="text-[12px] font-bold text-ink tabular-nums">{fmt(spendingDrift.avg4WeekSpend)}</p>
                  </div>
                </div>

                <p className="text-[11px] text-ink-3 mb-2">
                  {spendingDrift.driftPct == null
                    ? 'Not enough historical data yet for drift percentage.'
                    : `Weekly drift is ${spendingDrift.driftPct >= 0 ? '+' : ''}${spendingDrift.driftPct}% against your 4-week baseline.`}
                </p>

                <div className="mt-2 border-t border-kosha-border pt-2">
                  <div className="grid grid-cols-8 gap-1 mb-1">
                    <span className="text-[9px] text-ink-3" />
                    {spendingDrift.weekdayLabels.map((label, idx) => (
                      <span key={`weekday-${idx}`} className="text-[9px] text-ink-3 text-center">{label}</span>
                    ))}
                  </div>

                  <div className="space-y-1">
                    {spendingDrift.seasonalityWeeks.map((week) => (
                      <div key={week.label} className="grid grid-cols-8 gap-1 items-center">
                        <span className="text-[9px] text-ink-3 tabular-nums">{week.label}</span>
                        {week.days.map((day) => {
                          let alpha = 0.08
                          if (!day.isFuture && day.value > 0) {
                            const { q25, q50, q75, q90 } = spendingDrift.seasonalityQuantiles
                            if (day.value <= q25) alpha = 0.28
                            else if (day.value <= q50) alpha = 0.42
                            else if (day.value <= q75) alpha = 0.58
                            else if (day.value <= q90) alpha = 0.74
                            else alpha = 0.9
                          }

                          const background = day.isFuture
                            ? 'rgba(16, 33, 63, 0.05)'
                            : day.value > 0
                              ? `rgba(154, 114, 0, ${alpha})`
                              : 'rgba(16, 33, 63, 0.08)'

                          return (
                            <div
                              key={day.key}
                              title={`${day.label}: ${fmt(day.value)}`}
                              aria-label={`${day.label} expense ${fmt(day.value)}`}
                              className="h-3 rounded-[3px]"
                              style={{ background }}
                            />
                          )
                        })}
                      </div>
                    ))}
                  </div>

                  <p className="text-[10px] text-ink-3 mt-1">Week-over-week weekday spend seasonality. Darker cells indicate heavier spend days.</p>
                </div>
              </>
            ) : (
              <p className="text-[11px] text-ink-3">No enough weekly spend history yet. Keep logging transactions to unlock drift drivers.</p>
            )}
          </div>
        </motion.div>

        <motion.div variants={fadeUp}>
          <div className="card p-4 border-0">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-brand-container flex items-center justify-center shrink-0">
                  <WalletCards size={15} className="text-brand" />
                </div>
                <div>
                  <p className="section-label">Opportunity Wallet</p>
                  <p className="text-caption text-ink-3 mt-0.5">Recoverable surplus from controllable categories</p>
                </div>
              </div>
              <span className="text-[10px] px-2 py-1 rounded-pill font-semibold bg-brand-container text-brand-on">
                {opportunityCutPct}% cut mode
              </span>
            </div>

            {opportunityWallet.hasData ? (
              <>
                <div className="flex items-center gap-1.5 mb-2.5">
                  {[8, 12, 15].map((pct) => (
                    <button
                      key={`cut-${pct}`}
                      type="button"
                      onClick={() => setOpportunityCutPct(pct)}
                      className={`chip-control chip-control-sm ${opportunityCutPct === pct
                        ? 'bg-brand-container text-brand-on border-brand-container'
                        : 'chip-control-muted'
                        }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-2 mb-2.5">
                  <div className="rounded-card bg-kosha-surface-2 p-2.5">
                    <p className="text-[10px] text-ink-3">Recoverable</p>
                    <p className="text-[12px] font-bold text-brand tabular-nums">+{fmt(opportunityWallet.recoverable)}</p>
                  </div>
                  <div className="rounded-card bg-kosha-surface-2 p-2.5">
                    <p className="text-[10px] text-ink-3">Projected net</p>
                    <p className={`text-[12px] font-bold tabular-nums ${opportunityWallet.projectedNet >= 0 ? 'text-income-text' : 'text-warning-text'}`}>
                      {opportunityWallet.projectedNet >= 0 ? '+' : '-'}{fmt(Math.abs(opportunityWallet.projectedNet))}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {opportunityWallet.rows.map((row) => (
                    <div key={`wallet-${row.id}`} className="flex items-center justify-between rounded-card bg-kosha-surface-2 px-2.5 py-2">
                      <p className="text-[11px] text-ink-2 truncate">{row.label}</p>
                      <p className="text-[11px] font-semibold text-brand tabular-nums shrink-0">+{fmt(row.targetCut)}</p>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/monthly')}
                  className="btn-secondary h-9 px-3 text-[11px] mt-2"
                >
                  Apply target cuts
                </button>
              </>
            ) : (
              <p className="text-[11px] text-ink-3">Add spending entries in controllable categories to calculate recoverable surplus opportunities.</p>
            )}
          </div>
        </motion.div>

        {/* ── Bill alert ────────────────────────────────────────────── */}
        {dueSoonCount > 0 && (
          <motion.div variants={fadeUp}>
            <button onClick={() => navigate('/bills')}
              className="card-warn w-full flex items-center justify-between px-4 py-4 text-left">
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

        {/* ── Pace card — sub-component ────────────────────────────── */}
        <motion.div variants={fadeUp}>
          <DashboardPaceCard
            dayOfMonth={dayOfMonth}
            daysInMonth={daysInMonth}
            earned={earned}
            spent={spent}
            paceOk={paceOk}
          />
        </motion.div>

        {heavyReady && weeklyDigest.hasSignals && (
          <motion.div variants={fadeUp}>
            <div className="card p-4 bg-kosha-surface border-0">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="section-label">What changed this week</p>
                  <p className="text-caption text-ink-3 mt-0.5">7-day vs previous 7-day digest</p>
                </div>
                <span className={`text-[11px] px-2.5 py-1 rounded-pill font-semibold border ${weeklyDigest.spendDelta <= 0 ? 'bg-income-bg text-income-text border-income-border' : 'bg-warning-bg text-warning-text border-warning-border'}`}>
                  {weeklyDigest.spendDelta <= 0 ? 'Spending cooled' : 'Spending up'}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                <DigestMetricCard
                  label="Spend (7d)"
                  value={fmt(weeklyDigest.spendLast7)}
                  tone="text-expense-text"
                  caption="Current window"
                />
                <DigestMetricCard
                  label="Spend delta"
                  value={`${weeklyDigest.spendDelta >= 0 ? '+' : '-'}${fmt(Math.abs(weeklyDigest.spendDelta))}`}
                  tone={weeklyDigest.spendDelta <= 0 ? 'text-income-text' : 'text-warning-text'}
                  caption={weeklyDigest.spendDelta <= 0 ? 'Lower vs previous week' : 'Higher vs previous week'}
                />
                <DigestMetricCard
                  label="Income (7d)"
                  value={fmt(weeklyDigest.incomeLast7)}
                  tone="text-income-text"
                  caption="Current window"
                />
                <DigestMetricCard
                  label="Income delta"
                  value={`${weeklyDigest.incomeDelta >= 0 ? '+' : '-'}${fmt(Math.abs(weeklyDigest.incomeDelta))}`}
                  tone={weeklyDigest.incomeDelta >= 0 ? 'text-income-text' : 'text-warning-text'}
                  caption={weeklyDigest.incomeDelta >= 0 ? 'Higher vs previous week' : 'Lower vs previous week'}
                />
              </div>

              {weeklyDigest.topCategory && weeklyTopCategoryLabel && (
                <div className="rounded-card bg-kosha-surface-2 px-3 py-2.5 mt-1">
                  <p className="text-[10px] text-ink-3 mb-0.5">Top spend category this week</p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12px] font-semibold text-ink-2 truncate">{weeklyTopCategoryLabel}</p>
                    <p className="text-[12px] font-semibold text-expense-text tabular-nums shrink-0">{fmt(weeklyDigest.topCategory[1])}</p>
                  </div>
                </div>
              )}
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

        {/* ── Financial activity feed ─────────────────────────────── */}
        {heavyReady && (
          <motion.div variants={fadeUp}>
            <DashboardActivityFeed events={financialEvents} />
          </motion.div>
        )}

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

