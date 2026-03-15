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
import { fmt, monthStr, savingsRate, daysUntil, groupByDate, dateLabel } from '../lib/utils'
import { CATEGORIES } from '../lib/categories'
import { Plus, ArrowUp, ArrowDown, ChartLine, Receipt } from '@phosphor-icons/react'
import CategoryIcon from '../components/CategoryIcon'

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
        fill="none" stroke="#D6ECC4" strokeWidth={sw} />
      {/* Filled arc */}
      <circle cx={cx} cy={cy} r={r}
        fill="none" stroke="#163300" strokeWidth={sw}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition:'stroke-dasharray 0.8s cubic-bezier(0.4,0,0.2,1)' }}
      />
      {/* Center label */}
      <text x={cx} y={cy - 5}
        textAnchor="middle" dominantBaseline="central"
        style={{ fontSize:14, fontWeight:700, fill:'#163300',
                 fontFamily:'Plus Jakarta Sans, system-ui' }}>
        {rate}%
      </text>
      <text x={cx} y={cy + 9}
        textAnchor="middle"
        style={{ fontSize:9, fill:'#7A8F6E',
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

  const { data: recent, refetch } = useTransactions({ limit: 8 })
  const { data: summary }         = useMonthSummary(now.getFullYear(), now.getMonth() + 1)
  const { data: lastSummary }     = useMonthSummary(
    now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(),
    now.getMonth() === 0 ? 12 : now.getMonth()
  )
  const { balance: runningBalance } = useRunningBalance(now.getFullYear(), now.getMonth() + 1)
  const { pending: bills }          = useLiabilities()

  const dueSoon    = bills.filter(b => daysUntil(b.due_date) <= 7)
  const earned     = summary?.earned     || 0
  const spent      = summary?.expense    || 0
  const invested   = summary?.investment || 0
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

  function openQuickAdd(type) {
    setAddType(type)
    setEditTxn(null)
    setShowAdd(true)
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  async function confirmDelete() {
    await deleteTransaction(delId)
    setDelId(null)
    refetch()
  }

  return (
    <div className="page">
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
          <div className="flex items-center justify-between mb-4">
            <p className="text-caption font-bold tracking-widest uppercase"
               style={{ color:'rgba(159,232,112,0.75)' }}>
              {monthStr(now).toUpperCase()}
            </p>
            <p className="text-caption font-bold tracking-widest"
               style={{ color:'rgba(255,255,255,0.35)' }}>KOSHA</p>
          </div>
          <p className="text-caption font-medium mb-1" style={{ color:'rgba(255,255,255,0.55)' }}>
            Total balance
          </p>
          <p className="text-hero font-bold text-white leading-none tracking-tight tabular-nums">
            {runningBalance !== null ? fmt(runningBalance) : '—'}
          </p>
          <div className="mt-2 mb-5 inline-flex items-center px-2.5 py-1 rounded-pill"
               style={{ background:'rgba(159,232,112,0.18)' }}>
            <span className="text-caption font-semibold" style={{ color:'#9FE870' }}>
              {rate}% saved this month
            </span>
          </div>
          <div className="border-t mb-4" style={{ borderColor:'rgba(255,255,255,0.12)' }} />
          <div className="flex justify-between">
            {[
              { label:'Earned',   val:earned   },
              { label:'Spent',    val:spent    },
              { label:'Invested', val:invested },
            ].map(s => (
              <div key={s.label} className="px-3 py-2.5 rounded-2xl"
                   style={{ background:'rgba(255,255,255,0.10)' }}>
                <p className="text-caption mb-0.5" style={{ color:'rgba(255,255,255,0.55)' }}>{s.label}</p>
                <p className="text-label font-bold text-white tabular-nums">{fmt(s.val)}</p>
              </div>
            ))}
          </div>
          <div className="mt-4">
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
              { label:'Income',  icon:<ArrowUp size={20} weight="bold" />,   bg:'bg-income-bg',  color:'#276749',  type:'income'     },
              { label:'Expense', icon:<ArrowDown size={20} weight="bold" />, bg:'bg-expense-bg', color:'#D42B3A',  type:'expense'    },
              { label:'Invest',  icon:<ChartLine size={20} weight="bold" />, bg:'bg-invest-bg',  color:'#1A5C45',  type:'investment' },
              { label:'Bills',   icon:<Receipt size={20} weight="bold" />,   bg:'bg-repay-bg',   color:'#B35A00',  type:'bills'      },
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

            {/* Month elapsed */}
            <div className="mb-3">
              <div className="flex justify-between mb-1.5">
                <span className="text-caption text-ink-3">Month elapsed</span>
                <span className="text-caption font-semibold text-ink-2">{monthPct}%</span>
              </div>
              <div className="bar-light-track">
                <motion.div className="h-full rounded-pill absolute inset-y-0 left-0"
                  style={{ background:'#38A169' }}
                  initial={{ width:'0%' }} animate={{ width:`${monthPct}%` }}
                  transition={{ duration:0.5, ease:'easeOut' }}
                />
              </div>
            </div>

            {/* Amount spent */}
            <div className="mb-4">
              <div className="flex justify-between mb-1.5">
                <span className="text-caption text-ink-3">Amount spent</span>
                <span className="text-caption font-semibold text-expense-text">{spendPct}%</span>
              </div>
              <div className="bar-light-track">
                <motion.div className="h-full rounded-pill absolute inset-y-0 left-0"
                  style={{ background:'#FF4757' }}
                  initial={{ width:'0%' }} animate={{ width:`${Math.min(spendPct, 100)}%` }}
                  transition={{ duration:0.5, ease:'easeOut', delay:0.1 }}
                />
              </div>
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
                        onDelete={id => setDelId(id)}
                        onTap={t => { setEditTxn(t); setAddType(t.type); setShowAdd(true) }}
                      />
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </motion.div>

      </motion.div>

      {/* FAB */}
      <button className="fab" onClick={() => { setEditTxn(null); setAddType('expense'); setShowAdd(true) }}>
        <Plus size={26} weight="bold" color="white" />
      </button>

      <AddTransactionSheet
        open={showAdd}
        onClose={() => { setShowAdd(false); setEditTxn(null) }}
        onSaved={refetch}
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
