import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, ArrowRight, TrendingUp, TrendingDown, Minus, Plus, Repeat } from 'lucide-react'
import {
  useRecentTransactions,
  useTransactionDigest,
  useMonthSummary,
  useRunningBalance,
  useTodayExpenses,
  removeTransactionMutation,
} from '../hooks/useTransactions'
import { useLiabilities } from '../hooks/useLiabilities'
import { useAuth } from '../context/AuthContext'
import AddTransactionSheet from '../components/AddTransactionSheet'
import { fmt, savingsRate, daysUntil } from '../lib/utils'
import { useNavigate } from 'react-router-dom'
import { createFadeUp, createStagger } from '../lib/animations'

// FIX (defect 4.3): Extracted sub-components. Each renders independently —
// a transaction list refetch no longer re-renders the hero card or pace card,
// and a balance update no longer re-renders the transaction list.
import DashboardHeroCard          from '../components/dashboard/DashboardHeroCard'
import DashboardPulseStrip        from '../components/dashboard/DashboardPulseStrip'
import DashboardPaceCard          from '../components/dashboard/DashboardPaceCard'
import DashboardRecentTransactions from '../components/dashboard/DashboardRecentTransactions'
import DashboardActivityFeed      from '../components/dashboard/DashboardActivityFeed'
import PageHeader                 from '../components/PageHeader'
import AppToast from '../components/common/AppToast'
import StatMini from '../components/common/StatMini'
import { useFinancialEvents } from '../hooks/useFinancialEvents'
import { getReminderPrefs, maybeNotify } from '../lib/reminders'

const fadeUp = createFadeUp(4, 0.18)
const stagger = createStagger(0.04, 0.04)

const QUICK_ACTIONS = [
  { label: 'Income', Icon: TrendingUp, bg: 'bg-income-bg', color: 'var(--c-income)', type: 'income', strokeWidth: 2.4 },
  { label: 'Expense', Icon: TrendingDown, bg: 'bg-expense-bg', color: 'var(--c-expense-bright)', type: 'expense', strokeWidth: 2.4 },
  { label: 'Invest', Icon: Plus, bg: 'bg-invest-bg', color: 'var(--c-invest-text)', type: 'investment', strokeWidth: 2.6 },
  { label: 'Bills', Icon: Repeat, bg: 'bg-repay-bg', color: 'var(--c-warning)', type: 'bills', strokeWidth: 2.4 },
]

