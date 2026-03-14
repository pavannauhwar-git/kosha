import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bell, ArrowRight } from 'lucide-react'
import { useTransactions }  from '../hooks/useTransactions'
import { useMonthSummary }  from '../hooks/useTransactions'
import { useLiabilities }   from '../hooks/useLiabilities'
import AddTransactionSheet  from '../components/AddTransactionSheet'
import TransactionItem      from '../components/TransactionItem'
import DeleteDialog         from '../components/DeleteDialog'
import { deleteTransaction } from '../hooks/useTransactions'
import { fmt, monthStr, savingsRate, daysUntil, dueLabel, dueChipClass } from '../lib/utils'
import { Plus } from '@phosphor-icons/react'
import { useRunningBalance } from '../hooks/useTransactions'

const stagger = { hidden:{}, show:{ transition:{ staggerChildren:0.07 } } }
const fadeUp  = { hidden:{ opacity:0, y:10 }, show:{ opacity:1, y:0, transition:{ type:'spring', stiffness:300, damping:28 } } }

export default function Dashboard() {
  const navigate  = useNavigate()
  const now       = new Date()
  const [showAdd, setShowAdd]   = useState(false)
  const [editTxn, setEditTxn]   = useState(null)
  const [delId,   setDelId]     = useState(null)

  const { data: recent, refetch } = useTransactions({ limit: 5 })
  const { data: summary }         = useMonthSummary(now.getFullYear(), now.getMonth() + 1)
  const { balance: runningBalance } = useRunningBalance(now.getFullYear(), now.getMonth() + 1)
  const { pending: bills }        = useLiabilities()

  const dueSoon   = bills.filter(b => daysUntil(b.due_date) <= 7)
  const earned    = summary?.earned     || 0
  const spent     = summary?.expense    || 0
  const invested  = summary?.investment || 0
  const repaid    = summary?.repayments || 0
  const balance   = summary?.balance    || 0
  const rate      = savingsRate(earned, spent)

  async function handleDelete(id) {
    setDelId(id)
  }
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
            <p className="text-xs text-ink-3 font-medium">
              {now.toLocaleDateString('en-IN',{weekday:'long'})}
            </p>
            <h1 className="font-display text-display text-ink">Good morning 👋</h1>
          </div>
          {dueSoon.length > 0 && (
            <button onClick={() => navigate('/bills')}
              className="relative w-10 h-10 rounded-pill bg-warning-bg flex items-center justify-center">
              <Bell size={18} className="text-warning-text" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-expense rounded-pill
                               text-white text-[9px] font-bold flex items-center justify-center">
                {dueSoon.length}
              </span>
            </button>
          )}
        </motion.div>

        {/* ── Hero Card ── */}
        <motion.div variants={fadeUp} className="card-hero p-5 relative overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full"
               style={{ background:'rgba(108,71,255,0.25)' }} />
          <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full"
               style={{ background:'rgba(108,71,255,0.15)' }} />

          <p className="section-label text-on-grad-2 mb-1">{monthStr(now).toUpperCase()}</p>
          <motion.p
            className="font-display text-hero text-on-grad leading-none mb-1"
            initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
            transition={{ delay:0.15, duration:0.6 }}
          >
            {runningBalance !== null ? fmt(runningBalance) : fmt(balance)}
          </motion.p>
          <p className="text-on-grad-2 text-xs mb-4">
            {balance >= 0 ? 'Running balance' : ''}
          </p>

          {/* Mini stat pills */}
          <div className="flex gap-2 flex-wrap mb-4">
            {[
              { label:'Earned',   val:earned,   color:'#C8F5D8', text:'#006B50' },
              { label:'Spent',    val:spent,    color:'#FFD0D4', text:'#93000A' },
              { label:'Invested', val:invested, color:'#D8CFFF', text:'#2D1B69' },
            ].map(s => (
              <div key={s.label}
                className="px-3 py-1.5 rounded-pill"
                style={{ background:s.color }}>
                <p className="text-[10px] font-medium" style={{ color:s.text }}>{s.label}</p>
                <p className="text-xs font-bold" style={{ color:s.text }}>{fmt(s.val)}</p>
              </div>
            ))}
          </div>

          {/* Savings bar */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[11px] text-on-grad-2">Savings rate</span>
              <span className="text-[11px] font-semibold text-on-grad">{rate}%</span>
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
        </motion.div>

        {/* ── Bill Alert ── */}
        {dueSoon.length > 0 && (
          <motion.div variants={fadeUp}>
            <button
              onClick={() => navigate('/bills')}
              className="card-hard-amber w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-chip bg-warning-bg flex items-center justify-center">
                  <Bell size={16} className="text-warning-text" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {dueSoon.length} bill{dueSoon.length > 1 ? 's' : ''} due soon
                  </p>
                  <p className="text-xs text-ink-2">
                    {dueSoon.slice(0,2).map(b => b.description).join(' · ')}
                  </p>
                </div>
              </div>
              <ArrowRight size={16} className="text-ink-3 shrink-0" />
            </button>
          </motion.div>
        )}

        {/* ── Bento stats ── */}
        <motion.div variants={fadeUp} className="grid grid-cols-3 gap-3">
          {[
            { label:'Earned',  val:earned,  cls:'amt-income' },
            { label:'Spent',   val:spent,   cls:'amt-expense' },
            { label:'Invested',val:invested,cls:'amt-invest' },
          ].map(s => (
            <div key={s.label} className="card p-3">
              <p className="text-[10px] text-ink-3 font-medium mb-1">{s.label}</p>
              <p className={`text-sm font-bold ${s.cls}`}>{fmt(s.val)}</p>
            </div>
          ))}
        </motion.div>

        {/* ── Recent transactions ── */}
        <motion.div variants={fadeUp}>
          <div className="flex items-center justify-between mb-3">
            <p className="section-label">Recent</p>
            <button onClick={() => navigate('/transactions')}
              className="flex items-center gap-1 text-xs font-medium text-brand">
              See all <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-2">
            {recent.length === 0 && (
              <div className="card p-6 text-center">
                <p className="text-ink-2 text-sm">No transactions yet.</p>
                <p className="text-ink-3 text-xs mt-1">Tap + to add your first one.</p>
              </div>
            )}
            {recent.map(t => (
              <TransactionItem
                key={t.id} txn={t}
                onDelete={id => setDelId(id)}
                onTap={t => { setEditTxn(t); setShowAdd(true) }}
              />
            ))}
          </div>
        </motion.div>

      </motion.div>

      {/* FAB */}
      <button className="fab" onClick={() => { setEditTxn(null); setShowAdd(true) }}>
        <Plus size={28} weight="bold" color="white" />
      </button>

      <AddTransactionSheet
        open={showAdd} onClose={() => { setShowAdd(false); setEditTxn(null) }}
        onSaved={refetch} editTxn={editTxn}
      />
      <DeleteDialog
        open={!!delId} label="this transaction"
        onConfirm={confirmDelete} onCancel={() => setDelId(null)}
      />
    </div>
  )
}