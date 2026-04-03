import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, SlidersHorizontal, Plus, Download, BookOpen, ArrowRight, CheckCircle2 } from 'lucide-react'
import {
  useTransactions,
  removeTransactionMutation,
  useDebounce,
} from '../hooks/useTransactions'
import TransactionItem from '../components/transactions/TransactionItem'
import AddTransactionSheet from '../components/transactions/AddTransactionSheet'
import EmptyState from '../components/common/EmptyState'
import FilterRow from '../components/common/FilterRow'
import AppToast from '../components/common/AppToast'
import { CATEGORIES, getCategoriesForType } from '../lib/categories'
import { supabase } from '../lib/supabase'
import { groupByDate, dateLabel, fmt } from '../lib/utils'
import { downloadCsv, toCsv } from '../lib/csv'
import PageHeader from '../components/layout/PageHeader'
import SectionHeader from '../components/common/SectionHeader'
import { getAuthUserId } from '../lib/authStore'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import SkeletonLayout from '../components/common/SkeletonLayout'
import { transitionBase } from '../lib/animations'

const TXN_GUIDE_HINT_KEY = 'kosha:dismiss-guide-transactions-v1'

const TYPES = [
  { id: 'all',        label: 'All'      },
  { id: 'expense',    label: 'Expenses' },
  { id: 'income',     label: 'Income'   },
  { id: 'investment', label: 'Invest'   },
]

