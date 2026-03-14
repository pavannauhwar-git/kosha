import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bell, ArrowRight } from 'lucide-react'
import { useTransactions }   from '../hooks/useTransactions'
import { useMonthSummary }   from '../hooks/useTransactions'
import { useRunningBalance } from '../hooks/useTransactions'
import { useLiabilities }    from '../hooks/useLiabilities'
import AddTransactionSheet   from '../components/AddTransactionSheet'
import TransactionItem       from '../components/TransactionItem'
import DeleteDialog          from '../components/DeleteDialog'
import { deleteTransaction } from '../hooks/useTransactions'
import { fmt, monthStr, savingsRate, daysUntil } from '../lib/utils'
import { Plus } from '@phosphor-icons/react'

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
  const { balance: runningBalance } = useRunningBalance(now.getFullYear(), now.getMonth() + 1)
  const { pending: bills }        = useLiabilities()

  const dueSoon  = bills.filter(b => daysUntil(b.due_date) <= 7)
  const earned   = summary?.earned     || 0
  const spent    = summary?.expense    || 0
  const invested = summary?.investment || 0
  const rate     = savingsRate(earned, spent)

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

        {/* ── Greeting ── */}
        <motion.div variants={fadeUp} className="flex items-center justify-between pt-2">
          <div>
            <p className="text-[13px] text-ink-3">
              {now.toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' })}
            </p>
            <h1 className="font-display text-display text-ink">{greeting} 👋</h1>
          </div>
          {dueSoon.length > 0 && (
            <button
              onClick={() => navigate('/bills')}
              className="relative w-10 h-10 rounded-pill bg-expense-bg flex items-center justify-center"
            >
              <Bell size={18} className="text-expense-text" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-expense rounded-pill
                               text-white text-[9px] font-bold flex items-center justify-center">
                {dueSoon.length}
              </span>
            </button>
          )}
        </motion.div>

        {/* ── Apple Card mesh gradient hero ── */}
        <motion.div variants={fadeUp} className="card-hero p-6 relative overflow-hidden">
          {/* Subtle noise texture overlay */}
          <div className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
              backgroundSize: '128px 128px',
            }}
          />

          <div className="relative">
            {/* Card header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[11px] font-semibold tracking-widest uppercase text-white/70 mb-1">
                  {monthStr(now).toUpperCase()}
                </p>
                <motion.p
                  className="font-display text-hero text-white leading-none"
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

            {/* Stat pills — glass style */}
            <div className="flex gap-2 flex-wrap mb-4">
              {[
                { label:'Earned',   val:earned,   bg:'rgba(52,199,89,0.25)',  text:'#FFFFFF' },
                { label:'Spent',    val:spent,    bg:'rgba(255,59,48,0.25)',  text:'#FFFFFF' },
                { label:'Invested', val:invested, bg:'rgba(0,122,255,0.25)', text:'#FFFFFF' },
              ].map(s => (
                <div key={s.label}
                  className="px-3 py-1.5 rounded-pill"
                  style={{ background:s.bg, backdropFilter:'blur(8px)' }}>
                  <p className="text-[10px] font-medium text-white/70">{s.label}</p>
                  <p className="text-[13px] font-bold text-white">{fmt(s.val)}</p>
                </div>
              ))}
            </div>

            {/* Savings bar */}
            <div>
              <div className="flex justify-between mb-1.5">
                <span className="text-[11px] text-white/60">Savings rate</span>
                <span className="text-[11px] font-semibold text-white">{rate}%</span>
              </div>
              <div className="savings-track">
                <motion.div
                  className="savings-fill"
                  initial={{ width:0 }}
                  animate={{ width:`${rate}%` }}
                  transition={{ duration:0.7, delay:0.3, ease:'easeOut' }}
                />
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Bill alert ── */}
        {dueSoon.length > 0 && (
          <motion.div variants={fadeUp}>
            <button
              onClick={() => navigate('/bills')}
              className="card-warn w-full flex items-center justify-between px-4 py-3.5 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-chip bg-warning-bg flex items-center justify-center">
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

        {/* ── Bento stats ── */}
        <motion.div variants={fadeUp} className="grid grid-cols-3 gap-3">
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
        </motion.div>

        {/* ── Recent transactions — Apple Wallet list card ── */}
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
