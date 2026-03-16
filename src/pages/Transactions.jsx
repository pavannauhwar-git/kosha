import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, SlidersHorizontal } from 'lucide-react'
import { useTransactions, registerPrefetch, deleteTransaction, useDebounce } from '../hooks/useTransactions'
import TransactionItem     from '../components/TransactionItem'
import AddTransactionSheet from '../components/AddTransactionSheet'
import DeleteDialog        from '../components/DeleteDialog'
import { CATEGORIES }      from '../lib/categories'
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
  const [toast,      setToast]      = useState(null)

  // Render pagination: show 50 rows initially, more on demand.
  // All data is loaded (from cache), we just control how many we render.
  // This keeps initial render fast even with 374 transactions.
  const [displayCount, setDisplayCount] = useState(50)

  // Debounce search: only fire a Supabase query 300ms after the user stops
  // typing — prevents a round-trip per keystroke (was 6 queries for "Swiggy")
  // IMPORTANT: debouncedSearch must be declared BEFORE the useEffect that
  // uses it as a dependency — const/let are not hoisted like var.
  const debouncedSearch = useDebounce(search, 300)

  // Reset display window when filters change so user sees top of filtered results
  useEffect(() => { setDisplayCount(50) }, [typeFilter, catFilter, debouncedSearch])

  const { data, refetch, prependOptimistic, replaceOptimistic, removeOptimistic } = useTransactions({
    type:     typeFilter === 'all' ? undefined : typeFilter,
    category: catFilter  || undefined,
    search:   debouncedSearch || undefined,
  })

  // Only group the rows we're actually rendering — avoids processing 374 items for 50 visible
  const visibleData = data.slice(0, displayCount)
  const groups      = groupByDate(visibleData)
  const hasMore     = data.length > displayCount

  // Active filter count for filter button badge
  const filterCount = (catFilter ? 1 : 0) + (typeFilter !== 'all' ? 1 : 0)

  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }, [])

  // ── Delete: remove row instantly, sync in background ─────────────────
  // The old pattern awaited deleteTransaction() before touching the UI —
  // that's what caused the ~10s delay. Now we remove optimistically first,
  // fire the network call in the background, and only rollback on failure.
  const confirmDelete = useCallback(async () => {
    const id = delId
    setDelId(null)
    removeOptimistic(id)              // ← instant: row disappears immediately
    try {
      await deleteTransaction(id)
      refetch()                       // ← quiet background sync to confirm
    } catch {
      refetch()                       // ← rollback: row reappears from server
      showToast('Could not delete. Check your connection.')
    }
  }, [delId, removeOptimistic, refetch, showToast])

  // Stable callbacks for TransactionItem memo
  const handleDelete = useCallback((id) => setDelId(id), [])
  const handleTap    = useCallback((t) => {
    setEditTxn(t)
    setAddType(t.type)
    setShowAdd(true)
  }, [])

  return (
    <div className="page">

      {/* ── Header with live count ────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-4 pt-2">
        <div>
          <h1 className="font-display text-display text-ink">Transactions</h1>
          <p className="text-caption text-ink-3 mt-0.5">
            {data.length > 0 ? `${data.length} transaction${data.length !== 1 ? 's' : ''}` : 'No results'}
            {(typeFilter !== 'all' || catFilter) ? ' · filtered' : ''}
          </p>
        </div>
        {(typeFilter !== 'all' || catFilter) && (
          <button
            onClick={() => { setTypeFilter('all'); setCatFilter(''); setShowCats(false) }}
            className="mt-1 text-caption font-semibold text-brand"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* ── Search + filter button ────────────────────────────────────── */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
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
        {/* Filter button — opens category panel */}
        <button
          onClick={() => setShowCats(v => !v)}
          className={`relative w-[46px] h-[46px] rounded-card flex items-center justify-center
                      shrink-0 transition-all
                      ${showCats || filterCount > 0
                        ? 'bg-brand-container text-brand border border-brand-container'
                        : 'bg-kosha-surface text-ink-2 border border-kosha-border'}`}
        >
          <SlidersHorizontal size={18} />
          {filterCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand rounded-full
                             text-white text-[9px] font-bold flex items-center justify-center">
              {filterCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Type filter chips ─────────────────────────────────────────── */}
      <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar">
        {TYPES.map(t => (
          <button key={t.id}
            onClick={() => setTypeFilter(t.id)}
            className={`px-3 py-1.5 rounded-pill text-xs font-semibold border shrink-0 transition-all
              ${typeFilter === t.id ? TYPE_CHIP[t.id] : 'bg-kosha-surface text-ink-2 border-kosha-border'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Category filter panel ─────────────────────────────────────── */}
      <AnimatePresence>
        {showCats && (
          <motion.div
            initial={{ opacity:0, height:0 }}
            animate={{ opacity:1, height:'auto' }}
            exit={{ opacity:0, height:0 }}
            transition={{ duration:0.18 }}
            className="overflow-hidden mb-3"
          >
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              <button
                onClick={() => { setCatFilter(''); setShowCats(false) }}
                className={`px-3 py-1.5 rounded-pill text-xs font-semibold border shrink-0 transition-all
                  ${!catFilter
                    ? 'bg-brand-container text-brand-on border-brand-container'
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

      {/* ── Transaction groups ────────────────────────────────────────── */}
      <div className="space-y-3">
        {groups.length === 0 && (
          <div className="card p-8 text-center mt-4">
            <p className="text-ink-2 text-sm">No transactions found.</p>
            {search && <p className="text-ink-3 text-xs mt-1">Try a different search term.</p>}
          </div>
        )}
        {groups.map(([date, txns]) => {
          const net = groupNet(txns)
          return (
            <div key={date} className="list-card">
              {/* Date group header — tinted, with net amount */}
              <div className="flex items-center justify-between px-4 py-2 bg-kosha-surface-2
                              border-b border-kosha-border">
                <span className="text-caption font-semibold text-ink-3">
                  {dateLabel(date)}
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

      {/* Load more — instant, no network, just renders more from cached data */}
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
        open={showAdd} onClose={() => { setShowAdd(false); setEditTxn(null) }}
        editTxn={editTxn} initialType={addType}
        onSaved={(payload) => {
          if (editTxn) {
            // Edit: swap the existing row in-place instantly
            replaceOptimistic(editTxn.id, payload)
          } else {
            // Add: prepend the new row instantly
            prependOptimistic(payload)
            setDisplayCount(n => n + 1)  // ensure the new row is within the render window
          }
        }}
        onConfirmed={refetch}
        onFailed={(msg) => {
          refetch()
          showToast(msg)
        }}
      />
      <DeleteDialog
        open={!!delId} label="this transaction"
        onConfirm={confirmDelete} onCancel={() => setDelId(null)}
      />
    </div>
  )
}
