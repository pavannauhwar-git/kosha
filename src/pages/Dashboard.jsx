import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bell, ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useTransactions } from '../hooks/useTransactions'
import { useMonthSummary } from '../hooks/useTransactions'
import { useRunningBalance } from '../hooks/useTransactions'
import { useLiabilities } from '../hooks/useLiabilities'
import AddTransactionSheet from '../components/AddTransactionSheet'
import TransactionItem from '../components/TransactionItem'
import DeleteDialog from '../components/DeleteDialog'
import { deleteTransaction } from '../hooks/useTransactions'
import { fmt, monthStr, savingsRate, daysUntil } from '../lib/utils'
import { CATEGORIES } from '../lib/categories'
import { Plus } from '@phosphor-icons/react'
import CategoryIcon from '../components/CategoryIcon'

// Simple easeOut — not springs. Springs are for interactive gestures.
// y:4 not y:12 — barely perceptible movement, just enough to feel alive.
// stagger:0.04 — tight enough that sections feel like one motion.
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
  const now = new Date()
  const [showAdd, setShowAdd] = useState(false)
  const [editTxn, setEditTxn] = useState(null)
  const [delId, setDelId] = useState(null)

  const { data: recent, refetch } = useTransactions({ limit: 6 })
  const { data: summary } = useMonthSummary(now.getFullYear(), now.getMonth() + 1)
  const { data: lastSummary } = useMonthSummary(
    now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(),
    now.getMonth() === 0 ? 12 : now.getMonth()
  )
  const { balance: runningBalance } = useRunningBalance(now.getFullYear(), now.getMonth() + 1)
  const { pending: bills } = useLiabilities()

  const dueSoon = bills.filter(b => daysUntil(b.due_date) <= 7)
  const earned = summary?.earned || 0
  const spent = summary?.expense || 0
  const invested = summary?.investment || 0
  const rate = savingsRate(earned, spent)

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const dayOfMonth = now.getDate()
  const monthPct = Math.round((dayOfMonth / daysInMonth) * 100)
  const spendPct = earned > 0 ? Math.round((spent / earned) * 100) : 0
  const onTrack = spendPct <= monthPct
  const paceGap = Math.abs(spendPct - monthPct)

  const catEntries = Object.entries(summary?.byCategory || {}).sort((a, b) => b[1] - a[1])
  const topCat = catEntries[0]
  const topCatPct = topCat && spent > 0 ? Math.round((topCat[1] / spent) * 100) : 0
  const topCatInfo = topCat ? CATEGORIES.find(c => c.id === topCat[0]) : null

  const lastInvested = lastSummary?.investment || 0
  const investDiff = invested - lastInvested
  const investUp = investDiff > 0

  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning'
    : hour < 17 ? 'Good afternoon'
      : hour < 21 ? 'Good evening'
        : 'Good night'

  async function confirmDelete() {
    await deleteTransaction(delId)
    setDelId(null)
    refetch()
  }

  return (
    <div className="page">
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">

        {/* ── Greeting ──────────────────────────────────────────────────── */}
        <motion.div variants={fadeUp} className="flex items-center justify-between pt-2">
          <div>
            <p className="text-label text-ink-3">
              {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 className="text-display font-bold text-ink tracking-tight">{greeting} 👋</h1>
          </div>
          {dueSoon.length > 0 && (
            <button
              onClick={() => navigate('/bills')}
              className="relative w-10 h-10 rounded-full bg-expense-bg flex items-center justify-center"
            >
              <Bell size={18} className="text-expense-text" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-expense rounded-full
                               text-white text-[9px] font-bold flex items-center justify-center">
                {dueSoon.length}
              </span>
            </button>
          )}
        </motion.div>

        {/* ── Hero card ─────────────────────────────────────────────────── */}
        <motion.div variants={fadeUp} className="card-hero p-6 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
              backgroundSize: '128px 128px',
            }}
          />
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <p className="text-caption font-semibold tracking-widest uppercase text-white/60">
                {monthStr(now).toUpperCase()}
              </p>
              <p className="text-caption font-bold tracking-widest text-white/50">KOSHA</p>
            </div>
            <p className="text-hero font-bold text-white leading-none tracking-tight mb-1 tabular-nums">
              {runningBalance !== null ? fmt(runningBalance) : '—'}
            </p>
            <p className="text-caption text-white/50 mb-5">Running balance</p>

            <div className="flex gap-2 flex-wrap mb-5">
              {[
                { label: 'Earned', val: earned, bg: 'rgba(0,200,150,0.22)' },
                { label: 'Spent', val: spent, bg: 'rgba(255,71,87,0.22)' },
                { label: 'Invested', val: invested, bg: 'rgba(108,71,255,0.22)' },
              ].map(s => (
                <div key={s.label}
                  className="px-3 py-2 rounded-2xl"
                  style={{ background: s.bg, backdropFilter: 'blur(8px)' }}
                >
                  <p className="text-caption text-white/60">{s.label}</p>
                  <p className="text-label font-bold text-white tabular-nums">{fmt(s.val)}</p>
                </div>
              ))}
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-caption text-white/60">Savings rate</span>
                <span className="text-caption font-semibold text-white">{rate}%</span>
              </div>
              <div className="bar-dark-track">
                <motion.div
                  className="bar-dark-fill"
                  initial={{ width: 0 }}
                  animate={{ width: `${rate}%` }}
                  transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Bill alert ────────────────────────────────────────────────── */}
        {dueSoon.length > 0 && (
          <motion.div variants={fadeUp}>
            <button
              onClick={() => navigate('/bills')}
              className="card-warn w-full flex items-center justify-between px-4 py-4 text-left"
            >
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

        {/* ── Month at a glance ─────────────────────────────────────────── */}
        <motion.div variants={fadeUp}>
          <p className="section-label mb-4">Month at a Glance</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-4">
              <p className="text-caption text-ink-3 font-medium mb-2">Pace</p>
              <p className="text-value font-bold text-ink tabular-nums leading-none mb-1">
                {dayOfMonth}<span className="text-label font-medium text-ink-3"> / {daysInMonth}</span>
              </p>
              <p className="text-caption text-ink-3 mb-3">Days through month</p>
              <div className="bar-light-track mb-2">
                <motion.div
                  className="bar-light-fill"
                  initial={{ width: '0%' }}
                  animate={{ width: `${monthPct}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
              <p className={`text-caption font-semibold ${onTrack ? 'text-income-text' : 'text-expense-text'}`}>
                {onTrack ? `✓ On track · spent ${spendPct}%` : `↑ ${paceGap}% ahead of pace`}
              </p>
            </div>

            <div
              className="card p-4 cursor-pointer active:opacity-80"
              onClick={() => navigate('/transactions')}
            >
              <p className="text-caption text-ink-3 font-medium mb-2">Top spend</p>
              {topCat ? (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <CategoryIcon categoryId={topCat[0]} size={16} />
                    <span className="text-label font-semibold text-ink truncate">
                      {topCatInfo?.label || topCat[0]}
                    </span>
                  </div>
                  <p className="text-value font-bold text-expense-text tabular-nums leading-none mb-3">
                    {fmt(topCat[1])}
                  </p>
                  <div className="bar-light-track mb-1">
                    <motion.div
                      className="bar-light-fill"
                      initial={{ width: '0%' }}
                      animate={{ width: `${topCatPct}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                  <p className="text-caption text-ink-3">{topCatPct}% of total spend</p>
                </>
              ) : (
                <p className="text-label text-ink-4">No expenses yet</p>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── Investments ───────────────────────────────────────────────── */}
        {invested > 0 && (
          <motion.div variants={fadeUp}>
            <div className="card p-5">
              <div className="flex items-center justify-between mb-1">
                <p className="text-caption text-ink-3 font-medium">Invested this month</p>
                <div className="flex items-center gap-1.5">
                  {investDiff === 0
                    ? <Minus size={12} className="text-ink-3" />
                    : investUp
                      ? <TrendingUp size={12} className="text-income-text" />
                      : <TrendingDown size={12} className="text-expense-text" />
                  }
                  <span className={`text-caption font-semibold ${investDiff === 0 ? 'text-ink-3'
                      : investUp ? 'text-income-text' : 'text-expense-text'
                    }`}>
                    {investDiff === 0
                      ? 'Same as last month'
                      : `${investUp ? '+' : ''}${fmt(Math.abs(investDiff))} vs last month`}
                  </span>
                </div>
              </div>
              <p className="text-value font-bold text-invest-text tabular-nums">
                {fmt(invested)}
              </p>
            </div>
          </motion.div>
        )}

        {/* ── Recent ────────────────────────────────────────────────────── */}
        <motion.div variants={fadeUp}>
          <div className="flex items-center justify-between mb-4">
            <p className="section-label">Recent</p>
            <button
              onClick={() => navigate('/transactions')}
              className="flex items-center gap-1 text-label font-medium text-brand"
            >
              See all <ArrowRight size={13} />
            </button>
          </div>
          {recent.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-body text-ink-3">No transactions yet.</p>
              <p className="text-label text-ink-4 mt-1">Tap + to add your first one.</p>
            </div>
          ) : (
            <div className="list-card">
              {recent.map((t, i) => (
                <TransactionItem
                  key={t.id} txn={t}
                  showDate={true}
                  isLast={i === recent.length - 1}
                  onDelete={id => setDelId(id)}
                  onTap={t => { setEditTxn(t); setShowAdd(true) }}
                />
              ))}
            </div>
          )}
        </motion.div>

      </motion.div>

      <button className="fab" onClick={() => { setEditTxn(null); setShowAdd(true) }}>
        <Plus size={26} weight="bold" color="white" />
      </button>

      <AddTransactionSheet
        open={showAdd}
        onClose={() => { setShowAdd(false); setEditTxn(null) }}
        onSaved={refetch}
        editTxn={editTxn}
      />
      <DeleteDialog
        open={!!delId} label="this transaction"
        onConfirm={confirmDelete} onCancel={() => setDelId(null)}
      />
    </div>
  )
}