const dashboardFade = { duration: 0.2, ease: 'easeOut' }

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
          <div key={`recent-skeleton-${i}`} className="px-4 py-3.5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl shimmer opacity-80 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="h-3.5 w-2/5 rounded-full shimmer opacity-85" />
              <div className="mt-2 h-2.5 w-1/4 rounded-full shimmer opacity-70" />
            </div>
            <div className="h-3.5 w-16 rounded-full shimmer opacity-80" />
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
          prev.getMonth()    !== next.getMonth()    ||
          prev.getDate()     !== next.getDate()     ||
          prev.getHours()    !== next.getHours()
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

  const [showAdd,      setShowAdd]      = useState(false)
  const [editTxn,      setEditTxn]      = useState(null)
  const [addType,      setAddType]      = useState('expense')
  const [duplicateTxn, setDuplicateTxn] = useState(null)
  const [heroMode,     setHeroMode]     = useState('balance')
  const [toast,        setToast]        = useState(null)
  const [heavyReady,   setHeavyReady]   = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setHeavyReady(true), 280)
    return () => clearTimeout(timer)
  }, [])

  // ── Data fetching ─────────────────────────────────────────────────────
  const {
    data: recent = [],
    loading: recentLoading,
    fetching: recentFetching,
  } = useRecentTransactions(5)
  const { data: digestTxnRows = [] } = useTransactionDigest(14, 200, { enabled: heavyReady })
  const { todaySpend }              = useTodayExpenses({ enabled: heavyReady })
  const {
    data: summary,
    loading: summaryLoading,
    fetching: summaryFetching,
  } = useMonthSummary(now.getFullYear(), now.getMonth() + 1)
  const { data: lastSummary }       = useMonthSummary(
    now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(),
    now.getMonth() === 0 ? 12 : now.getMonth(),
    { enabled: heavyReady }
  )
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
  const { pending: bills = [] }     = useLiabilities({ includePaid: false, enabled: heavyReady })
  const { data: financialEvents = [] } = useFinancialEvents(3, { enabled: heavyReady })

  const isInitialLoading = recentLoading || summaryLoading || runningBalanceLoading
  const isBackgroundFetching = !isInitialLoading && (recentFetching || summaryFetching || runningBalanceFetching)

  // ── Derived values ─────────────────────────────────────────────────────
  const earned   = summary?.earned     || 0
  const spent    = summary?.expense    || 0
  const invested = summary?.investment || 0
  const rate     = savingsRate(earned, spent)

  const lastInvested = lastSummary?.investment || 0
  const investDiff   = invested - lastInvested
  const investUp     = investDiff > 0

  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning'
    : hour < 17  ? 'Good afternoon'
    : hour < 21  ? 'Good evening'
    : 'Good night'

  const firstName = useMemo(
    () => profile?.display_name?.split(' ')[0] || '',
    [profile?.display_name]
  )

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const dayOfMonth  = now.getDate()
  const paceOk      = earned === 0 || spent / earned <= dayOfMonth / daysInMonth + 0.05

  // FIX (defect 5.3): The old code derived dueSoon and insight from `bills`
  // directly. When the liabilities query refetched (even with identical data),
  // `bills` got a new array reference, invalidating dueSoon's memo, which
  // invalidated insight's memo — a chain re-evaluation on every background
  // refetch regardless of whether any data actually changed.
  //
  // Fix: derive stable primitive values from bills ONCE, then use those
  // primitives as memo deps. Array reference changes that don't change the
  // derived values no longer trigger downstream recalculations.
  const { dueSoonCount, dueSoonDescs, totalBillsAmt } = useMemo(() => {
    let count = 0
    let total = 0
    const descs = []

    for (const b of bills) {
      total += +b.amount
      if (daysUntil(b.due_date) <= 7) {
        count += 1
        if (descs.length < 2) descs.push(b.description)
      }
    }

    return {
      dueSoonCount: count,
      dueSoonDescs: descs.join(' · '),
      totalBillsAmt: total,
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

  const insight = useMemo(() => {
    const spendPct = earned > 0 ? spent / earned : 0
    const dayPct   = dayOfMonth / daysInMonth
    if (!earned && !spent) return 'Log a transaction to start your money story 📊'
    if (spendPct < dayPct - 0.15) return `Under pace · ${rate}% saved so far ✨`
    if (spendPct > dayPct + 0.15) return 'Spending running hot this month · ease up 📈'
    if (dueSoonCount > 0) return `${dueSoonCount} bill${dueSoonCount > 1 ? 's' : ''} coming due · plan ahead 📅`
    if (investDiff > 0)   return `Invested ${fmt(Math.abs(investDiff))} more than last month 💪`
    if (rate >= 25)       return `Saving ${rate}% of income · outstanding month 🎯`
    return `Saving ${rate}% this month · right on track 👍`
  // FIX (defect 5.3): deps are now primitives (dueSoonCount) not the bills array.
  // This memo only recalculates when earned/spent/rate/dueSoonCount/investDiff
  // actually change in value — not on every array reference change from a refetch.
  }, [earned, spent, dayOfMonth, daysInMonth, rate, dueSoonCount, investDiff])

  const todayFocus = useMemo(() => {
    if (dueSoonCount > 0) {
      return {
        title: 'Bills need attention today',
        detail: `${dueSoonCount} due soon. Clear dues first so monthly pace stays reliable.`,
        primaryLabel: 'Review bills',
        primaryRoute: '/bills',
        secondaryLabel: 'Open monthly',
        secondaryRoute: '/monthly',
        tone: 'warning',
      }
    }

    if (weeklyDigest.hasSignals && weeklyDigest.spendDelta > 0) {
      return {
        title: 'Spending is up vs last week',
        detail: `Weekly spend increased by ${fmt(Math.abs(weeklyDigest.spendDelta))}. Review recent transactions and trim leakage.`,
        primaryLabel: 'Review activity',
        primaryRoute: '/transactions',
        secondaryLabel: 'Open analytics',
        secondaryRoute: '/analytics',
        tone: 'risk',
      }
    }

    if (earned > 0 && rate < 15) {
      return {
        title: 'Savings pace can improve',
        detail: `Current savings rate is ${rate}%. A small spend reduction today can lift month-end confidence.`,
        primaryLabel: 'Open monthly',
        primaryRoute: '/monthly',
        secondaryLabel: 'Log expense',
        secondaryRoute: '/transactions',
        tone: 'neutral',
      }
    }

    return {
      title: 'You are on track today',
      detail: 'Keep entries clean and reconcile once this week to preserve dashboard trust.',
      primaryLabel: 'Run reconciliation',
      primaryRoute: '/reconciliation',
      secondaryLabel: 'Open activity',
      secondaryRoute: '/transactions',
      tone: 'good',
    }
  }, [dueSoonCount, weeklyDigest, earned, rate])

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
  const openQuickAdd = useCallback((type) => {
    setAddType(type)
    setEditTxn(null)
    setShowAdd(true)
  }, [])

  const handleDelete = useCallback(async (id) => {
    if (!id) return
    try {
      await removeTransactionMutation(id)
    } catch (e) {
      setToast(e.message || 'Could not delete transaction.')
      setTimeout(() => setToast(null), 4000)
      throw e
    }
  }, [])

  const handleTap = useCallback((t) => {
    setEditTxn(t)
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
      <PageHeader
        variant="oneui-hero"
        title="Dashboard"
        eyebrow={now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        subtitle={`${greeting}${firstName ? `, ${firstName}` : ''}`}
        className="mb-2"
      />

      {isBackgroundFetching && (
        <p className="text-[11px] text-ink-3 mb-3 px-1">Syncing latest data...</p>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {isInitialLoading ? (
          <motion.div
            key="dashboard-loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: dashboardFade }}
            exit={{ opacity: 0, transition: dashboardFade }}
            className="page-stack"
          >
            <DashboardHeroSkeleton />

            <div className="card py-4 px-3">
              <div className="flex justify-between gap-1.5">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={`quick-action-skeleton-${idx}`} className="flex flex-col items-center gap-1.5 min-w-[62px]">
                    <div className="w-12 h-12 rounded-full shimmer opacity-80" />
                    <div className="h-2.5 w-11 rounded-full shimmer opacity-70" />
                  </div>
                ))}
              </div>
            </div>

            <DashboardRecentSkeleton />
          </motion.div>
        ) : (
          <motion.div
            key="dashboard-content"
            variants={stagger}
            initial="hidden"
            animate="show"
            exit={{ opacity: 0, transition: dashboardFade }}
            className="page-stack"
          >
        {/* ── Hero card — sub-component, renders independently ─────── */}
        <motion.div variants={fadeUp}>
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
        </motion.div>

        <motion.div variants={fadeUp}>
          <div className="card p-3.5">
            <div className="flex items-center justify-between gap-3 mb-0.5">
              <p className="section-label">Today focus</p>
              <span className={`text-[10px] px-2 py-1 rounded-full font-semibold ${
                todayFocus.tone === 'warning' || todayFocus.tone === 'risk'
                  ? 'bg-warning-bg text-warning-text'
                  : todayFocus.tone === 'good'
                    ? 'bg-income-bg text-income-text'
                    : 'bg-brand-container text-brand-on'
              }`}>
                Priority
              </span>
            </div>
            <p className="card-title">{todayFocus.title}</p>
            <p className="text-[12px] text-ink-3 mt-1">{todayFocus.detail}</p>
            <div className="grid grid-cols-2 gap-2 mt-2.5">
              <button
                type="button"
                onClick={() => navigate(todayFocus.primaryRoute)}
                className="btn-primary h-12 px-4 text-[12px] justify-center"
              >
                {todayFocus.primaryLabel}
              </button>
              <button
                type="button"
                onClick={() => navigate(todayFocus.secondaryRoute)}
                className="btn-secondary h-12 px-4 text-[12px] justify-center"
              >
                {todayFocus.secondaryLabel}
              </button>
            </div>
          </div>
        </motion.div>

        {/* ── Quick-action strip ────────────────────────────────────── */}
        <motion.div variants={fadeUp} className="card py-4 px-3">
          <div className="flex justify-between gap-1.5">
            {QUICK_ACTIONS.map(({ label, Icon, bg, color, type, strokeWidth }) => (
              <button key={label}
                onClick={() => type === 'bills' ? navigate('/bills') : openQuickAdd(type)}
                className="flex flex-col items-center gap-1.5 active:scale-[0.97] transition-transform duration-100 min-w-[62px]"
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${bg}`}
                  style={{ color }}>
                  <Icon size={20} strokeWidth={strokeWidth} />
                </div>
                <span className="text-[11px] font-semibold text-ink-3">{label}</span>
              </button>
            ))}
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
            <div className="card p-3.5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="section-label">What changed this week</p>
                  <p className="text-caption text-ink-3 mt-0.5">7-day vs previous 7-day digest</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${weeklyDigest.spendDelta <= 0 ? 'bg-income-bg text-income-text' : 'bg-warning-bg text-warning-text'}`}>
                  {weeklyDigest.spendDelta <= 0 ? 'Spending cooled' : 'Spending up'}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 mb-1">
                <StatMini label="Spend (7d)" value={fmt(weeklyDigest.spendLast7)} tone="text-expense-text" />
                <StatMini label="Spend delta" value={`${weeklyDigest.spendDelta >= 0 ? '+' : '-'}${fmt(Math.abs(weeklyDigest.spendDelta))}`} tone={weeklyDigest.spendDelta <= 0 ? 'text-income-text' : 'text-warning-text'} />
                <StatMini label="Income (7d)" value={fmt(weeklyDigest.incomeLast7)} tone="text-income-text" />
                <StatMini label="Income delta" value={`${weeklyDigest.incomeDelta >= 0 ? '+' : '-'}${fmt(Math.abs(weeklyDigest.incomeDelta))}`} tone={weeklyDigest.incomeDelta >= 0 ? 'text-income-text' : 'text-warning-text'} />
              </div>

              {weeklyDigest.topCategory && (
                <p className="text-[11px] text-ink-3 mt-2">
                  Top spend category this week: <span className="font-semibold text-ink-2">{weeklyDigest.topCategory[0]}</span> ({fmt(weeklyDigest.topCategory[1])})
                </p>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Investments ───────────────────────────────────────────── */}
        {heavyReady && invested > 0 && (
          <motion.div variants={fadeUp}>
            <div className="card p-3.5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-caption text-ink-3 font-medium">Invested this month</p>
                <div className="flex items-center gap-1.5">
                  {investDiff === 0
                    ? <Minus size={12} className="text-ink-3" />
                    : investUp
                      ? <TrendingUp   size={12} className="text-income-text" />
                      : <TrendingDown size={12} className="text-expense-text" />}
                  <span className={`text-caption font-semibold ${
                    investDiff === 0 ? 'text-ink-3'
                    : investUp ? 'text-income-text' : 'text-expense-text'
                  }`}>
                    {investDiff === 0 ? 'Same as last month'
                      : `${investUp ? '+' : ''}${fmt(Math.abs(investDiff))} vs last month`}
                  </span>
                </div>
              </div>
              <p className="text-[22px] md:text-[24px] font-bold text-invest-text tabular-nums leading-[0.98] tracking-tight">{fmt(invested)}</p>
            </div>
          </motion.div>
        )}

        {/* ── Pulse strip — sub-component ───────────────────────────── */}
        {heavyReady && (
          <motion.div variants={fadeUp}>
            <DashboardPulseStrip
              todaySpend={todaySpend}
              totalBillsAmt={totalBillsAmt}
              insight={insight}
            />
          </motion.div>
        )}

        {/* ── Recent transactions — sub-component ──────────────────── */}
        <motion.div variants={fadeUp}>
          <DashboardRecentTransactions
            recent={recent}
            onDelete={handleDelete}
            onTap={handleTap}
            onDuplicate={handleDuplicate}
          />
        </motion.div>

        {/* ── Financial activity feed ─────────────────────────────── */}
        {heavyReady && (
          <motion.div variants={fadeUp}>
            <DashboardActivityFeed events={financialEvents} />
          </motion.div>
        )}

          </motion.div>
        )}
      </AnimatePresence>

      <AppToast message={toast} onDismiss={() => setToast(null)} />

      {/* FAB */}
      <button className="fab" onClick={() => { setEditTxn(null); setAddType('expense'); setShowAdd(true) }}>
        <Plus size={24} className="text-white" />
      </button>

      <AddTransactionSheet
        open={showAdd}
        duplicateTxn={duplicateTxn}
        onClose={() => { setShowAdd(false); setEditTxn(null); setDuplicateTxn(null) }}
        editTxn={editTxn}
        initialType={addType}
      />
    </div>
  )
}

