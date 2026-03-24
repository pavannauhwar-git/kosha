import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, ArrowRight, TrendingUp, TrendingDown, Minus, Plus, Repeat } from 'lucide-react'
import {
  useTransactions,
  useMonthSummary,
  useRunningBalance,
  useTodayExpenses,
  deleteTransaction,
} from '../hooks/useTransactions'
import { useLiabilities } from '../hooks/useLiabilities'
import { useAuth } from '../context/AuthContext'
import AddTransactionSheet from '../components/AddTransactionSheet'
import AboutKoshaLink from '../components/AboutKoshaLink'
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
import { useFinancialEvents } from '../hooks/useFinancialEvents'

const fadeUp = createFadeUp(4, 0.18)
const stagger = createStagger(0.04, 0.04)

const QUICK_ACTIONS = [
  { label: 'Income', Icon: TrendingUp, bg: 'bg-income-bg', color: '#047857', type: 'income', strokeWidth: 2.4 },
  { label: 'Expense', Icon: TrendingDown, bg: 'bg-expense-bg', color: '#E11D48', type: 'expense', strokeWidth: 2.4 },
  { label: 'Invest', Icon: Plus, bg: 'bg-invest-bg', color: '#0369A1', type: 'investment', strokeWidth: 2.6 },
  { label: 'Bills', Icon: Repeat, bg: 'bg-repay-bg', color: '#CA8A04', type: 'bills', strokeWidth: 2.4 },
]

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

  // ── Data fetching ─────────────────────────────────────────────────────
  const { data: recent }            = useTransactions({ limit: 8 })
  const { todaySpend }              = useTodayExpenses()
  const { data: summary }           = useMonthSummary(now.getFullYear(), now.getMonth() + 1)
  const { data: lastSummary }       = useMonthSummary(
    now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(),
    now.getMonth() === 0 ? 12 : now.getMonth()
  )
  const { balance: runningBalance } = useRunningBalance(now.getFullYear(), now.getMonth() + 1)
  const { pending: bills }          = useLiabilities({ includePaid: false })
  const { data: financialEvents }   = useFinancialEvents(8)

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

  // ── Stable callbacks — useCallback deps are all stable primitives ──────
  const openQuickAdd = useCallback((type) => {
    setAddType(type)
    setEditTxn(null)
    setShowAdd(true)
  }, [])

  const handleDelete = useCallback(async (id) => {
    if (!id) return
    try {
      await deleteTransaction(id)
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
      <PageHeader title="Dashboard" />
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">

        {/* ── Greeting ──────────────────────────────────────────────── */}
        <motion.div variants={fadeUp}>
          <p className="text-caption text-ink-3">
            {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="text-display font-bold text-ink tracking-tight">
            {greeting}{firstName ? `, ${firstName}` : ''} 👋
          </h1>
        </motion.div>

        {/* ── Hero card — sub-component, renders independently ─────── */}
        <motion.div variants={fadeUp}>
          <DashboardHeroCard
            now={now}
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

        {/* ── Pulse strip — sub-component ───────────────────────────── */}
        <motion.div variants={fadeUp}>
          <DashboardPulseStrip
            todaySpend={todaySpend}
            totalBillsAmt={totalBillsAmt}
            insight={insight}
          />
        </motion.div>

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

        {/* ── Quick-action strip ────────────────────────────────────── */}
        <motion.div variants={fadeUp} className="card py-4 px-2">
          <div className="flex justify-around">
            {QUICK_ACTIONS.map(({ label, Icon, bg, color, type, strokeWidth }) => (
              <button key={label}
                onClick={() => type === 'bills' ? navigate('/bills') : openQuickAdd(type)}
                className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform duration-75"
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

        {/* ── Investments ───────────────────────────────────────────── */}
        {invested > 0 && (
          <motion.div variants={fadeUp}>
            <div className="card p-4">
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
              <p className="text-value font-bold text-invest-text tabular-nums">{fmt(invested)}</p>
            </div>
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
        <motion.div variants={fadeUp}>
          <DashboardActivityFeed events={financialEvents} />
        </motion.div>

      </motion.div>

      {/* ── Error toast ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-32 left-4 right-4 md:left-[236px] md:bottom-8 z-50
                       flex items-center gap-3 bg-ink text-white px-4 py-3 rounded-card shadow-card-lg"
          >
            <span className="text-[13px] font-medium flex-1">{toast}</span>
            <button onClick={() => setToast(null)}
              className="text-white opacity-60 text-xs font-semibold">Dismiss</button>
          </motion.div>
        )}
      </AnimatePresence>

      <AboutKoshaLink />

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
