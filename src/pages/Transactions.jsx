import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X } from 'lucide-react'
import { useTransactions, deleteTransaction } from '../hooks/useTransactions'
import TransactionItem    from '../components/TransactionItem'
import AddTransactionSheet from '../components/AddTransactionSheet'
import DeleteDialog       from '../components/DeleteDialog'
import { CATEGORIES }     from '../lib/categories'
import { groupByDate, dateLabel, fmt } from '../lib/utils'
import { Plus } from '@phosphor-icons/react'

const TYPES = [
  { id:'all',        label:'All'      },
  { id:'expense',    label:'Expenses' },
  { id:'income',     label:'Income'   },
  { id:'investment', label:'Invest'   },
]

const TYPE_CHIP = {
  all:        'bg-brand-container text-brand-on border-brand-container',
  expense:    'bg-expense-bg text-expense-text border-expense-border',
  income:     'bg-income-bg text-income-text border-income-border',
  investment: 'bg-invest-bg text-invest-text border-invest-border',
}

export default function Transactions() {
  const [typeFilter, setTypeFilter] = useState('all')
  const [catFilter,  setCatFilter]  = useState('')
  const [search,     setSearch]     = useState('')
  const [showAdd,    setShowAdd]    = useState(false)
  const [editTxn,    setEditTxn]    = useState(null)
  const [delId,      setDelId]      = useState(null)
  const [showCats,   setShowCats]   = useState(false)

  const { data, refetch } = useTransactions({
    type:     typeFilter === 'all' ? undefined : typeFilter,
    category: catFilter  || undefined,
    search:   search     || undefined,
  })

  const groups = groupByDate(data)
  const total  = data.reduce((s, t) => {
    if (t.type === 'expense')    return s - t.amount
    if (t.type === 'income')     return s + t.amount
    if (t.type === 'investment') return s - t.amount
    return s
  }, 0)

  async function confirmDelete() {
    await deleteTransaction(delId)
    setDelId(null)
    refetch()
  }

  return (
    <div className="page">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pt-2">
        <h1 className="font-display text-display text-ink">Transactions</h1>
      </div>

      {/* Search */}
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
        <input
          className="input pl-9 pr-9"
          placeholder="Search transactions…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2">
            <X size={14} className="text-ink-3" />
          </button>
        )}
      </div>

      {/* Type chips */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-2">
        {TYPES.map(t => (
          <button key={t.id}
            onClick={() => { setTypeFilter(t.id); setCatFilter(''); setShowCats(false) }}
            className={`px-3 py-1.5 rounded-pill text-xs font-semibold border shrink-0 transition-all
              ${typeFilter === t.id
                ? TYPE_CHIP[t.id]
                : 'bg-kosha-surface text-ink-2 border-kosha-border'}`}
          >
            {t.label}
          </button>
        ))}
        <button
          onClick={() => setShowCats(v => !v)}
          className={`px-3 py-1.5 rounded-pill text-xs font-semibold border shrink-0 transition-all
            ${catFilter ? 'bg-brand-container text-brand-on border-brand-container'
                        : 'bg-kosha-surface text-ink-2 border-kosha-border'}`}
        >
          {catFilter
            ? CATEGORIES.find(c => c.id === catFilter)?.label
            : 'Category ▾'}
        </button>
      </div>

      {/* Category filter row */}
      <AnimatePresence>
        {showCats && (
          <motion.div
            initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }}
            exit={{ height:0, opacity:0 }} transition={{ duration:0.2 }}
            className="overflow-hidden mb-2"
          >
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
              <button
                onClick={() => { setCatFilter(''); setShowCats(false) }}
                className={`px-3 py-1.5 rounded-pill text-xs font-semibold border shrink-0
                  ${!catFilter ? 'bg-brand-container text-brand-on border-brand-container'
                               : 'bg-kosha-surface text-ink-2 border-kosha-border'}`}
              >All</button>
              {CATEGORIES.map(c => (
                <button key={c.id}
                  onClick={() => { setCatFilter(c.id); setShowCats(false) }}
                  className={`px-3 py-1.5 rounded-pill text-xs font-semibold border shrink-0 transition-all
                    ${catFilter === c.id ? 'text-white border-transparent' : 'bg-kosha-surface text-ink-2 border-kosha-border'}`}
                  style={catFilter === c.id ? { background: c.color, borderColor: c.color } : {}}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Groups */}
      <div className="space-y-4">
        {groups.length === 0 && (
          <div className="card p-8 text-center mt-6">
            <p className="text-ink-2 text-sm">No transactions found.</p>
            {search && <p className="text-ink-3 text-xs mt-1">Try a different search term.</p>}
          </div>
        )}
        {groups.map(([date, txns]) => (
          <div key={date}>
            <p className="section-label mb-2">{dateLabel(date)}</p>
            <div className="space-y-2">
              {txns.map(t => (
                <TransactionItem
                  key={t.id} txn={t}
                  onDelete={id => setDelId(id)}
                  onTap={t => { setEditTxn(t); setShowAdd(true) }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Net footer */}
      {data.length > 0 && (
        <div className="card mt-4 px-4 py-3 flex justify-between items-center">
          <span className="text-xs text-ink-2">{data.length} transactions</span>
          <span className={`text-sm font-semibold ${total >= 0 ? 'amt-income' : 'amt-expense'}`}>
            Net {fmt(Math.abs(total))}
          </span>
        </div>
      )}

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
