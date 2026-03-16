import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, ArrowRight, TrendingUp, TrendingDown, Minus, LogOut } from 'lucide-react'
import { useTransactions, registerPrefetch }   from '../hooks/useTransactions'
import { useMonthSummary }   from '../hooks/useTransactions'
import { useRunningBalance } from '../hooks/useTransactions'
import { useLiabilities }    from '../hooks/useLiabilities'
import { useAuth }           from '../hooks/useAuth'
import { useAppData }        from '../hooks/useAppDataStore'
import AddTransactionSheet   from '../components/AddTransactionSheet'
import TransactionItem       from '../components/TransactionItem'
import DeleteDialog          from '../components/DeleteDialog'
import { deleteTransaction } from '../hooks/useTransactions'
import { fmt, monthStr, savingsRate, daysUntil, groupByDate, dateLabel } from '../lib/utils'
import { CATEGORIES } from '../lib/categories'
import { C } from '../lib/colors'
import { Plus, ArrowUp, ArrowDown, ChartLine, Receipt } from '@phosphor-icons/react'
import CategoryIcon from '../components/CategoryIcon'
import PullToRefresh from '../components/PullToRefresh'

const fadeUp = {
  hidden: { opacity: 0, y: 4 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.18, ease: 'easeOut' } },
}
const stagger = {
  hidden: {},
  show:   { transition: { staggerChildren: 0.04, delayChildren: 0.04 } },
}

// ── Profile menu ──────────────────────────────────────────────────────────
function ProfileMenu({ profile, user, onSignOut }) {
  const [open, setOpen] = useState(false)
  const initial = (profile?.display_name || user?.email || 'K')[0].toUpperCase()

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-9 h-9 rounded-full bg-brand-container flex items-center
                   justify-center active:scale-95 transition-transform duration-75"
      >
        <span className="text-label font-bold text-brand-on">{initial}</span>
      </button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity:0, scale:0.95, y:-4 }}
              animate={{ opacity:1, scale:1,    y:0   }}
              exit={{    opacity:0, scale:0.95, y:-4  }}
              transition={{ duration:0.12, ease:'easeOut' }}
              className="absolute right-0 top-11 z-40 w-52 card p-1"
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
                           text-label font-medium text-expense-text hover:bg-expense-bg transition-colors"
              >
                <LogOut size={15} /> Sign out
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── SVG arc progress bar — round-capped, matches Savings ring style ─────────
function SvgArcBar({ pct, color }) {
  const W   = 100  // viewBox width (%)
  const H   = 6    // height in px
  const R   = H / 2
  const max = W - R * 2
  const fill = Math.max(0, Math.min(pct, 100)) / 100 * max
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {/* Track */}
      <line x1={R} y1={R} x2={W - R} y2={R}
        stroke="#D4CEFF" strokeWidth={H} strokeLinecap="round" />
      {/* Fill */}
      {fill > 0 && (
        <line x1={R} y1={R} x2={R + fill} y2={R}
          stroke={color} strokeWidth={H} strokeLinecap="round" />
      )}
    </svg>
  )
}

