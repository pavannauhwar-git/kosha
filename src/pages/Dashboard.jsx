import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bell, ArrowRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useTransactions }   from '../hooks/useTransactions'
import { useMonthSummary }   from '../hooks/useTransactions'
import { useRunningBalance } from '../hooks/useTransactions'
import { useLiabilities }    from '../hooks/useLiabilities'
import AddTransactionSheet   from '../components/AddTransactionSheet'
import TransactionItem       from '../components/TransactionItem'
import DeleteDialog          from '../components/DeleteDialog'
import { deleteTransaction } from '../hooks/useTransactions'
import { fmt, monthStr, savingsRate, daysUntil } from '../lib/utils'
import { CATEGORIES } from '../lib/categories'
import { Plus } from '@phosphor-icons/react'
import CategoryIcon from '../components/CategoryIcon'

const stagger = { hidden:{}, show:{ transition:{ staggerChildren:0.06 } } }
const fadeUp  = {
  hidden:{ opacity:0, y:12 },
  show:{ opacity:1, y:0, transition:{ type:'spring', stiffness:280, damping:26 } }
}

export default function Dashboard() {
  const navigate = useNavigate()
  const now      = new Date()
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

  // Month progress logic
  const daysInMonth  = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const dayOfMonth   = now.getDate()
  const monthPct     = Math.round((dayOfMonth / daysInMonth) * 100)
  const spendPct     = earned > 0 ? Math.round((spent / earned) * 100) : 0
  const onTrack      = spendPct <= monthPct
  const paceGap      = Math.abs(spendPct - monthPct)

  // Top spend category
  const catEntries   = Object.entries(summary?.byCategory || {}).sort((a,b) => b[1]-a[1])
  const topCat       = catEntries[0]
  const topCatPct    = topCat && spent > 0 ? Math.round((topCat[1] / spent) * 100) : 0
  const topCatInfo   = topCat ? CATEGORIES.find(c => c.id === topCat[0]) : null

  // Investment vs last month
  const lastInvested = lastSummary?.investment || 0
  const investDiff   = invested - lastInvested
  const investUp     = investDiff > 0
  const vehicleEntries = Object.entries(summary?.byVehicle || {}).sort((a,b) => b[1]-a[1])

  const hour     = now.getHours()
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
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">

        {/* -- Greeting -- */}
        <motion.div variants={fadeUp} className="flex items-center justify-between pt-2">
          <div>
            <p className="text-[13px] text-ink-3">
              {now.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' })}
            </p>
            <h1 className="text-[28px] font-bold text-ink tracking-tight">{greeting} 👋</h1>
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

        {/* -- Apple Card mesh gradient hero -- */}
        <motion.div variants={fadeUp} className="card-hero p-6 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
              backgroundSize:'128px 128px',
            }}
          />
          <div className="relative">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[11px] font-semibold tracking-widest uppercase text-white/70 mb-1">
                  {monthStr(now).toUpperCase()}
                </p>
                <motion.p
                  className="text-[44px] font-bold text-white leading-none tracking-tight"
                  initial={{ opacity:0, y:8 }}
                  animate={{ opacity:1, y:0 }}
                  transition={{ delay:0.15, duration:0.5 }}
                >
                  {runningBalance !== null ? fmt(runningBalance) : '—'}
                </motion.p>
                <p className="text-[13px] text-white/60 mt-1">Running balance</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-bold tracking-widest text-white/70">KOSHA</p>
              </div>
            </div>

            {/* Stat pills */}
            <div className="flex gap-2 flex-wrap mb-4">
              {[
                { label:'Earned',   val:earned,   bg:'rgba(52,199,89,0.25)'  },
                { label:'Spent',    val:spent,    bg:'rgba(255,59,48,0.25)'  },
                { label:'Invested', val:invested, bg:'rgba(0,122,255,0.25)' },
              ].map(s => (
                <div key={s.label}
                  className="px-3 py-1.5 rounded-full"
                  style={{ background:s.bg, backdropFilter:'blur(8px)' }}>
                  <p className="text-[10px] font-medium text-white/70">{s.label}</p>
                  <p className="text-[13px] font-bold text-white">{fmt(s.val)}</p>
                </div>
              ))}
            </div>

            {/* Savings bar — dark style (white on gradient) */}
            <div>
              <div className="flex justify-between mb-1.5">
                <span className="text-[11px] text-white/60">Savings rate</span>
                <span className="text-[11px] font-semibold text-white">{rate}%</span>
              </div>
              <div className="bar-dark-track">
                <motion.div
                  className="bar-dark-fill"
                  initial={{ width:0 }}
                  animate={{ width:`${rate}%` }}
                  transition={{ duration:0.7, delay:0.3, ease:'easeOut' }}
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* -- Bill alert -- */}
        {dueSoon.length > 0 && (
          <motion.div variants={fadeUp}>
            <button
              onClick={() => navigate('/bills')}
              className="card-warn w-full flex items-center justify-between px-4 py-3.5 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-warning-bg flex items-center justify-center">
                  <Bell size={15} className="text-warning-text" />
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-ink">
                    {dueSoon.length} bill{dueSoon.length > 1 ? 's' : ''} due soon
                  </p>
                  <p className="text-[13px] text-ink-3">
                    {dueSoon.slice(0,2).map(b => b.description).join(' · ')}
                  </p>
                </div>
              </div>
              <ArrowRight size={15} className="text-ink-4 shrink-0" />
            </button>
          </motion.div>
        )}

        {/* -- THIS MONTH section label -- */}
        <motion.div variants={fadeUp}>
          <p className="section-label mb-3">This Month</p>

          {/* Row 1 — 3 stat cards */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            {[
              { label:'Earned',   val:earned,   cls:'text-income-text' },
              { label:'Spent',    val:spent,    cls:'text-expense-text' },
              { label:'Invested', val:invested, cls:'text-invest-text' },
            ].map(s => (
              <div key={s.label} className="card p-3.5">
                <p className="text-[11px] text-ink-3 font-medium mb-1">{s.label}</p>
                <p className={`text-[14px] font-bold tabular-nums ${s.cls}`}>{fmt(s.val)}</p>
              </div>
            ))}
          </div>

          {/* Row 2 — Month Progress + Top Spend */}
          <div className="grid grid-cols-2 gap-3 mb-3">

            {/* Month Progress */}
            <div className="card p-4">
              <p className="text-[11px] text-ink-3 font-medium mb-1">Month Progress</p>
              <p className="text-[13px] font-semibold text-ink mb-0.5">
                Day {dayOfMonth} of {daysInMonth}
              </p>
              {/* Bar — light style on white card */}
              <div className="bar-light-track my-2">
                <motion.div
                  className="bar-light-fill"
                  initial={{ width:'0%' }}
                  animate={{ width:`${monthPct}%` }}
                  transition={{ duration:0.7, ease:'easeOut' }}
                />
              </div>
              <div className="flex items-center gap-1.5">
                {onTrack
                  ? <span className="text-[11px] font-semibold text-income-text">✓ On track</span>
                  : <span className="text-[11px] font-semibold text-expense-text">↑ {paceGap}% ahead</span>
                }
              </div>
              <p className="text-[10px] text-ink-4 mt-0.5">
                Spent {spendPct}% · {monthPct}% through month
              </p>
            </div>

            {/* Top Spend */}
            <div
              className="card p-4 cursor-pointer active:opacity-80"
              onClick={() => navigate('/transactions')}
            >
              <p className="text-[11px] text-ink-3 font-medium mb-2">Top Spend</p>
              {topCat ? (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <CategoryIcon categoryId={topCat[0]} size={16} />
                    <span className="text-[13px] font-semibold text-ink truncate">
                      {topCatInfo?.label || topCat[0]}
                    </span>
                  </div>
                  <p className="text-[15px] font-bold text-expense-text tabular-nums">
                    {fmt(topCat[1])}
                  </p>
                  {/* Bar — light style */}
                  <div className="bar-light-track mt-2">
                    <motion.div
                      className="bar-light-fill"
                      initial={{ width:'0%' }}
                      animate={{ width:`${topCatPct}%` }}
                      transition={{ duration:0.7, ease:'easeOut' }}
                    />
                  </div>
                  <p className="text-[10px] text-ink-4 mt-1">{topCatPct}% of total spend</p>
                </>
              ) : (
                <p className="text-[13px] text-ink-4">No expenses yet</p>
              )}
            </div>
          </div>

          {/* Row 3 — Investment This Month */}
          {invested > 0 && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] text-ink-3 font-medium">Investments This Month</p>
                <div className="flex items-center gap-1">
                  {investDiff === 0
                    ? <Minus size={13} className="text-ink-3" />
                    : investUp
                      ? <TrendingUp size={13} className="text-income-text" />
                      : <TrendingDown size={13} className="text-expense-text" />
                  }
                  <span className={`text-[11px] font-semibold ${
                    investDiff === 0 ? 'text-ink-3'
                    : investUp ? 'text-income-text' : 'text-expense-text'
                  }`}>
                    {investDiff === 0 ? 'Same as last month'
                     : `${investUp ? '+' : ''}${fmt(Math.abs(investDiff))} vs last month`}
                  </span>
                </div>
              </div>

              <p className="text-[22px] font-bold text-invest-text tabular-nums mb-3">
                {fmt(invested)}
              </p>

              {/* Vehicle chips */}
              {vehicleEntries.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {vehicleEntries.slice(0, 4).map(([vehicle, amt]) => (
                    <div key={vehicle}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-invest-bg">
                      <span className="text-[11px] font-medium text-invest-text">{vehicle}</span>
                      <span className="text-[11px] font-semibold text-invest-text">{fmt(amt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* -- Recent -- */}
        <motion.div variants={fadeUp}>
          <div className="flex items-center justify-between mb-2.5">
            <p className="section-label">Recent</p>
            <button
              onClick={() => navigate('/transactions')}
              className="flex items-center gap-1 text-[13px] font-medium text-brand"
            >
              See all <ArrowRight size={12} />
            </button>
          </div>

          {recent.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-ink-3 text-[15px]">No transactions yet.</p>
              <p className="text-ink-4 text-[13px] mt-1">Tap + to add your first one.</p>
            </div>
          ) : (
            <div className="list-card">
              {recent.map((t, i) => (
                <TransactionItem
                  key={t.id} txn={t}
                  isLast={i === recent.length - 1}
                  onDelete={id => setDelId(id)}
                  onTap={t => { setEditTxn(t); setShowAdd(true) }}
                />
              ))}
            </div>
          )}
        </motion.div>

      </motion.div>

      {/* FAB */}
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