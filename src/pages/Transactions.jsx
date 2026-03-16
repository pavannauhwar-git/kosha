import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, SlidersHorizontal } from 'lucide-react'
import { useTransactions, registerPrefetch, deleteTransaction, useDebounce } from '../hooks/useTransactions'
import TransactionItem     from '../components/TransactionItem'
import AddTransactionSheet from '../components/AddTransactionSheet'
import DeleteDialog        from '../components/DeleteDialog'
import { CATEGORIES }      from '../lib/categories'
import { groupByDate, dateLabel, fmt } from '../lib/utils'
import { Plus } from '@phosphor-icons/react'
import { useAppData } from '../hooks/useAppDataStore'

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

function groupNet(txns) {
  return txns.reduce((s, t) =>
    t.type === 'income' ? s + +t.amount : s - +t.amount, 0)
}

export default function Transactions() {
  const [typeFilter, setTypeFilter] = useState('all')
  const [catFilter,  setCatFilter]  = useState('')
  const [search,     setSearch]     = useState('')
  const [showAdd,    setShowAdd]    = useState(false)
  const [editTxn,    setEditTxn]    = useState(null)
  const [delId,      setDelId]      = useState(null)
  const [showCats,   setShowCats]   = useState(false)
  const [addType,    setAddType]    = useState('expense')
  const [displayCount, setDisplayCount] = useState(50)
  const [toast, setToast] = useState(null)

  // Tracks which transaction id is being edited so we can clear the
  // localEdits overlay after onConfirmed (refetch returns fresh server data)
  const pendingEditId = useRef(null)

  const debouncedSearch = useDebounce(search, 300)
  useEffect(() => { setDisplayCount(50) }, [typeFilter, catFilter, debouncedSearch])

  const {
    data,
    refetch,
    prependOptimistic,
    applyLocalEdit,
    clearLocalEdit,
    applyLocalDelete,
  } = useTransactions({
    type:     typeFilter === 'all' ? undefined : typeFilter,
    category: catFilter  || undefined,
    search:   debouncedSearch || undefined,
  })

  const visibleData = data.slice(0, displayCount)
  const groups      = groupByDate(visibleData)
  const hasMore     = data.length > displayCount
  const filterCount = (catFilter ? 1 : 0) + (typeFilter !== 'all' ? 1 : 0)

  // ✅ FIXED: moved up before confirmDelete so variables are defined in time
  const { addOptimisticTxn, clearOptimisticTxns, addOptimisticDelete, removeOptimisticDelete } = useAppData()

  const confirmDelete = useCallback(async () => {
    const id = delId
    if (!id) return

    addOptimisticDelete(id)
    applyLocalDelete(id)

    try {
      await deleteTransaction(id)
    } catch (e) {
      removeOptimisticDelete(id)
      refetch()
      setToast(e.message || 'Could not delete transaction. Check your connection.')
      setTimeout(() => setToast(null), 4000)
    } finally {
      setDelId(null)
    }
  }, [delId, addOptimisticDelete, removeOptimisticDelete, applyLocalDelete, refetch])

  const handleDelete = useCallback((id) => setDelId(id), [])
  const handleTap    = useCallback((t) => {
    setEditTxn(t)
    setAddType(t.type)
    setShowAdd(true)
  }, [])

  return (
    <div className="page">

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="mb-4 pt-2">
        <h1 className="font-display text-display text-ink">Transactions</h1>
        <p className="text-caption text-ink-3 mt-0.5">
          {data.length > 0 ? `${data.length} transaction${data.length !== 1 ? 's' : ''}` : 'No results'}
          {(typeFilter !== 'all' || catFilter) ? ' (filtered)' : ''}
        </p>
      </div>

      {/* ── Search bar ───────────────────────────────────────────────── */}
      <div className="relative mb-3">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
        <input
          className="w-full bg-kosha-surface border border-kosha-border rounded-card
                     pl-9 pr-9 py-2.5 text-[14px] text-ink placeholder-ink-4 outline-none
                     focus:border-brand transition-colors"
          placeholder="Search transactions…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* ── Filter chips ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto scrollbar-none">
        {TYPES.map(t => (
          <button
            key={t.id}
            onClick={() => setTypeFilter(t.id)}
            className={`shrink-0 px-3 py-1.5 rounded-pill text-label font-semibold border
                        transition-colors ${typeFilter === t.id
                          ? TYPE_CHIP[t.id]
                          : 'bg-kosha-surface text-ink-3 border-kosha-border'}`}
          >
            {t.label}
          </button>
        ))}

        {/* Category filter button */}
        <button
          onClick={() => setShowCats(v => !v)}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-pill
                      text-label font-semibold border transition-colors
                      ${catFilter
                        ? 'bg-brand-container text-brand-on border-brand-container'
                        : 'bg-kosha-surface text-ink-3 border-kosha-border'}`}
        >
          <SlidersHorizontal size={12} />
          {catFilter
            ? CATEGORIES.find(c => c.id === catFilter)?.label || 'Category'
            : 'Category'}
          {catFilter && (
            <span
              onClick={e => { e.stopPropagation(); setCatFilter('') }}
              className="ml-0.5"
            >
              <X size={11} />
            </span>
          )}
        </button>
      </div>

      {/* ── Category picker ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showCats && (
          <motion.div
            initial={{ opacity:0, y:-6 }}
            animate={{ opacity:1, y:0 }}
            exit={{ opacity:0, y:-6 }}
            transition={{ duration:0.15 }}
            className="card mb-4 p-3 grid grid-cols-3 gap-2"
          >
            {CATEGORIES.map(c => (
              <button
                key={c.id}
                onClick={() => { setCatFilter(catFilter === c.id ? '' : c.id); setShowCats(false) }}
                className={`px-2 py-1.5 rounded-chip text-[11px] font-semibold text-center
                            border transition-colors
                            ${catFilter === c.id
                              ? 'bg-brand-container text-brand-on border-brand-container'
                              : 'bg-kosha-surface text-ink-3 border-kosha-border'}`}
              >
                {c.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Transaction groups ───────────────────────────────────────── */}
      <div className="space-y-4 pb-32">
        {groups.map(([dateKey, txns]) => {
          const net = groupNet(txns)
          return (
            <div key={dateKey} className="list-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5
                              border-b border-kosha-border bg-kosha-surface-2">
                <span className="text-caption font-semibold text-ink-3 uppercase tracking-wide">
                  {dateLabel(dateKey)}
                </span>
                <span className={`text-caption font-semibold
                  ${net >= 0 ? 'text-income-text' : 'text-expense-text'}`}>
                  {net >= 0 ? '+' : ''}{fmt(net)}
                </span>
              </div>
              {txns.map((t, i) => (
                <TransactionItem
                  key={t.id} txn={t}
                  onDelete={handleDelete}
                  onTap={handleTap}
                  isLast={i === txns.length - 1}
                />
              ))}
            </div>
          )
        })}
      </div>

      {/* Load more */}
      {hasMore && (
        <button
          onClick={() => setDisplayCount(n => n + 50)}
          className="w-full py-3 text-label font-semibold text-brand text-center
                     bg-kosha-surface border border-kosha-border rounded-card mt-2"
        >
          Show more ({data.length - displayCount} remaining)
        </button>
      )}

      {/* ── Error toast ─────────────────────────────────────────────── */}
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
        <Plus size={28} weight="bold" color="white" />
      </button>

      <AddTransactionSheet
        open={showAdd}
        onClose={() => { setShowAdd(false); setEditTxn(null) }}
        editTxn={editTxn}
        initialType={addType}
        onSaved={(payload) => {
          if (payload.id) {
            pendingEditId.current = payload.id
            applyLocalEdit(payload.id, payload)
          } else {
            prependOptimistic(payload)
            addOptimisticTxn(payload)
            setDisplayCount(n => n + 1)
          }
        }}
        onConfirmed={async () => {
          await refetch()
          if (pendingEditId.current) {
            clearLocalEdit(pendingEditId.current)
            pendingEditId.current = null
          }
        }}
        onFailed={(msg) => {
          if (pendingEditId.current) {
            clearLocalEdit(pendingEditId.current)
            pendingEditId.current = null
          }
          clearOptimisticTxns()
          refetch()
          setToast(msg)
          setTimeout(() => setToast(null), 4000)
        }}
      />
      <DeleteDialog
        open={!!delId} label="this transaction"
        onConfirm={confirmDelete} onCancel={() => setDelId(null)}
      />
    </div>
  )
}
