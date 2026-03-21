import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useTransactions, useMonthSummary, useRunningBalance, useTodayExpenses, deleteTransaction } from '../hooks/useTransactions'
import { useLiabilities } from '../hooks/useLiabilities'
import { useAuth } from '../context/AuthContext'
import AddTransactionSheet from '../components/AddTransactionSheet'
import TransactionItem from '../components/TransactionItem'
import AboutKoshaLink from '../components/AboutKoshaLink'
import { fmt, monthStr, savingsRate, daysUntil } from '../lib/utils'
import { C } from '../lib/colors'
import { Plus, ArrowUp, ArrowDown, ChartLine, Receipt } from '@phosphor-icons/react'
import PageHeader from '../components/PageHeader'

const fadeUp = {
  hidden: { opacity: 0, y: 4 },
  show: { opacity: 1, y: 0, transition: { duration: 0.18, ease: 'easeOut' } },
}
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.04 } },
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  const { profile } = useAuth()

  const [showAdd, setShowAdd] = useState(false)
  const [editTxn, setEditTxn] = useState(null)
  const [addType, setAddType] = useState('expense')
  const [duplicateTxn, setDuplicateTxn] = useState(null)
  const [heroMode, setHeroMode] = useState('balance') // 'balance' | 'safe'

  // ── Error toast ──────────────────────────────────────────────────────
  const [toast, setToast] = useState(null)

  const { data: recent } = useTransactions({ limit: 8 })
  const { todaySpend } = useTodayExpenses()

  const { data: summary } = useMonthSummary(now.getFullYear(), now.getMonth() + 1)
  const { data: lastSummary } = useMonthSummary(
    now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(),
    now.getMonth() === 0 ? 12 : now.getMonth()
  )
  const { balance: runningBalance } = useRunningBalance(now.getFullYear(), now.getMonth() + 1)
  const { pending: bills } = useLiabilities({ includePaid: false })

  const dueSoon = useMemo(
    () => bills.filter(b => daysUntil(b.due_date) <= 7),
    [bills]
  )

  const earned = summary?.earned || 0
  const spent = summary?.expense || 0
  const invested = summary?.investment || 0
  const rate = savingsRate(earned, spent)

  const lastInvested = lastSummary?.investment || 0
  const investDiff = invested - lastInvested
  const investUp = investDiff > 0

  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning'
    : hour < 17 ? 'Good afternoon'
      : hour < 21 ? 'Good evening'
        : 'Good night'

  const daysInMonth    = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const dayOfMonth     = now.getDate()

  // On-pace: spending fraction ≤ days-elapsed fraction + 5% buffer
  const paceOk        = earned === 0 || spent / earned <= dayOfMonth / daysInMonth + 0.05
  const totalBillsAmt = useMemo(() => bills.reduce((s, b) => s + +b.amount, 0), [bills])
  const insight       = useMemo(() => {
    const spendPct = earned > 0 ? spent / earned : 0
    const dayPct   = dayOfMonth / daysInMonth
    if (!earned && !spent)         return 'Log a transaction to start your money story 📊'
    if (spendPct < dayPct - 0.15)  return `Under pace · ${rate}% saved so far ✨`
    if (spendPct > dayPct + 0.15)  return 'Spending running hot this month · ease up 📈'
    if (dueSoon.length > 0)        return `${dueSoon.length} bill${dueSoon.length > 1 ? 's' : ''} coming due · plan ahead 📅`
    if (investDiff > 0)            return `Invested ${fmt(Math.abs(investDiff))} more than last month 💪`
    if (rate >= 25)                return `Saving ${rate}% of income · outstanding month 🎯`
    return `Saving ${rate}% this month · right on track 👍`
  }, [earned, spent, dayOfMonth, daysInMonth, rate, dueSoon, investDiff])

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
      throw e  // re-throw so TransactionItem resets its loading state
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

  return (
    <div className="page">
      <PageHeader title="Dashboard" />
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">

        {/* ── Greeting ──────────────────────────────────────────────────── */}
        <motion.div variants={fadeUp}>
          <p className="text-caption text-ink-3">
            {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
          <h1 className="text-display font-bold text-ink tracking-tight">
            {greeting}{profile?.display_name ? `, ${profile.display_name.split(' ')[0]}` : ''} 👋
          </h1>
        </motion.div>

        
        {/* ── Hero card ─────────────────────────────────────────────────── */}
        <motion.div variants={fadeUp} className="card-hero p-6 relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <p className="text-caption font-bold tracking-widest uppercase"
              style={{ color: C.heroAccent }}>
              {monthStr(now).toUpperCase()}
            </p>
            <p className="text-caption font-bold tracking-widest"
              style={{ color: C.heroDimmer }}>KOSHA</p>
          </div>
          <div onClick={() => setHeroMode(m => m === 'balance' ? 'safe' : 'balance')} className="cursor-pointer active:scale-[0.98] transition-transform">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-caption font-medium" style={{ color: C.heroLabel }}>
                {heroMode === 'balance' ? 'Total balance' : 'Safe to spend'}
              </p>
              <div className="px-1.5 py-0.5 rounded-full bg-white/10 text-[10px] font-bold text-white/70 uppercase tracking-wider">Tap</div>
            </div>
            <p className="text-hero font-bold text-white leading-none tracking-tight tabular-nums">
              {heroMode === 'balance' 
                ? (runningBalance !== null ? fmt(runningBalance) : '—') 
                : (runningBalance !== null ? fmt(Math.max(0, runningBalance - bills.reduce((acc, b) => acc + b.amount, 0))) : '—')}
            </p>
          </div>
          <div className="mt-2 mb-5 inline-flex items-center px-2.5 py-1 rounded-pill"
            style={{ background: C.heroAccentBg }}>
            <span className="text-caption font-semibold" style={{ color: C.heroAccentSolid }}>
              {rate}% saved this month
            </span>
          </div>
          <div className="border-t mb-4" style={{ borderColor: C.heroDivider }} />
          <div className="flex justify-between gap-1.5 sm:gap-2">
            {[
              { label: 'Earned', val: earned },
              { label: 'Spent', val: spent },
              { label: 'Invested', val: invested },
            ].map(s => (
              <div key={s.label} className="flex-1 min-w-0 px-2 sm:px-3 py-2.5 rounded-2xl"
                style={{ background: C.heroStatBg }}>
                <p className="text-[11px] sm:text-caption mb-0.5 truncate" style={{ color: C.heroLabel }}>{s.label}</p>
                <p className="text-[12px] sm:text-label font-bold text-white tabular-nums truncate">{fmt(s.val)}</p>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <div className="flex justify-between mb-2">
              <span className="text-caption font-medium" style={{ color: C.heroLabel }}>Savings rate</span>
              <span className="text-caption font-bold" style={{ color: C.heroAccentSolid }}>{rate}%</span>
            </div>
            <div className="bar-dark-track">
              <motion.div className="bar-dark-fill"
                initial={{ width: 0 }} animate={{ width: `${rate}%` }}
                transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
              />
            </div>
          </div>
        </motion.div>

        {/* ── Pulse strip ───────────────────────────────────────────────── */}
        <motion.div variants={fadeUp} className="overflow-x-auto -mx-4 px-4">
          <div className="flex gap-2 w-max pr-4">
            {/* Today */}
            <div className="shrink-0 flex flex-col gap-1 px-3 py-2.5 rounded-2xl bg-kosha-surface border border-kosha-border">
              <p className="text-[10px] font-semibold text-ink-4 uppercase tracking-wider">Today</p>
              <p className={`text-[13px] font-bold tabular-nums leading-none ${
                todaySpend > 0 ? 'text-expense-text' : 'text-income-text'
              }`}>  
                {todaySpend > 0 ? fmt(todaySpend, true) : 'All clear 🌿'}
              </p>
            </div>
            {/* Bills due — only if any exist */}
            {totalBillsAmt > 0 && (
              <button
                onClick={() => navigate('/bills')}
                className="shrink-0 flex flex-col gap-1 px-3 py-2.5 rounded-2xl bg-repay-bg border border-repay-border text-left active:opacity-75 transition-opacity"
              >
                <p className="text-[10px] font-semibold text-repay-text uppercase tracking-wider">Bills due</p>
                <p className="text-[13px] font-bold text-repay-text tabular-nums leading-none">{fmt(totalBillsAmt, true)}</p>
              </button>
            )}  
            {/* Contextual insight — fixed width so it never squishes */}
            <div className="shrink-0 w-[175px] flex flex-col gap-1 px-3 py-2.5 rounded-2xl bg-kosha-surface-2 border border-kosha-border">
              <p className="text-[10px] font-semibold text-ink-4 uppercase tracking-wider">Insight</p>
              <p className="text-[12px] font-medium text-ink leading-snug">{insight}</p>
            </div>
          </div>
        </motion.div>

        {/* ── Monthly Pace card ─────────────────────────────────────────── */}
        <motion.div variants={fadeUp} className="card p-4">
          {/* Header row */}
          <div className="mb-3">
            <p className={`text-[15px] font-bold leading-snug ${
              paceOk ? 'text-income-text' : 'text-expense-text'
            }`}>  
              {paceOk ? '✓ On track' : '⚡ Running hot'}
            </p>
            <p className="text-caption text-ink-3">Day {dayOfMonth} of {daysInMonth}</p>
          </div>

          {/* Progress bars */}
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-caption text-ink-3">Month elapsed</span>
                <span className="text-caption font-semibold text-ink">{Math.round(dayOfMonth / daysInMonth * 100)}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: '#EDE9FF' }}>
                <motion.div className="h-full rounded-full bg-income"
                  initial={{ width: 0 }}
                  animate={{ width: `${dayOfMonth / daysInMonth * 100}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-caption text-ink-3">Amount spent</span>
                <span className={`text-caption font-semibold ${
                  paceOk ? 'text-ink' : 'text-expense-text'
                }`}>  
                  {earned > 0 ? Math.round(spent / earned * 100) : 0}%
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: '#EDE9FF' }}>
                <motion.div className="h-full rounded-full bg-expense"
                  initial={{ width: 0 }}
                  animate={{ width: `${earned > 0 ? Math.min(spent / earned * 100, 100) : 0}%` }}
                  transition={{ duration: 0.6, delay: 0.08, ease: 'easeOut' }}
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Quick-action strip ────────────────────────────────────────── */}
        <motion.div variants={fadeUp} className="card py-4 px-2">
          <div className="flex justify-around">
            {[
              { label: 'Income', icon: <ArrowUp size={20} weight="bold" />, bg: 'bg-income-bg', color: C.incomeText, type: 'income' },
              { label: 'Expense', icon: <ArrowDown size={20} weight="bold" />, bg: 'bg-expense-bg', color: C.expense, type: 'expense' },
              { label: 'Invest', icon: <ChartLine size={20} weight="bold" />, bg: 'bg-invest-bg', color: C.investText, type: 'investment' },
              { label: 'Bills', icon: <Receipt size={20} weight="bold" />, bg: 'bg-repay-bg', color: C.bills, type: 'bills' },
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

        {/* ── Bill alert ────────────────────────────────────────────────── */}
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

        {/* ── Investments ───────────────────────────────────────────────── */}
        {invested > 0 && (
          <motion.div variants={fadeUp}>
            <div className="card p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-caption text-ink-3 font-medium">Invested this month</p>
                <div className="flex items-center gap-1.5">
                  {investDiff === 0 ? <Minus size={12} className="text-ink-3" />
                    : investUp ? <TrendingUp size={12} className="text-income-text" />
                      : <TrendingDown size={12} className="text-expense-text" />}
                  <span className={`text-caption font-semibold ${investDiff === 0 ? 'text-ink-3'
                    : investUp ? 'text-income-text' : 'text-expense-text'}`}>  
                    {investDiff === 0 ? 'Same as last month'
                      : `${investUp ? '+' : ''}${fmt(Math.abs(investDiff))} vs last month`}
                  </span>
                </div>
              </div>
              <p className="text-value font-bold text-invest-text tabular-nums">{fmt(invested)}</p>
            </div>
          </motion.div>
        )}

        {/* ── Latest ────────────────────────────────────────────────────── */}
        <motion.div variants={fadeUp}>
          <div className="flex items-center justify-between mb-3">
            <p className="section-label">Latest</p>
            <button onClick={() => navigate('/transactions')}
              className="flex items-center gap-1 text-label font-medium text-brand">
              See all <ArrowRight size={13} />
            </button>
          </div>

          {!recent || recent.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-body text-ink-3">No transactions yet.</p>
              <p className="text-label text-ink-4 mt-1">Tap + to add your first one.</p>
            </div>
          ) : (
            <div className="list-card">
              {recent.slice(0, 8).map((t, i) => (
                <TransactionItem key={t.id} txn={t}
                  showDate
                  isLast={i === Math.min(recent.length, 8) - 1}
                  onDelete={handleDelete}
                  onTap={handleTap}
                  onDuplicate={handleDuplicate}
                />
              ))}
            </div>
          )}
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
            className="fixed bottom-32 left-4 right-4 z-50 flex items-center gap-3
                       bg-ink text-white px-4 py-3 rounded-card shadow-card-lg"
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