import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, SlidersHorizontal } from 'lucide-react'
import { useTransactions, deleteTransaction, useDebounce } from '../hooks/useTransactions'
import TransactionItem from '../components/TransactionItem'
import AddTransactionSheet from '../components/AddTransactionSheet'
import { CATEGORIES } from '../lib/categories'
import { supabase } from '../lib/supabase'
import { groupByDate, dateLabel, fmt } from '../lib/utils'
import { Plus, DownloadSimple } from '@phosphor-icons/react'
import PageHeader from '../components/PageHeader'

const TYPES = [
  { id: 'all', label: 'All' },
  { id: 'expense', label: 'Expenses' },
  { id: 'income', label: 'Income' },
  { id: 'investment', label: 'Invest' },
]

const TYPE_CHIP = {
  all: 'bg-brand-container text-brand-on border-brand-container',
  expense: 'bg-expense-bg text-expense-text border-expense-border',
  income: 'bg-income-bg text-income-text border-income-border',
  investment: 'bg-invest-bg text-invest-text border-invest-border',
}

function groupNet(txns) {
  return txns.reduce((s, t) =>
    t.type === 'income' ? s + +t.amount : s - +t.amount, 0)
}

export default function Transactions() {
  const [typeFilter, setTypeFilter] = useState('all')
  const [catFilter, setCatFilter] = useState('')
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editTxn, setEditTxn] = useState(null)
  const [showCats, setShowCats] = useState(false)
  const [addType, setAddType] = useState('expense')
  const [displayCount, setDisplayCount] = useState(50)
  const [toast, setToast] = useState(null)
  const [duplicateTxn, setDuplicateTxn] = useState(null)

  const debouncedSearch = useDebounce(search, 300)
  useEffect(() => { setDisplayCount(50) }, [typeFilter, catFilter, debouncedSearch])

  const { data, total } = useTransactions({
    type: typeFilter === 'all' ? undefined : typeFilter,
    category: catFilter || undefined,
    search: debouncedSearch || undefined,
    limit: displayCount,
    withCount: true,
  })

  const groups = useMemo(() => groupByDate(data), [data])
  const hasMore = useMemo(() => total > data.length, [total, data.length])
  const filterCount = (catFilter ? 1 : 0) + (typeFilter !== 'all' ? 1 : 0)

  const handleDelete = useCallback(async (id) => {
    if (!id) return
    try {
      await deleteTransaction(id)
    } catch (e) {
      setToast(e.message || 'Could not delete transaction.')
      setTimeout(() => setToast(null), 4000)
      throw e  // re-throw so TransactionItem resets its loading state
    }
  }, [])
  const handleTap = useCallback((t) => {
    setEditTxn(t)
    setAddType(t.type)
    setShowAdd(true)
  }, [])

  const handleDuplicate = useCallback((txn) => {
    setEditTxn(null)
    setDuplicateTxn(txn)
    setAddType(txn.type)
    setShowAdd(true)
  }, [])

  const exportCSV = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const userId = session?.user?.id
      if (!userId) throw new Error('Not signed in')

      let q = supabase
        .from('transactions')
        .select('date, type, description, amount, category, investment_vehicle, payment_mode, notes')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

      if (typeFilter !== 'all') q = q.eq('type', typeFilter)
      if (catFilter) q = q.eq('category', catFilter)
      if (debouncedSearch) q = q.ilike('description', `%${debouncedSearch}%`)

      const { data: exportRows, error } = await q
      if (error) throw error
      if (!exportRows?.length) return

      const CATEGORY_LABELS = Object.fromEntries(
        CATEGORIES.map(c => [c.id, c.label])
      )
      const headers = ['Date', 'Type', 'Description', 'Amount', 'Category', 'Investment Vehicle', 'Payment Mode', 'Notes']
      const rows = exportRows.map(t => [
        t.date,
        t.type,
        `"${(t.description || '').replace(/"/g, '""')}"`,
        t.amount,
        CATEGORY_LABELS[t.category] || t.category || '',
        t.investment_vehicle || '',
        t.payment_mode || '',
        `"${(t.notes || '').replace(/"/g, '""')}"`,
      ])

      const csv = [headers, ...rows].map(r => r.join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const filters = [
        typeFilter !== 'all' ? typeFilter : '',
        catFilter ? (CATEGORY_LABELS[catFilter] || catFilter) : '',
      ].filter(Boolean).join('-')
      a.href = url
      a.download = `kosha-${filters || 'transactions'}-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      setToast(e.message || 'Could not export transactions.')
      setTimeout(() => setToast(null), 4000)
    }
  }, [typeFilter, catFilter, debouncedSearch])

  return (
    <div className="page">
      <PageHeader title="Transactions" />

      {/* ── Header ───────────────────────────────────────────────────── */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-caption text-ink-3">
            {total > 0 ? `${total} transaction${total !== 1 ? 's' : ''}` : 'No results'}
            {(typeFilter !== 'all' || catFilter) ? ' (filtered)' : ''}
          </p>
        </div>
        {total > 0 && (
          <button
            onClick={exportCSV}
            title="Export CSV"
            className="w-9 h-9 rounded-full bg-kosha-surface border border-kosha-border
                 flex items-center justify-center active:bg-kosha-surface-2
                 transition-colors shrink-0"
          >
            <DownloadSimple size={16} className="text-ink-2" />
          </button>
        )}
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
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
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
      <div className="space-y-4">
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
                  onDuplicate={handleDuplicate}
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
          Show more ({total - data.length} remaining)
        </button>
      )}

      {/* ── Error toast ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-32 left-4 right-4 md:left-[236px] md:bottom-8 z-50 flex items-center gap-3 bg-ink text-white px-4 py-3 rounded-card shadow-card-lg"
          >
            <span className="text-[13px] font-medium flex-1">{toast}</span>
            <button onClick={() => setToast(null)}
              className="text-white opacity-60 text-xs font-semibold">Dismiss</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB */}
      <button className="fab" onClick={() => { setEditTxn(null); setAddType('expense'); setShowAdd(true) }}>
        <Plus size={24} weight="bold" color="white" />
      </button>

      <AddTransactionSheet
        open={showAdd}
        duplicateTxn={duplicateTxn}
        onClose={() => { setShowAdd(false); setEditTxn(null); setDuplicateTxn(null) }}
        editTxn={editTxn}
        initialType={addType}
      />
    </div>
  )
}