const DATE_PRESETS = [
  { id: 'all', label: 'All time' },
  { id: '7d', label: 'Last 7d' },
  { id: 'month', label: 'This month' },
  { id: 'prev-month', label: 'Last month' },
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
  const navigate = useNavigate()
  const location = useLocation()
  const [typeFilter,    setTypeFilter]    = useState('all')
  const [catFilter,     setCatFilter]     = useState('')
  const [search,        setSearch]        = useState('')
  const [showAdd,       setShowAdd]       = useState(false)
  const [editTxn,       setEditTxn]       = useState(null)
  const [showCats,      setShowCats]      = useState(false)
  const [addType,       setAddType]       = useState('expense')
  const [datePreset,    setDatePreset]    = useState('all')
  const [displayCount,  setDisplayCount]  = useState(50)
  const [toast,         setToast]         = useState(null)
  const [duplicateTxn,  setDuplicateTxn]  = useState(null)
  const [highlightedTxnId, setHighlightedTxnId] = useState(null)
  const [showGuideHint, setShowGuideHint] = useState(true)
  const [searchParams, setSearchParams] = useSearchParams()

  const debouncedSearch = useDebounce(search, 300)
  const { startDate, endDate } = useMemo(() => {
    const now = new Date()
    const toISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

    if (datePreset === '7d') {
      const start = new Date(now)
      start.setDate(now.getDate() - 6)
      return { startDate: toISO(start), endDate: toISO(now) }
    }

    if (datePreset === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return { startDate: toISO(start), endDate: toISO(end) }
    }

    if (datePreset === 'prev-month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      return { startDate: toISO(start), endDate: toISO(end) }
    }

    return { startDate: undefined, endDate: undefined }
  }, [datePreset])
  const filterCategories = useMemo(
    () => getCategoriesForType(typeFilter === 'all' ? undefined : typeFilter),
    [typeFilter]
  )

  // FIX (defect 5.2): Replaced the useEffect that called setDisplayCount(50)
  // when debouncedSearch/typeFilter/catFilter changed. That caused a triple
  // render cascade per search keystroke:
  //   render 1 → search changes
  //   render 2 → debouncedSearch updates (from useDebounce's internal effect)
  //   render 3 → setDisplayCount(50) from useEffect fires
  //
  // Fix: pass displayCount into the query key directly. When typeFilter or
  // catFilter changes, reset displayCount in the same event handler that
  // updates the filter — one state update, one render. Search keystrokes
  // only trigger the debounce timer and then one re-render when it fires.
  // No useEffect needed.

  function handleTypeFilter(id) {
    setTypeFilter(id)
    const nextCategories = getCategoriesForType(id === 'all' ? undefined : id)
    const isCurrentCategoryAllowed = !catFilter || nextCategories.some((cat) => cat.id === catFilter)
    if (!isCurrentCategoryAllowed) setCatFilter('')
    setDisplayCount(50)   // reset in same event — single re-render
  }

  function handleCatFilter(id) {
    setCatFilter(id)
    setDisplayCount(50)   // reset in same event — single re-render
  }

  const { data, total, loading: txnLoading } = useTransactions({
    type:      typeFilter === 'all' ? undefined : typeFilter,
    category:  catFilter || undefined,
    search:    debouncedSearch || undefined,
    startDate,
    endDate,
    limit:     displayCount,
    withCount: true,
  })

  const groups = useMemo(() => {
    const grouped = groupByDate(data)
    return grouped.map(([dateKey, txns]) => [dateKey, txns, groupNet(txns)])
  }, [data])
  const hasMore = useMemo(() => total > data.length, [total, data.length])
  const focusTxnId = searchParams.get('focus')
  const hasActiveFilters = typeFilter !== 'all' || !!catFilter || datePreset !== 'all' || !!debouncedSearch
  const activeDatePresetLabel = useMemo(
    () => DATE_PRESETS.find((preset) => preset.id === datePreset)?.label || 'All time',
    [datePreset]
  )
  const visibleSummary = useMemo(() => {
    return data.reduce((acc, txn) => {
      const amount = Number(txn?.amount || 0)
      if (!Number.isFinite(amount) || amount <= 0) return acc

      if (txn.type === 'income') {
        acc.income += amount
        acc.net += amount
      } else {
        acc.outflow += amount
        acc.net -= amount
      }
      return acc
    }, { income: 0, outflow: 0, net: 0 })
  }, [data])

  useEffect(() => {
    try {
      const hidden = localStorage.getItem(TXN_GUIDE_HINT_KEY) === '1'
      if (hidden) setShowGuideHint(false)
    } catch {
      // no-op
    }
  }, [])

  const focusExpandCountRef = useRef(0)

  useEffect(() => {
    if (!focusTxnId) return
    focusExpandCountRef.current = 0
  }, [focusTxnId])

  useEffect(() => {
    if (!focusTxnId) return

    const found = data.find(t => t.id === focusTxnId)
    if (!found) {
      if (hasMore && focusExpandCountRef.current < 10) {
        focusExpandCountRef.current += 1
        setDisplayCount(n => n + 100)
      }
      return
    }

    setHighlightedTxnId(focusTxnId)
    setTimeout(() => {
      const el = document.getElementById(`txn-${focusTxnId}`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 40)

    const timeoutId = setTimeout(() => setHighlightedTxnId(null), 2400)

    const next = new URLSearchParams(searchParams)
    next.delete('focus')
    setSearchParams(next, { replace: true })

    return () => clearTimeout(timeoutId)
  }, [focusTxnId, data, hasMore, searchParams, setSearchParams])

  const handleDelete = useCallback(async (id) => {
    if (!id) return
    try {
      await removeTransactionMutation(id)
    } catch (e) {
      setToast(e.message || 'Could not delete transaction.')
      setTimeout(() => setToast(null), 4000)
    }
  }, [])

  const handleTap = useCallback((t) => {
    setEditTxn(t)
    setDuplicateTxn(null)
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
      const userId = getAuthUserId()
      let q = supabase
        .from('transactions')
        .select('date, type, description, amount, category, investment_vehicle, payment_mode, notes, is_recurring, recurrence, is_auto_generated, source_transaction_id')
        .eq('user_id', userId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })

      if (typeFilter !== 'all') q = q.eq('type', typeFilter)
      if (catFilter)            q = q.eq('category', catFilter)
      if (debouncedSearch)      q = q.ilike('description', `%${debouncedSearch}%`)
      if (startDate)            q = q.gte('date', startDate)
      if (endDate)              q = q.lte('date', endDate)

      const { data: exportRows, error } = await q
      if (error) throw error
      if (!exportRows?.length) {
        setToast('No transactions to export for current filters.')
        setTimeout(() => setToast(null), 3000)
        return
      }

      const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map(c => [c.id, c.label]))
      const headers = [
        'Date',
        'Type',
        'Description',
        'Amount',
        'Category',
        'Investment Vehicle',
        'Payment Mode',
        'Notes',
        'Is Recurring',
        'Recurrence',
        'Auto Generated',
        'Source Transaction ID',
      ]
      const rows = exportRows.map(t => [
        t.date,
        t.type,
        t.description || '',
        t.amount,
        CATEGORY_LABELS[t.category] || t.category || '',
        t.investment_vehicle || '',
        t.payment_mode || '',
        t.notes || '',
        t.is_recurring ? 'yes' : 'no',
        t.recurrence || '',
        t.is_auto_generated ? 'yes' : 'no',
        t.source_transaction_id || '',
      ])

      const csv = toCsv(headers, rows)
      const filters = [
        typeFilter !== 'all' ? typeFilter : '',
        catFilter  ? (CATEGORY_LABELS[catFilter] || catFilter) : '',
      ].filter(Boolean).join('-')

      downloadCsv(
        `kosha-${filters || 'transactions'}-${new Date().toISOString().slice(0, 10)}.csv`,
        csv
      )
    } catch (e) {
      setToast(e.message || 'Could not export transactions.')
      setTimeout(() => setToast(null), 4000)
    }
  }, [typeFilter, catFilter, debouncedSearch, startDate, endDate])

  const dismissGuideHint = useCallback(() => {
    setShowGuideHint(false)
    try {
      localStorage.setItem(TXN_GUIDE_HINT_KEY, '1')
    } catch {
      // no-op
    }
  }, [])

  const clearAllFilters = useCallback(() => {
    setTypeFilter('all')
    setCatFilter('')
    setDatePreset('all')
    setSearch('')
    setShowCats(false)
    setDisplayCount(50)
  }, [])

  useEffect(() => {
    if (!location.state?.openAddInvestment) return

    setEditTxn(null)
    setDuplicateTxn(null)
    setAddType('investment')
    setShowAdd(true)

    navigate(`${location.pathname}${location.search}`, { replace: true, state: null })
  }, [location.state, location.pathname, location.search, navigate])

  return (
    <div className="page">
      <PageHeader title="Transactions" className="mb-3" />

      <div className="card p-4 mb-3">
        <SectionHeader
          title="Transaction workspace"
          subtitle="Track timeline health, then drill into rows with filters."
          badge={{
            label: hasActiveFilters ? 'Filtered view' : 'Full timeline',
            className: hasActiveFilters ? 'bg-brand-container text-brand-on' : 'bg-kosha-surface-2 text-ink-2',
          }}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-2.5">
          <div className="mini-panel p-3">
            <p className="text-caption text-ink-3">Results</p>
            <p className="text-sm font-bold tabular-nums text-ink-2">
              {data.length}/{total}
            </p>
            <p className="text-[10px] text-ink-3 mt-0.5">Loaded rows / matching rows</p>
          </div>
          <div className="mini-panel p-3">
            <p className="text-caption text-ink-3">Date window</p>
            <p className="text-sm font-bold tabular-nums text-ink-2">{activeDatePresetLabel}</p>
            <p className="text-[10px] text-ink-3 mt-0.5">Current timeline range</p>
          </div>
          <div className="mini-panel p-3">
            <p className="text-caption text-ink-3">Loaded net flow</p>
            <p className={`text-sm font-bold tabular-nums ${visibleSummary.net >= 0 ? 'text-income-text' : 'text-expense-text'}`}>
              {visibleSummary.net >= 0 ? '+' : '-'}{fmt(Math.abs(visibleSummary.net))}
            </p>
            <p className="text-[10px] text-ink-3 mt-0.5">Income {fmt(visibleSummary.income)} | Outflow {fmt(visibleSummary.outflow)}</p>
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setEditTxn(null)
              setDuplicateTxn(null)
              setAddType('expense')
              setShowAdd(true)
            }}
            className="btn-secondary h-9 px-3 text-[11px]"
          >
            <Plus size={14} className="mr-1" />
            Add transaction
          </button>

          {total > 0 ? (
            <button
              type="button"
              onClick={exportCSV}
              className="btn-secondary h-9 px-3 text-[11px]"
            >
              <Download size={14} className="mr-1" />
              Export CSV
            </button>
          ) : null}

          {hasActiveFilters ? (
            <button
              type="button"
              onClick={clearAllFilters}
              className="chip-control chip-control-sm bg-kosha-surface text-ink-2 border-kosha-border hover:bg-kosha-surface-2"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      <div className="card p-4 mb-3">
        <SectionHeader
          title="Find and filter"
          subtitle="Search by description, then narrow by date, type, and category."
        />

        <div className="relative mt-2.5">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
          <input
            className="input pl-8 pr-8 py-2 md:py-2.5 text-[14px]"
            placeholder="Search transactions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <FilterRow className="mt-2.5">
          {DATE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                setDatePreset(preset.id)
                setDisplayCount(50)
              }}
              className={`chip-control chip-control-sm ${
                datePreset === preset.id
                  ? 'bg-brand-container text-brand-on border-brand-container'
                  : 'bg-kosha-surface text-ink-3 border-kosha-border hover:bg-kosha-surface-2'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </FilterRow>

        <FilterRow className="mt-2.5">
          {TYPES.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTypeFilter(t.id)}
              className={`chip-control chip-control-sm ${typeFilter === t.id
                ? TYPE_CHIP[t.id]
                : 'bg-kosha-surface text-ink-3 border-kosha-border hover:bg-kosha-surface-2'}`}
            >
              {t.label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setShowCats(v => !v)}
            className={`chip-control chip-control-sm ${catFilter
              ? 'bg-brand-container text-brand-on border-brand-container'
              : 'bg-kosha-surface text-ink-3 border-kosha-border hover:bg-kosha-surface-2'}`}
          >
            <SlidersHorizontal size={11} />
            {catFilter ? CATEGORIES.find(c => c.id === catFilter)?.label || 'Category' : 'Category'}
          </button>

          {catFilter ? (
            <button
              type="button"
              onClick={() => handleCatFilter('')}
              className="chip-control chip-control-sm bg-kosha-surface text-ink-2 border-kosha-border hover:bg-kosha-surface-2"
            >
              Clear category
            </button>
          ) : null}
        </FilterRow>

        <AnimatePresence>
          {showCats && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={transitionBase}
              className="mt-2.5 card p-2.5 flex flex-wrap gap-2"
            >
              {filterCategories.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    handleCatFilter(catFilter === c.id ? '' : c.id)
                    setShowCats(false)
                  }}
                  className={`chip-control chip-control-sm ${catFilter === c.id
                    ? 'bg-brand-container text-brand-on border-brand-container'
                    : 'bg-kosha-surface text-ink-3 border-kosha-border hover:bg-kosha-surface-2'}`}
                >
                  {c.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {showGuideHint && (
        <div className="card mb-4 p-4 border border-brand-border bg-brand-container/40">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-container flex items-center justify-center shrink-0">
              <BookOpen size={16} className="text-brand" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-body font-semibold text-ink">Transactions tips</p>
              <p className="text-label text-ink-3 mt-0.5">Use consistent categories and recurring labels for cleaner analytics.</p>
              <button
                onClick={() => navigate('/guide')}
                className="text-label font-semibold text-brand mt-2 inline-flex items-center gap-1"
              >
                Open guide <ArrowRight size={13} />
              </button>
            </div>
            <button onClick={dismissGuideHint} className="text-ink-4 hover:text-ink-2 transition-colors" aria-label="Dismiss transactions hint">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      <div className="mb-2.5">
        <SectionHeader
          title="Timeline"
          subtitle={hasActiveFilters ? 'Filtered rows grouped by date.' : 'Latest activity grouped by date.'}
          rightText={`${data.length} loaded`}
        />
      </div>

      {/* Transaction groups */}
      {txnLoading && data.length === 0 ? (
        <SkeletonLayout
          className="space-y-3"
          sections={[
            { type: 'block', height: 'h-[280px]' },
            { type: 'block', height: 'h-[200px]' },
            { type: 'block', height: 'h-[160px]' },
          ]}
        />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 size={24} className="text-brand" />}
          title={hasActiveFilters ? 'No transactions match these filters' : 'No transactions yet'}
          description={
            hasActiveFilters
              ? 'Try broadening your filters or clearing search to see more results.'
              : 'Start by adding your first transaction to build your timeline and insights.'
          }
          actionLabel={hasActiveFilters ? 'Clear filters' : 'Add transaction'}
          onAction={hasActiveFilters
            ? clearAllFilters
            : () => {
                setEditTxn(null)
                setAddType('expense')
                setShowAdd(true)
              }}
        />
      ) : (
        <div className="space-y-3.5">
          {groups.map(([dateKey, txns, net]) => (
            <div key={dateKey} className="list-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3
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
                  isHighlighted={highlightedTxnId === t.id}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {hasMore && (
        <button
          onClick={() => setDisplayCount(n => n + 50)}
          className="w-full py-3.5 text-label font-semibold text-brand text-center
                     card mt-4"
        >
          Show more ({total - data.length} remaining)
        </button>
      )}

      <AppToast message={toast} onDismiss={() => setToast(null)} />

      <button className="fab" onClick={() => { setEditTxn(null); setAddType('expense'); setShowAdd(true) }}>
        <Plus size={24} className="text-white" />
      </button>

      <AddTransactionSheet
        open={showAdd}
        duplicateTxn={duplicateTxn}
        onClose={() => { setShowAdd(false); setDuplicateTxn(null) }}
        editTxn={editTxn}
        initialType={addType}
      />
    </div>
  )
}
