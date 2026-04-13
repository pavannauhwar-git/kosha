import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Bell, ArrowRight, Plus, Wallet, TrendingDown } from 'lucide-react'
import {
  useRecentTransactions,
  useMonthSummary,
  useRunningBalance,
  useDailyExpenseTotals,
  removeTransactionMutation,
  saveTransactionMutation,
} from '../hooks/useTransactions'
import { useLiabilities } from '../hooks/useLiabilities'
import { CATEGORIES } from '../lib/categories'
import { useBudgets, budgetMap as buildBudgetMap } from '../hooks/useBudgets'
import { useAuth } from '../context/AuthContext'
import AddTransactionSheet from '../components/transactions/AddTransactionSheet'
import { fmt, savingsRate, daysUntil } from '../lib/utils'
import { bandTextClass, scoreRiskBand } from '../lib/insightBands'
import { useNavigate } from 'react-router-dom'
import { createFadeUp, createStagger } from '../lib/animations'
import Button from '../components/ui/Button'
import DashboardHeroCard from '../components/cards/dashboard/DashboardHeroCard'
import DashboardRecentTransactions from '../components/dashboard/DashboardRecentTransactions'
import SpendingPaceTracker from '../components/dashboard/SpendingPaceTracker'
import PageHeaderPage from '../components/layout/PageHeaderPage'
import AppToast from '../components/common/AppToast'
import { getReminderPrefs, maybeNotify } from '../lib/reminders'

const fadeUp = createFadeUp(12, 0.4)
const stagger = createStagger(0.06, 0.04)

