import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, ArrowRight, TrendingUp, TrendingDown, Minus, LogOut } from 'lucide-react'
import { useTransactions }   from '../hooks/useTransactions'
import { useMonthSummary }   from '../hooks/useTransactions'
import { useRunningBalance } from '../hooks/useTransactions'
import { useLiabilities }    from '../hooks/useLiabilities'
import { useAuth }           from '../hooks/useAuth'
import AddTransactionSheet   from '../components/AddTransactionSheet'
import TransactionItem       from '../components/TransactionItem'
import DeleteDialog          from '../components/DeleteDialog'
import { deleteTransaction } from '../hooks/useTransactions'
import { fmt, monthStr, savingsRate, daysUntil } from '../lib/utils'
import { CATEGORIES } from '../lib/categories'
import { Plus } from '@phosphor-icons/react'
import CategoryIcon from '../components/CategoryIcon'

const fadeUp = {
  hidden: { opacity: 0, y: 4 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.18, ease: 'easeOut' } },
}
const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.04, delayChildren: 0.04 } },
}

// ── Profile avatar + sign-out menu ────────────────────────────────────────
function ProfileMenu({ profile, user, onSignOut }) {
  const [open, setOpen] = useState(false)

  const initial = (profile?.display_name || user?.email || 'K')[0].toUpperCase()

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-10 h-10 rounded-full bg-brand-container flex items-center
                   justify-center active:scale-95 transition-transform duration-75"
      >
        <span className="text-label font-bold text-brand-on">{initial}</span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1,    y: 0 }}
              exit={{    opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.12, ease: 'easeOut' }}
              className="absolute right-0 top-12 z-40 w-52 card p-1"
            >
              <div className="px-3 py-2.5 border-b border-kosha-border mb-1">
                <p className="text-label font-semibold text-ink truncate">
                  {profile?.display_name || 'My Account'}
                </p>
                <p className="text-caption text-ink-3 truncate">{user?.email}</p>
              </div>
              <button
                onClick={() => { setOpen(false); onSignOut() }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-chip
                           text-label font-medium text-expense-text
                           hover:bg-expense-bg transition-colors duration-75"
              >
                <LogOut size={15} />
                Sign out
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const now      = new Date()
  const { user, profile, signOut } = useAuth()

  const [showAdd, setShowAdd] = useState(false)
  const [editTxn, setEditTxn] = useState(null)
  const [delId,   setDelId]   = useState(null)

  const { data: recent, refetch } = useTransactions({ limit: 6 })
  const { data: summary }         = useMonthSummary(now.getFullYear(), now.getMonth() + 1)
  const { data: lastSummary }     = useMonthSummary(
    now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(),
    now.getMonth() === 0 ? 12 : now.getMonth()
  )
  const { balance: runningBalance } = useRunningBalance(now.getFullYear(), now.getMonth() + 1)
  const { pending: bills }          = useLiabilities()

  const dueSoon  = bills.filter(b => daysUntil(b.due_date) <= 7)
  const earned   = summary?.earned     || 0
  const spent    = summary?.expense    || 0
  const invested = summary?.investment || 0
  const rate     = savingsRate(earned, spent)

  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const dayOfMonth  = now.getDate()
  const monthPct    = Math.round((dayOfMonth / daysInMonth) * 100)
  const spendPct    = earned > 0 ? Math.round((spent / earned) * 100) : 0
  const onTrack     = spendPct <= monthPct
  const paceGap     = Math.abs(spendPct - monthPct)

  const catEntries = Object.entries(summary?.byCategory || {}).sort((a, b) => b[1] - a[1])
  const topCat     = catEntries[0]
  const topCatPct  = topCat && spent > 0 ? Math.round((topCat[1] / spent) * 100) : 0
  const topCatInfo = topCat ? CATEGORIES.find(c => c.id === topCat[0]) : null

  const lastInvested = lastSummary?.investment || 0
  const investDiff   = invested - lastInvested
  const investUp     = investDiff > 0

  const hour     = now.getHours()
  const greeting = hour < 12 ? 'Good morning'
                 : hour < 17 ? 'Good afternoon'
                 : hour < 21 ? 'Good evening'
                 : 'Good night'

  async function handleSignOut() {
    await signOut()
  }

  async function confirmDelete() {
    await deleteTransaction(delId)
    setDelId(null)
    refetch()
  }

  return (
    <div className="page">
      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="space-y-4"
      >
        {/* ── Greeting row ──────────────────────────────────────────────── */}
        <motion.div variants={fadeUp} className="flex items-center justify-between pt-2">
          <div>
            <h1 className="font-display text-display font-bold text-ink tracking-tight">
              {greeting}{profile?.display_name ? `, ${profile.display_name.split(' ')[0]}` : ''} 👋
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {dueSoon.length > 0 && (
              <button
                onClick={() => navigate('/bills')}
                className="relative w-10 h-10 rounded-full bg-expense-bg
                           flex items-center justify-center"
              >
                <Bell size={18} className="text-expense-text" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-expense rounded-full
                                 text-white text-[9px] font-bold flex items-center justify-center">
                  {dueSoon.length}
                </span>
              </button>
            )}
            <ProfileMenu profile={profile} user={user} onSignOut={handleSignOut} />
          </div>
        </motion.div>

        {/* ── Hero card — Wise style ─────────────────────────────────────── */}
        {/* Noise SVG removed (was an extra render pass on every repaint).   */}
        {/* Stat chips use solid backgrounds — no backdropFilter needed.     */}
        <motion.div variants={fadeUp} className="card-hero p-6 relative overflow-hidden">
          {/* Month label + KOSHA brand */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-caption font-bold tracking-widest uppercase"
               style={{ color: 'rgba(159,232,112,0.75)' }}>
              {monthStr(now).toUpperCase()}
            </p>
            <p className="text-caption font-bold tracking-widest"
               style={{ color: 'rgba(255,255,255,0.35)' }}>KOSHA</p>
          </div>

          {/* Balance */}
          <p className="text-caption font-medium mb-1" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Total balance
          </p>
          <p className="text-hero font-bold text-white leading-none tracking-tight tabular-nums">
            {runningBalance !== null ? fmt(runningBalance) : '—'}
          </p>

          {/* Savings rate chip */}
          <div className="mt-2 mb-5 inline-flex items-center gap-1 px-2.5 py-1 rounded-pill"
               style={{ background: 'rgba(159,232,112,0.18)' }}>
            <span className="text-caption font-semibold" style={{ color: '#9FE870' }}>
              {rate}% saved this month
            </span>
          </div>

          {/* Divider */}
          <div className="border-t mb-4" style={{ borderColor: 'rgba(255,255,255,0.12)' }} />

          {/* Stats row — solid bg chips, no blur */}
          <div className="flex justify-between">
            {[
              { label: 'Earned',   val: earned   },
              { label: 'Spent',    val: spent    },
              { label: 'Invested', val: invested },
            ].map(s => (
              <div key={s.label}
                className="px-3 py-2.5 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.10)' }}
              >
                <p className="text-caption mb-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  {s.label}
                </p>
                <p className="text-label font-bold text-white tabular-nums">{fmt(s.val)}</p>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="bar-dark-track">
              <motion.div
                className="bar-dark-fill"
                initial={{ width: 0 }}
                animate={{ width: `${rate}%` }}
                transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
              />
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
                  <span className={`text-caption font-semibold ${
                    investDiff === 0 ? 'text-ink-3'
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