// ── Savings rate ring — pure SVG arc, no recharts dep ────────────────────
function SavingsRing({ rate }) {
  const size  = 64
  const sw    = 6            // stroke-width
  const r     = (size - sw * 2) / 2
  const cx    = size / 2
  const cy    = size / 2
  const circ  = 2 * Math.PI * r
  const dash  = (Math.min(Math.max(rate, 0), 100) / 100) * circ

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Track */}
      <circle cx={cx} cy={cy} r={r}
        fill="none" stroke={C.brandBorder} strokeWidth={sw} />
      {/* Filled arc */}
      <circle cx={cx} cy={cy} r={r}
        fill="none" stroke={C.brand} strokeWidth={sw}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition:'stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)' }}
      />
      {/* Center label */}
      <text x={cx} y={cy - 5}
        textAnchor="middle" dominantBaseline="central"
        style={{ fontSize:14, fontWeight:700, fill:C.brand,
                 fontFamily:'Plus Jakarta Sans, system-ui' }}>
        {rate}%
      </text>
      <text x={cx} y={cy + 9}
        textAnchor="middle"
        style={{ fontSize:9, fill:C.inkMuted,
                 fontFamily:'Plus Jakarta Sans, system-ui' }}>
        saved
      </text>
    </svg>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const now      = new Date()
  const { user, profile, signOut } = useAuth()

  const [showAdd, setShowAdd] = useState(false)
  const [editTxn, setEditTxn] = useState(null)
  const [delId,   setDelId]   = useState(null)
  const [addType, setAddType] = useState('expense')

  // ── Error toast ──────────────────────────────────────────────────────
  const [toast, setToast] = useState(null)

  const { addOptimisticTxn, clearOptimisticTxns, optimisticTxns } = useAppData()

  const { data: recent, refetch, prependOptimistic } = useTransactions({ limit: 8 })
  const { data: summary,     refetch: refetchSummary }     = useMonthSummary(now.getFullYear(), now.getMonth() + 1)
  const { data: lastSummary, refetch: refetchLastSummary } = useMonthSummary(
    now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(),
    now.getMonth() === 0 ? 12 : now.getMonth()
  )
  const { balance: runningBalance, refetch: refetchBalance } = useRunningBalance(now.getFullYear(), now.getMonth() + 1)
  const { pending: bills, refetch: refetchBills }             = useLiabilities()

  const dueSoon    = bills.filter(b => daysUntil(b.due_date) <= 7)
  const optimisticForMonth = optimisticTxns.filter(t => {
    const d = new Date(t.date)
    return d.getFullYear() === now.getFullYear() &&
           d.getMonth()    === now.getMonth()
  })
  const optimisticEarned   = optimisticForMonth
    .filter(t => t.type === 'income')
    .reduce((s, t) => s + +t.amount, 0)
  const optimisticSpent    = optimisticForMonth
    .filter(t => t.type === 'expense')
    .reduce((s, t) => s + +t.amount, 0)
  const optimisticInvested = optimisticForMonth
    .filter(t => t.type === 'investment')
    .reduce((s, t) => s + +t.amount, 0)

  const earned     = (summary?.earned     || 0) + optimisticEarned
  const spent      = (summary?.expense    || 0) + optimisticSpent
  const invested   = (summary?.investment || 0) + optimisticInvested
  const rate       = savingsRate(earned, spent)

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

  const recentGroups = groupByDate(recent)

  // ── handleOptimisticSave: called immediately when user taps Save ────
  // Payload arrives before any network call. We:
  //   (a) prepend it to the transaction list instantly
  //   (b) update the hero card summary numbers instantly
  const handleOptimisticSave = useCallback((payload) => {
    // Only apply optimistic updates for new transactions in the current month
    // (edits are less common and the brief delay is acceptable)
    const txnDate  = new Date(payload.date)
    const isThisMonth = txnDate.getFullYear() === now.getFullYear() &&
                        txnDate.getMonth()    === now.getMonth()

    // Prepend to the list immediately
    prependOptimistic(payload)

    addOptimisticTxn(payload)
  }, [prependOptimistic, now, addOptimisticTxn])

  // ── handleConfirmed: save succeeded — quiet sync ──────────────────────
  const handleConfirmed = useCallback(() => {
    clearOptimisticTxns()
    refetch()
  }, [refetch, clearOptimisticTxns])

  // ── handleFailed: save failed — roll back + show toast ────────────────
  // The optimistic row disappears when refetch() returns real server data.
  // Toast tells the user what happened so they can try again.
  const handleFailed = useCallback((msg) => {
    clearOptimisticTxns()
    refetch()
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }, [refetch, clearOptimisticTxns])

  const openQuickAdd = useCallback((type) => {
    setAddType(type)
    setEditTxn(null)
    setShowAdd(true)
  }, [])

  const handleSignOut = useCallback(async () => {
    await signOut()
    navigate('/login', { replace: true })
  }, [signOut, navigate])

  const confirmDelete = useCallback(async () => {
    await deleteTransaction(delId)
    setDelId(null)
    refetch()
  }, [delId, refetch])

  const handleRefreshAll = useCallback(() => {
    refetch()
    refetchSummary()
    refetchLastSummary()
    refetchBalance()
    refetchBills()
  }, [refetch, refetchSummary, refetchLastSummary, refetchBalance, refetchBills])

  // Stable callbacks for TransactionItem — avoids remounting memo'd rows
  // on every Dashboard render (e.g. when bell icon updates or state changes)
  const handleDelete = useCallback((id) => setDelId(id), [])
  const handleTap    = useCallback((t) => {
    setEditTxn(t)
    setAddType(t.type)
    setShowAdd(true)
  }, [])

  return (
    <div className="page">
      <PullToRefresh onRefresh={handleRefreshAll} />
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">

        {/* ── Greeting ──────────────────────────────────────────────────── */}
        <motion.div variants={fadeUp} className="flex items-center justify-between pt-2">
          <div>
            <p className="text-caption text-ink-3">
              {now.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' })}
            </p>
            <h1 className="text-display font-bold text-ink tracking-tight">
              {greeting}{profile?.display_name ? `, ${profile.display_name.split(' ')[0]}` : ''} 👋
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {dueSoon.length > 0 && (
              <button onClick={() => navigate('/bills')}
                className="relative w-9 h-9 rounded-full bg-expense-bg flex items-center justify-center">
                <Bell size={16} className="text-expense-text" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-expense rounded-full
                                 text-white text-[9px] font-bold flex items-center justify-center">
                  {dueSoon.length}
                </span>
              </button>
            )}
            <ProfileMenu profile={profile} user={user} onSignOut={handleSignOut} />
          </div>
        </motion.div>

        {/* ── Hero card ─────────────────────────────────────────────────── */}
        <motion.div variants={fadeUp} className="card-hero p-6 relative overflow-hidden">
          {/* Ghost growth curve — faint bezier behind balance, lime at 7% opacity */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 340 180" preserveAspectRatio="none">
            <path d="M-10 160 C 60 140, 100 100, 170 80 S 280 30, 360 10"
              fill="none" stroke="#E2FF5A" strokeWidth="1.5" strokeOpacity="0.07" strokeLinecap="round"/>
          </svg>
          <div className="flex items-center justify-between mb-4">
            <p className="text-caption font-bold tracking-widest uppercase"
               style={{ color:C.heroAccent }}>
              {monthStr(now).toUpperCase()}
            </p>
            <p className="text-caption font-bold tracking-widest"
               style={{ color:C.heroDimmer }}>KOSHA</p>
          </div>
          <p className="text-caption font-medium mb-1" style={{ color:C.heroLabel }}>
            Total balance
          </p>
          <p className="text-hero font-bold text-white leading-none tracking-tight tabular-nums">
            {runningBalance !== null ? fmt(runningBalance) : '—'}
          </p>
          <div className="mt-2 mb-5 inline-flex items-center px-2.5 py-1 rounded-pill"
               style={{ background:C.heroAccentBg }}>
            <span className="text-caption font-semibold" style={{ color:C.heroAccentSolid }}>
              {rate}% saved this month
            </span>
          </div>
          <div className="border-t mb-4" style={{ borderColor:C.heroDivider }} />
          <div className="flex justify-between">
            {[
              { label:'Earned',   val:earned   },
              { label:'Spent',    val:spent    },
              { label:'Invested', val:invested },
            ].map(s => (
              <div key={s.label} className="px-3 py-2.5 rounded-2xl"
                   style={{ background:C.heroStatBg }}>
                <p className="text-caption mb-0.5" style={{ color:C.heroLabel }}>{s.label}</p>
                <p className="text-label font-bold text-white tabular-nums">{fmt(s.val)}</p>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <div className="flex justify-between mb-2">
              <span className="text-caption font-medium" style={{ color:C.heroLabel }}>Savings rate</span>
              <span className="text-caption font-bold" style={{ color:C.heroAccentSolid }}>{rate}%</span>
            </div>
            <div className="bar-dark-track">
              <motion.div className="bar-dark-fill"
                initial={{ width:0 }} animate={{ width:`${rate}%` }}
                transition={{ duration:0.5, delay:0.15, ease:'easeOut' }}
              />
            </div>
          </div>
        </motion.div>

        {/* ── Quick-action strip ────────────────────────────────────────── */}
        <motion.div variants={fadeUp} className="card py-4 px-2">
          <div className="flex justify-around">
            {[
              { label:'Income',  icon:<ArrowUp size={20} weight="bold" />,   bg:'bg-income-bg',  color:C.incomeText,  type:'income'     },
              { label:'Expense', icon:<ArrowDown size={20} weight="bold" />, bg:'bg-expense-bg', color:C.expense,  type:'expense'    },
              { label:'Invest',  icon:<ChartLine size={20} weight="bold" />, bg:'bg-invest-bg',  color:C.investText,  type:'investment' },
              { label:'Bills',   icon:<Receipt size={20} weight="bold" />,   bg:'bg-repay-bg',   color:C.bills,  type:'bills'      },
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

        {/* ── Spending Pulse ────────────────────────────────────────────── */}
        <motion.div variants={fadeUp}>
          <p className="section-label mb-3">Spending Pulse</p>
          <div className="card p-4">
            {/* Header row — status + day counter on left, savings ring on right */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className={`text-label font-bold block ${onTrack ? 'text-income-text' : 'text-expense-text'}`}>
                  {onTrack ? `✓ On track` : `↑ ${paceGap}% ahead of pace`}
                </span>
                <span className="text-caption text-ink-3">Day {dayOfMonth} of {daysInMonth}</span>
              </div>
              <SavingsRing rate={rate} />
            </div>

            {/* Month elapsed — SVG arc bar */}
            <div className="mb-4">
              <div className="flex justify-between mb-2">
                <span className="text-caption text-ink-3">Month elapsed</span>
                <span className="text-caption font-semibold text-ink-2">{monthPct}%</span>
              </div>
              <SvgArcBar pct={monthPct} color={C.income} />
            </div>

            {/* Amount spent — SVG arc bar */}
            <div className="mb-4">
              <div className="flex justify-between mb-2">
                <span className="text-caption text-ink-3">Amount spent</span>
                <span className="text-caption font-semibold text-expense-text">{spendPct}%</span>
              </div>
              <SvgArcBar pct={Math.min(spendPct, 100)} color={C.expenseBright} />
            </div>

            {/* Top category */}
            {topCat && (
              <div className="flex items-center gap-3 pt-3 border-t border-kosha-border
                              cursor-pointer active:opacity-80"
                   onClick={() => navigate('/transactions')}>
                <div className="w-8 h-8 rounded-[10px] flex items-center justify-center shrink-0"
                     style={{ background: topCatInfo?.bg || '#F5F5F5' }}>
                  <CategoryIcon categoryId={topCat[0]} size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-caption text-ink-3">Top spend</p>
                  <p className="text-label font-semibold text-ink truncate">
                    {topCatInfo?.label || topCat[0]}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-label font-bold text-expense-text tabular-nums">{fmt(topCat[1])}</p>
                  <p className="text-caption text-ink-3">{topCatPct}% of spend</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>

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
                  <span className={`text-caption font-semibold ${
                    investDiff === 0 ? 'text-ink-3'
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

        {/* ── Latest — grouped by date ──────────────────────────────────── */}
        <motion.div variants={fadeUp}>
          <div className="flex items-center justify-between mb-3">
            <p className="section-label">Latest</p>
            <button onClick={() => navigate('/transactions')}
              className="flex items-center gap-1 text-label font-medium text-brand">
              See all <ArrowRight size={13} />
            </button>
          </div>

          {recentGroups.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-body text-ink-3">No transactions yet.</p>
              <p className="text-label text-ink-4 mt-1">Tap + to add your first one.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentGroups.slice(0, 3).map(([date, txns]) => {
                const dayNet = txns.reduce((s, t) =>
                  t.type === 'income' ? s + +t.amount : s - +t.amount, 0)
                return (
                  <div key={date} className="list-card">
                    {/* Date group header */}
                    <div className="flex items-center justify-between px-4 py-2 bg-kosha-surface-2
                                    border-b border-kosha-border">
                      <span className="text-caption font-semibold text-ink-3">{dateLabel(date)}</span>
                      <span className={`text-caption font-semibold
                        ${dayNet >= 0 ? 'text-income-text' : 'text-expense-text'}`}>
                        {dayNet >= 0 ? '+' : ''}{fmt(dayNet)}
                      </span>
                    </div>
                    {txns.map((t, i) => (
                      <TransactionItem key={t.id} txn={t}
                        showDate={false}
                        isLast={i === txns.length - 1}
                        onDelete={handleDelete}
                        onTap={handleTap}
                      />
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>

      </motion.div>

      {/* ── Error toast ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity:0, y:20 }}
            animate={{ opacity:1, y:0 }}
            exit={{ opacity:0, y:20 }}
            transition={{ duration:0.2 }}
            className="fixed bottom-32 left-4 right-4 z-50 flex items-center gap-3
                       bg-ink text-white px-4 py-3 rounded-card shadow-card-lg"
          >
            <span className="text-[13px] font-medium flex-1">{toast}</span>
            <button onClick={() => setToast(null)}
              className="text-white opacity-60 text-xs font-semibold">Dismiss</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB */}
      <button className="fab" onClick={() => { setEditTxn(null); setAddType('expense'); setShowAdd(true) }}>
        <Plus size={26} weight="bold" color="white" />
      </button>

      <AddTransactionSheet
        open={showAdd}
        onClose={() => { setShowAdd(false); setEditTxn(null) }}
        onSaved={handleOptimisticSave}
        onConfirmed={handleConfirmed}
        onFailed={handleFailed}
        editTxn={editTxn}
        initialType={addType}
      />
      <DeleteDialog
        open={!!delId} label="this transaction"
        onConfirm={confirmDelete} onCancel={() => setDelId(null)}
      />
    </div>
  )
}