function DashboardHeroSkeleton() {
  return (
    <div className="card-hero p-5 relative overflow-hidden">
      <div className="flex items-center justify-between mb-5">
        <div className="h-2.5 w-28 rounded-full shimmer opacity-70" />
        <div className="h-2.5 w-14 rounded-full shimmer opacity-50" />
      </div>
      <div className="h-10 w-44 rounded-2xl shimmer opacity-80" />
      <div className="mt-3 mb-5 h-5 w-32 rounded-full shimmer opacity-60" />
      <div className="mb-4 border-t border-white/8" />
      <div className="flex justify-between gap-2">
        {[1, 2, 3].map((slot) => (
          <div key={slot} className="flex-1 min-w-0 px-2.5 py-2 rounded-2xl bg-white/8">
            <div className="h-2.5 w-12 rounded-full shimmer opacity-55" />
            <div className="mt-1.5 h-3.5 w-16 rounded-full shimmer opacity-70" />
          </div>
        ))}
      </div>
      <div className="mt-4">
        <div className="flex justify-between mb-2">
          <div className="h-2.5 w-20 rounded-full shimmer opacity-55" />
          <div className="h-2.5 w-8 rounded-full shimmer opacity-65" />
        </div>
        <div className="h-1.5 rounded-full bg-white/12 overflow-hidden">
          <div className="h-full w-[56%] shimmer opacity-70" />
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
        return prev
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
  const [toastAction, setToastAction] = useState(null)
  const [toastActionLabel, setToastActionLabel] = useState(null)

  // ── Data fetching ─────────────────────────────────────────────────────
  const {
    data: recent = [],
    loading: recentLoading,
    fetching: recentFetching,
  } = useRecentTransactions(5)
  const {
    data: summary,
    loading: summaryLoading,
    fetching: summaryFetching,
  } = useMonthSummary(now.getFullYear(), now.getMonth() + 1)
  const { data: dailyExpenseTotals = {} } = useDailyExpenseTotals(42)
  const balanceHorizonDate = useMemo(() => new Date(2099, 11, 31), [])
  const {
    balance: runningBalance,
    loading: runningBalanceLoading,
    fetching: runningBalanceFetching,
  } = useRunningBalance(
    balanceHorizonDate.getFullYear(),
    balanceHorizonDate.getMonth() + 1
  )
  const { pending: bills = [] } = useLiabilities()
  const { budgets } = useBudgets()
  const bMap = useMemo(() => buildBudgetMap(budgets), [budgets])

  const heroLoading = summaryLoading || runningBalanceLoading
  const isBackgroundFetching = (!summaryLoading && summaryFetching) || (!runningBalanceLoading && runningBalanceFetching) || (!recentLoading && recentFetching)

  // ── Derived values ─────────────────────────────────────────────────────
  const earned = summary?.earned || 0
  const spent = summary?.expense || 0
  const invested = summary?.investment || 0
  const rate = savingsRate(earned, spent)

  const hour = now.getHours()
  const greetingMeta = useMemo(() => {
    if (hour < 5) return { text: 'Good night', emoji: '🌙💤' }
    if (hour < 12) return { text: 'Good morning', emoji: '🌤️🌸' }
    if (hour < 17) return { text: 'Good afternoon', emoji: '☀️🌼' }
    if (hour < 21) return { text: 'Good evening', emoji: '🏜️✨' }
    return { text: 'Good night', emoji: '🌙💤' }
  }, [hour])

  const firstName = useMemo(
    () => profile?.display_name?.split(' ')[0] || '',
    [profile?.display_name]
  )

  const categoryLabelById = useMemo(
    () => new Map(CATEGORIES.map((category) => [category.id, category.label])),
    []
  )

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const dayOfMonth = now.getDate()
  const daysRemaining = Math.max(1, daysInMonth - dayOfMonth + 1)

  // ── Spendable today ────────────────────────────────────────────────────
  const spendableToday = useMemo(() => {
    const totalOutflow = spent + invested
    const remaining = earned - totalOutflow
    const pendingBillsTotal = bills.reduce((sum, b) => sum + Number(b.amount || 0), 0)
    const afterBills = Math.max(0, remaining - pendingBillsTotal)
    const daily = daysRemaining > 0 ? Math.round(afterBills / daysRemaining) : 0
    return { daily, remaining: afterBills, pendingBillsTotal }
  }, [earned, spent, invested, bills, daysRemaining])

  // ── Budget burn rate ───────────────────────────────────────────────────
  const burnRate = useMemo(() => {
    if (earned <= 0) return null
    const totalOutflow = spent + invested
    const paceExpected = (dayOfMonth / daysInMonth) * 100
    const paceActual = Math.round((totalOutflow / earned) * 100)
    const ahead = paceActual > paceExpected + 5
    return { paceActual, paceExpected: Math.round(paceExpected), ahead }
  }, [earned, spent, invested, dayOfMonth, daysInMonth])

  // ── Runway balance (days left vs money left) ───────────────────────
  const runwayBalance = useMemo(() => {
    if (earned <= 0) return null

    const daysLeftPct = Math.round((daysRemaining / Math.max(1, daysInMonth)) * 100)
    const moneyLeftPctRaw = Math.round((spendableToday.remaining / earned) * 100)
    const moneyLeftPct = Math.max(0, Math.min(100, moneyLeftPctRaw))
    const gapPct = daysLeftPct - moneyLeftPct
    const band = scoreRiskBand(gapPct, { high: 12, watch: 4 })

    return {
      daysLeftPct,
      moneyLeftPct,
      gapPct,
      band,
    }
  }, [earned, spendableToday.remaining, daysRemaining, daysInMonth])

  // ── Category pressure signal ─────────────────────────────────────────
  const categoryPressureSignal = useMemo(() => {
    const categoryRows = Object.entries(summary?.byCategory || {})
      .map(([categoryId, amount]) => [categoryId, Number(amount || 0)])
      .filter(([, amount]) => Number.isFinite(amount) && amount > 0)
      .sort((a, b) => b[1] - a[1])

    if (!categoryRows.length || spent <= 0) return null

    const [categoryId, amount] = categoryRows[0]
    const sharePct = Math.round((amount / spent) * 100)
    const budgetLimit = Number(bMap?.[categoryId] || 0)
    const budgetPct = budgetLimit > 0 ? Math.round((amount / budgetLimit) * 100) : null
    const band = scoreRiskBand(sharePct, { high: 36, watch: 24 })

    return {
      label: categoryLabelById.get(categoryId) || categoryId,
      amount,
      sharePct,
      budgetPct,
      band,
    }
  }, [summary?.byCategory, spent, bMap, categoryLabelById])

  // ── Bill clustering signal ───────────────────────────────────────────
  const billClusterSignal = useMemo(() => {
    if (!bills.length) return null

    const weeklyBuckets = [
      { count: 0, amount: 0 },
      { count: 0, amount: 0 },
      { count: 0, amount: 0 },
      { count: 0, amount: 0 },
    ]

    let overdueCount = 0
    let overdueAmount = 0

    for (const bill of bills) {
      const days = daysUntil(bill.due_date)
      if (!Number.isFinite(days)) continue

      const amount = Number(bill.amount || 0)

      if (days < 0) {
        overdueCount += 1
        overdueAmount += amount
        continue
      }

      if (days > 30) continue

      const bucketIndex = Math.min(3, Math.floor(days / 7))
      weeklyBuckets[bucketIndex].count += 1
      weeklyBuckets[bucketIndex].amount += amount
    }

    const densest = weeklyBuckets.reduce((best, bucket, index) => {
      if (bucket.count > best.count) {
        return { index, count: bucket.count, amount: bucket.amount }
      }
      return best
    }, { index: -1, count: 0, amount: 0 })

    if (densest.count === 0 && overdueCount === 0) return null

    return {
      overdueCount,
      overdueAmount,
      densestWeek: densest.index + 1,
      densestCount: densest.count,
      densestAmount: densest.amount,
    }
  }, [bills])

  // ── Due soon bills ─────────────────────────────────────────────────────
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
    return { dueSoonCount: count, dueSoonDescs: descs.join(' · '), dueSoonAmount: amount }
  }, [bills])

  // ── Upcoming bills (next 3) ────────────────────────────────────────────
  const upcomingBills = useMemo(() => {
    return bills
      .filter(b => daysUntil(b.due_date) >= 0)
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
      .slice(0, 3)
  }, [bills])

  const isNewUser = !heroLoading && recent.length === 0 && earned === 0 && spent === 0 && invested === 0 && bills.length === 0

  // ── Reminders ──────────────────────────────────────────────────────────
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

  // ── Callbacks ──────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (id) => {
    if (!id) return false
    const deletedTxn = recent.find((row) => row.id === id)

    try {
      await removeTransactionMutation(id)

      if (deletedTxn) {
        setToast('Transaction deleted')
        setToastAction(() => async () => {
          try {
            const { id: _id, created_at: _createdAt, user_id: _userId, ...payload } = deletedTxn
            await saveTransactionMutation({ payload })
            setToast('Transaction restored')
            setToastAction(null)
            setToastActionLabel(null)
            setTimeout(() => setToast(null), 1600)
          } catch {
            setToast('Could not undo delete.')
            setToastAction(null)
            setToastActionLabel(null)
            setTimeout(() => setToast(null), 1800)
          }
        })
        setToastActionLabel('Undo')
        setTimeout(() => {
          setToastAction(null)
          setToastActionLabel(null)
        }, 5000)
      }

      return true
    } catch (e) {
      setToast(e.message || 'Could not delete transaction.')
      setToastAction(null)
      setToastActionLabel(null)
      setTimeout(() => setToast(null), 4000)
      throw e
    }
  }, [recent])

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
      setToastAction(null)
      setToastActionLabel(null)

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

  const handleHeroModeToggle = useCallback(() => {
    setHeroMode(m => m === 'balance' ? 'safe' : 'balance')
  }, [])

  return (
    <PageHeaderPage title="Dashboard">
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="page-stack pt-0"
      >
        {/* ── Greeting ──────────────────────────────────────────────── */}
        <motion.div variants={fadeUp}>
          <p className="text-[11px] text-ink-3 tracking-wide">
            {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="text-[22px] font-semibold text-ink tracking-tight mt-1">
            {greetingMeta.text}{firstName ? `, ${firstName}` : ''} {greetingMeta.emoji}
          </h1>
          {isBackgroundFetching && (
            <p className="text-[10px] text-ink-4 mt-1.5 tracking-wide">Syncing latest data...</p>
          )}
        </motion.div>

        {/* ── Hero card ─────────────────────────────────────────────── */}
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

        {isNewUser && (
          <motion.div variants={fadeUp}>
            <div className="card p-4 border-0">
              <p className="section-label mb-1.5">Start here</p>
              <p className="text-[14px] font-semibold text-ink">Add your first transaction to unlock daily guidance.</p>
              <p className="text-[11px] text-ink-3 mt-1.5">Kosha will start showing spendable today, burn rate, and upcoming bills as soon as your month has activity.</p>
              <div className="flex gap-2 mt-3">
                <Button variant="primary" size="sm" onClick={() => { setEditTxn(null); setAddType('expense'); setShowAdd(true) }}>
                  Add expense
                </Button>
                <Button variant="secondary" size="sm" onClick={() => navigate('/bills')}>
                  Add bill
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Spendable today + burn rate ────────────────────────────── */}
        {!heroLoading && earned > 0 && (
          <motion.div variants={fadeUp}>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="card p-3.5 border-0">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-income-bg flex items-center justify-center">
                    <Wallet size={14} className="text-income-text" />
                  </div>
                  <p className="text-[10px] text-ink-3 tracking-wide">Spendable today</p>
                </div>
                <p className="text-[18px] font-bold tabular-nums text-ink tracking-tight">
                  {fmt(spendableToday.daily)}
                </p>
                <p className="text-[10px] text-ink-3 mt-1 tabular-nums">
                  {fmt(spendableToday.remaining)} left this month
                </p>
              </div>

              {burnRate && (
                <div className="card p-3.5 border-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${burnRate.ahead ? 'bg-warning-bg' : 'bg-income-bg'}`}>
                      <TrendingDown size={14} className={burnRate.ahead ? 'text-warning-text' : 'text-income-text'} />
                    </div>
                    <p className="text-[10px] text-ink-3 tracking-wide">Burn rate</p>
                  </div>
                  <p className={`text-[18px] font-bold tabular-nums tracking-tight ${burnRate.ahead ? 'text-warning-text' : 'text-ink'}`}>
                    {burnRate.paceActual}%
                  </p>
                  <p className="text-[10px] text-ink-3 mt-1 tabular-nums">
                    Expected {burnRate.paceExpected}% by day {dayOfMonth}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {!heroLoading && (
          <motion.div variants={fadeUp}>
            <SpendingPaceTracker
              dailyExpenseTotals={dailyExpenseTotals}
              now={now}
            />
          </motion.div>
        )}

        {!heroLoading && runwayBalance && (
          <motion.div variants={fadeUp}>
            <div className="card p-3.5 border-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] text-ink-3 tracking-wide">Runway balance</p>
                <span className={`text-[10px] font-semibold px-2 py-1 rounded-pill ${runwayBalance.band === 'high' ? 'bg-warning-bg text-warning-text' : runwayBalance.band === 'watch' ? 'bg-brand-container text-brand' : 'bg-income-bg text-income-text'}`}>
                  {runwayBalance.band === 'high' ? 'Tight' : runwayBalance.band === 'watch' ? 'Watch' : 'Healthy'}
                </span>
              </div>

              <div className="mt-2.5 space-y-2.5">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] text-ink-3">Days left</p>
                    <p className="text-[11px] font-semibold tabular-nums text-ink">{daysRemaining}/{daysInMonth} ({runwayBalance.daysLeftPct}%)</p>
                  </div>
                  <div className="h-1.5 rounded-pill bg-kosha-surface-2 overflow-hidden">
                    <div className="h-full rounded-pill bg-brand" style={{ width: `${runwayBalance.daysLeftPct}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] text-ink-3">Money left</p>
                    <p className="text-[11px] font-semibold tabular-nums text-ink">{fmt(spendableToday.remaining)} ({runwayBalance.moneyLeftPct}%)</p>
                  </div>
                  <div className="h-1.5 rounded-pill bg-kosha-surface-2 overflow-hidden">
                    <div
                      className={`h-full rounded-pill ${runwayBalance.band === 'high' ? 'bg-warning-text' : runwayBalance.band === 'watch' ? 'bg-accent' : 'bg-income-text'}`}
                      style={{ width: `${runwayBalance.moneyLeftPct}%` }}
                    />
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-ink-3 mt-2">
                {runwayBalance.band === 'high'
                  ? 'Money runway is trailing time runway. Reduce optional spend until bars realign.'
                  : runwayBalance.band === 'watch'
                    ? 'Runway is slightly ahead of budget pace. Keep daily cap disciplined.'
                    : 'Money runway is aligned with days left. Current pace is sustainable.'}
              </p>
            </div>
          </motion.div>
        )}

        {!heroLoading && (categoryPressureSignal || billClusterSignal) && (
          <motion.div variants={fadeUp}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {categoryPressureSignal && (
                <div className="card p-3.5 border-0">
                  <p className="text-[10px] text-ink-3 tracking-wide">Top spend pressure</p>
                  <p className="text-[14px] font-semibold text-ink mt-1 truncate" title={categoryPressureSignal.label}>
                    {categoryPressureSignal.label}
                  </p>
                  <p className={`text-[12px] tabular-nums mt-1 ${bandTextClass(categoryPressureSignal.band)}`}>
                    {categoryPressureSignal.sharePct}% of spend · {fmt(categoryPressureSignal.amount)}
                  </p>
                  {categoryPressureSignal.budgetPct != null && (
                    <p className="text-[10px] text-ink-3 mt-1 tabular-nums">
                      Budget usage: {categoryPressureSignal.budgetPct}%
                    </p>
                  )}
                </div>
              )}

              {billClusterSignal && (
                <div className="card p-3.5 border-0">
                  <p className="text-[10px] text-ink-3 tracking-wide">Bill timing signal</p>
                  {billClusterSignal.overdueCount > 0 ? (
                    <>
                      <p className="text-[14px] font-semibold text-warning-text mt-1">
                        {billClusterSignal.overdueCount} overdue
                      </p>
                      <p className="text-[12px] text-ink-2 mt-1 tabular-nums">
                        {fmt(billClusterSignal.overdueAmount)} at risk
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-[14px] font-semibold text-ink mt-1">
                        Week {billClusterSignal.densestWeek} is dense
                      </p>
                      <p className="text-[12px] text-ink-2 mt-1 tabular-nums">
                        {billClusterSignal.densestCount} bill{billClusterSignal.densestCount === 1 ? '' : 's'} · {fmt(billClusterSignal.densestAmount)}
                      </p>
                    </>
                  )}
                  <p className="text-[10px] text-ink-3 mt-1">Use bills page to sequence payments.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

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

        {/* ── Upcoming recurrings ───────────────────────────────────── */}
        {upcomingBills.length > 0 && (
          <motion.div variants={fadeUp}>
            <div className="flex items-center justify-between mb-2">
              <p className="section-label">Upcoming bills</p>
              <Button variant="ghost" size="xs" onClick={() => navigate('/bills')}>
                View all
              </Button>
            </div>
            <div className="list-card">
              {upcomingBills.map((bill) => {
                const days = daysUntil(bill.due_date)
                const dueLabel = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days}d`
                return (
                  <div key={bill.id} className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-ink truncate">{bill.description}</p>
                      <p className="text-[11px] text-ink-3 mt-0.5">
                        Due {dueLabel}
                      </p>
                    </div>
                    <p className="text-[13px] font-semibold tabular-nums text-warning-text shrink-0">
                      {fmt(Number(bill.amount || 0))}
                    </p>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* ── Recent transactions ───────────────────────────────────── */}
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

      <AppToast
        message={toast}
        onDismiss={() => {
          setToast(null)
          setToastAction(null)
          setToastActionLabel(null)
        }}
        action={toastAction}
        actionLabel={toastActionLabel}
      />

      {/* FAB */}
      <button className="fab" aria-label="Add transaction" onClick={() => { setEditTxn(null); setAddType('expense'); setShowAdd(true) }}>
        <Plus size={24} className="text-white" />
      </button>

      <AddTransactionSheet
        open={showAdd}
        duplicateTxn={duplicateTxn}
        onClose={() => { setShowAdd(false); setDuplicateTxn(null) }}
        editTxn={editTxn}
        initialType={addType}
      />
    </PageHeaderPage>
  )
}
