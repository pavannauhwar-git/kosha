import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'
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
import { Plus, ArrowUp, ArrowDown, ChartLine, Receipt } from '@phosphor-icons/react'
import { useNavigate } from 'react-router-dom'

// FIX (defect 4.3): Extracted sub-components. Each renders independently —
// a transaction list refetch no longer re-renders the hero card or pace card,
// and a balance update no longer re-renders the transaction list.
import DashboardHeroCard          from '../components/dashboard/DashboardHeroCard'
import DashboardPulseStrip        from '../components/dashboard/DashboardPulseStrip'
import DashboardPaceCard          from '../components/dashboard/DashboardPaceCard'
import DashboardRecentTransactions from '../components/dashboard/DashboardRecentTransactions'
import PageHeader                 from '../components/PageHeader'

const fadeUp = {
  hidden: { opacity: 0, y: 4 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.18, ease: 'easeOut' } },
}
const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.04, delayChildren: 0.04 } },
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
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

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const dayOfMonth  = now.getDate()
  const paceOk      = earned === 0 || spent / earned <= dayOfMonth / daysInMonth + 0.05

  // Stable array reference: only recomputes when bills data actually changes
  const dueSoon = useMemo(
    () => bills.filter(b => daysUntil(b.due_date) <= 7),
    [bills]
  )

  const totalBillsAmt = useMemo(
    () => bills.reduce((s, b) => s + +b.amount, 0),
    [bills]
  )

  const insight = useMemo(() => {
    const spendPct = earned > 0 ? spent / earned : 0
    const dayPct   = dayOfMonth / daysInMonth
    if (!earned && !spent) return 'Log a transaction to start your money story 📊'
    if (spendPct < dayPct - 0.15) return `Under pace · ${rate}% saved so far ✨`
    if (spendPct > dayPct + 0.15) return 'Spending running hot this month · ease up 📈'
    if (dueSoon.length > 0) return `${dueSoon.length} bill${dueSoon.length > 1 ? 's' : ''} coming due · plan ahead 📅`
    if (investDiff > 0)     return `Invested ${fmt(Math.abs(investDiff))} more than last month 💪`
    if (rate >= 25)         return `Saving ${rate}% of income · outstanding month 🎯`
    return `Saving ${rate}% this month · right on track 👍`
  }, [earned, spent, dayOfMonth, daysInMonth, rate, dueSoon, investDiff])

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
            {greeting}{profile?.display_name ? `, ${profile.display_name.split(' ')[0]}` : ''} 👋
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
            {[
              { label: 'Income',  icon: <ArrowUp   size={20} weight="bold" />, bg: 'bg-income-bg',  color: '#047857',  type: 'income'     },
              { label: 'Expense', icon: <ArrowDown  size={20} weight="bold" />, bg: 'bg-expense-bg', color: '#E11D48',  type: 'expense'    },
              { label: 'Invest',  icon: <ChartLine  size={20} weight="bold" />, bg: 'bg-invest-bg',  color: '#0369A1',  type: 'investment' },
              { label: 'Bills',   icon: <Receipt    size={20} weight="bold" />, bg: 'bg-repay-bg',   color: '#CA8A04',  type: 'bills'      },
            ].map(({ label, icon, bg, color, type }) => (
              <button key={label}
                onClick={() => type === 'bills' ? navigate('/bills') : openQuickAdd(type)}
                className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform duration-75"
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${bg}`}
                  style={{ color }}>
                  {icon}
                </div>
                <span className="text-[11px] font-semibold text-ink-3">{label}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* ── Bill alert ────────────────────────────────────────────── */}
        {dueSoon.length > 0 && (
          <motion.div variants={fadeUp}>
            <button onClick={() => navigate('/bills')}
              className="card-warn w-full flex items-center justify-between px-4 py-4 text-left">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-warning-bg flex items-center justify-center shrink-0">
                  <Bell size={16} className="text-warning-text" />
                </div>
                <div>
                  <p className="text-body font-semibold text-ink">
                    {dueSoon.length} bill{dueSoon.length > 1 ? 's' : ''} due soon
                  </p>
                  <p className="text-label text-ink-3">
                    {dueSoon.slice(0, 2).map(b => b.description).join(' · ')}
                  </p>
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
        <Plus size={24} weight="bold" color="white" />
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
