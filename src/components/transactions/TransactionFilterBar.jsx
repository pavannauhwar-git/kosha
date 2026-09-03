import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MagnifyingGlass, X, Faders, Plus, BookOpen, CircleNotch } from '@phosphor-icons/react'
import Input from '../ui/Input'
import Select from '../ui/Select'
import FilterRow from '../common/FilterRow'
import SectionHeader from '../common/SectionHeader'
import { PAYMENT_MODES } from '../../lib/categories'
import { MONTH_SHORT } from '../../lib/constants'
import { formatMonthInputLabel, monthInputFromDate } from '../../lib/dateUtils'

export const TYPES = [
  { id: 'all', label: 'All' },
  { id: 'expense', label: 'Expenses' },
  { id: 'income', label: 'Income' },
  { id: 'investment', label: 'Invest' },
]

export const DATE_PRESETS = [
  { id: 'all', label: 'All time' },
  { id: '7d', label: 'Last 7d' },
  { id: 'month', label: 'This month' },
  { id: 'prev-month', label: 'Last month' },
  { id: 'custom-month', label: 'Specific month' },
]

export const TYPE_CHIP = {
  all: 'bg-brand text-brand-on border-brand',
  expense: 'bg-expense-bg text-expense-text border-expense-border',
  income: 'bg-income-bg text-income-text border-income-border',
  investment: 'bg-invest-bg text-invest-text border-invest-border',
}

export default function TransactionFilterBar({
  search,
  setSearch,
  isSearchDebouncing,
  linkedLoanFilter,
  linkedBillFilter,
  linkedSplitExpenseFilter,
  linkedSplitSettlementFilter,
  clearLinkedFilters,
  total,
  
  datePreset,
  handleDatePreset,
  selectedMonth,
  selectedMonthParts,
  updateSelectedMonth,
  monthFilterYearOptions,
  setDisplayCount,

  typeFilter,
  handleTypeFilter,
  catFilter,
  handleCatFilter,
  getCategoryLabel,
  
  paymentModeFilter,
  handlePaymentModeFilter,
  getPaymentModeLabel,
  
  setShowCreateCategory,
  filterCategories,
}) {
  const [showCats, setShowCats] = useState(false)
  const [showPaymentModes, setShowPaymentModes] = useState(false)
  const categoryPanelRef = useRef(null)
  const paymentPanelRef = useRef(null)
  const categoryTriggerRef = useRef(null)
  const paymentTriggerRef = useRef(null)

  useEffect(() => {
    if (!showCats && !showPaymentModes) return

    function handlePointerDown(event) {
      const target = event.target
      if (!(target instanceof Node)) return

      const insideCategory =
        categoryPanelRef.current?.contains(target) ||
        categoryTriggerRef.current?.contains(target)
      const insidePayment =
        paymentPanelRef.current?.contains(target) ||
        paymentTriggerRef.current?.contains(target)

      if (!insideCategory && !insidePayment) {
        setShowCats(false)
        setShowPaymentModes(false)
      }
    }

    function handleEscape(event) {
      if (event.key !== 'Escape') return
      setShowCats(false)
      setShowPaymentModes(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [showCats, showPaymentModes])

  return (
    <>
      <div className="px-4 pt-3.5 pb-3 border-b border-kosha-border bg-kosha-surface-2">
        <p className="text-[15px] font-semibold text-ink">Find and filter</p>
        <p className="text-[12px] text-ink-3 mt-0.5">Search by merchant or note, then narrow by date, type, category, and payment mode.</p>

        {(linkedLoanFilter || linkedBillFilter || linkedSplitExpenseFilter || linkedSplitSettlementFilter) && (
          <div className="mt-3 flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-pill bg-brand-container text-brand border border-brand/20">
              <BookOpen size={13} className="shrink-0" />
              <span className="text-[11px] font-semibold">
                {linkedLoanFilter ? 'Loan history' :
                  linkedBillFilter ? 'Bill history' :
                    linkedSplitExpenseFilter ? 'Split expense' :
                      'Split settlement'}
              </span>
              {total > 0 && (
                <span className="text-[10px] opacity-60 font-medium tabular-nums">· {total} records</span>
              )}
              <button
                onClick={clearLinkedFilters}
                className="ml-0.5 p-0.5 hover:bg-brand/10 rounded-full transition-colors flex items-center justify-center"
                title="Clear linked filter"
              >
                <X size={12} weight="bold" />
              </button>
            </div>
          </div>
        )}

        <div className="mt-3">
          <Input
            name="transaction-search"
            placeholder="Search transactions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            icon={<MagnifyingGlass size={14} className="text-ink-3 pointer-events-none" />}
            iconRight={
              isSearchDebouncing ? (
                <CircleNotch size={13} className="text-ink-3 animate-spin" />
              ) : search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="text-ink-3"
                >
                  <X size={13} />
                </button>
              ) : null
            }
          />
        </div>

        {isSearchDebouncing && (
          <p className="text-[11px] text-ink-3 mt-1.5">Updating results…</p>
        )}
      </div>

      <div className="px-4 py-3.5 space-y-2.5">
        <SectionHeader
          title="Date window"
          subtitle="Set the time horizon for visible transaction rows."
        />
        <FilterRow>
          {DATE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleDatePreset(preset.id)}
              className={`chip-control chip-control-sm ${datePreset === preset.id
                ? 'bg-brand text-brand-on border-brand'
                : 'bg-kosha-surface text-ink-3 border-kosha-border hover:bg-kosha-surface-2'
                }`}
            >
              {preset.label}
            </button>
          ))}
        </FilterRow>

        <AnimatePresence>
          {datePreset === 'custom-month' && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="mini-panel p-3"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-[11px] uppercase tracking-wide text-ink-3">Choose month</p>
                <button
                  type="button"
                  onClick={() => {
                    const current = monthInputFromDate()
                    updateSelectedMonth(current.split('-')[0], current.split('-')[1])
                    setDisplayCount(50)
                  }}
                  className="chip-control chip-control-sm bg-kosha-surface text-ink-2 border-kosha-border hover:bg-kosha-surface-2"
                >
                  Current month
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-2">
                <Select
                  name="transactions-month-filter-month"
                  value={selectedMonthParts.month}
                  onChange={(event) => updateSelectedMonth(selectedMonthParts.year, event.target.value)}
                  options={MONTH_SHORT.map((monthLabel, index) => ({
                    value: index + 1,
                    label: monthLabel,
                  }))}
                />

                <Select
                  name="transactions-month-filter-year"
                  value={selectedMonthParts.year}
                  onChange={(event) => updateSelectedMonth(event.target.value, selectedMonthParts.month)}
                  options={monthFilterYearOptions.map((optionYear) => ({
                    value: optionYear,
                    label: String(optionYear),
                  }))}
                />
              </div>

              <p className="text-[10px] text-ink-3 mt-1">Filtering: {formatMonthInputLabel(selectedMonth)}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <SectionHeader
          title="Type and facets"
          subtitle="Combine type, category, and payment chips to isolate exact rows quickly."
        />

        <FilterRow>
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
            ref={categoryTriggerRef}
            type="button"
            onClick={() => {
              setShowCats(v => !v)
              setShowPaymentModes(false)
            }}
            aria-expanded={showCats}
            aria-controls="txn-category-filter-panel"
            className={`chip-control chip-control-sm ${catFilter
              ? 'bg-brand text-brand-on border-brand'
              : 'bg-kosha-surface text-ink-3 border-kosha-border hover:bg-kosha-surface-2'}`}
          >
            <Faders size={11} />
            {catFilter ? getCategoryLabel(catFilter) : 'Category'}
          </button>

          <button
            ref={paymentTriggerRef}
            type="button"
            onClick={() => {
              setShowPaymentModes(v => !v)
              setShowCats(false)
            }}
            aria-expanded={showPaymentModes}
            aria-controls="txn-payment-filter-panel"
            className={`chip-control chip-control-sm ${paymentModeFilter
              ? 'bg-brand text-brand-on border-brand'
              : 'bg-kosha-surface text-ink-3 border-kosha-border hover:bg-kosha-surface-2'}`}
          >
            <Faders size={11} />
            {paymentModeFilter ? getPaymentModeLabel(paymentModeFilter) : 'Payment'}
          </button>

          {linkedLoanFilter && (
            <button
              type="button"
              onClick={() => {
                clearLinkedFilters()
              }}
              className="chip-control chip-control-sm bg-brand text-brand-on border-brand flex items-center gap-1"
            >
              Loan repayments
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          )}

        </FilterRow>

        <AnimatePresence>
          {showCats && (
            <motion.div
              id="txn-category-filter-panel"
              ref={categoryPanelRef}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="mini-panel p-3"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-[11px] uppercase tracking-wide text-ink-3">Select Category</p>
                {catFilter && (
                  <button
                    type="button"
                    onClick={() => { handleCatFilter(''); setShowCats(false) }}
                    className="chip-control chip-control-sm bg-kosha-surface text-ink-2 border-kosha-border hover:bg-kosha-surface-2"
                  >
                    Clear selection
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {filterCategories.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      handleCatFilter(catFilter === cat.id ? '' : cat.id)
                      setShowCats(false)
                    }}
                    className={`chip-control chip-control-sm ${catFilter === cat.id
                      ? 'bg-brand text-brand-on border-brand'
                      : 'bg-kosha-surface text-ink-3 border-kosha-border hover:bg-kosha-surface-2'}`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="mt-3 pt-3 border-t border-kosha-border flex items-center justify-between">
                <p className="text-[10px] text-ink-3">Missing a category?</p>
                <button
                  type="button"
                  onClick={() => {
                    setShowCats(false)
                    setShowCreateCategory(true)
                  }}
                  className="chip-control chip-control-sm bg-kosha-surface text-ink-2 border-kosha-border hover:bg-kosha-surface-2"
                >
                  <Plus size={11} />
                  Add new
                </button>
              </div>
            </motion.div>
          )}

          {showPaymentModes && (
            <motion.div
              id="txn-payment-filter-panel"
              ref={paymentPanelRef}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="mini-panel p-3 flex flex-wrap gap-2"
            >
              {PAYMENT_MODES.map(mode => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => {
                    handlePaymentModeFilter(paymentModeFilter === mode.id ? '' : mode.id)
                    setShowPaymentModes(false)
                  }}
                  className={`chip-control chip-control-sm ${paymentModeFilter === mode.id
                    ? 'bg-brand text-brand-on border-brand'
                    : 'bg-kosha-surface text-ink-3 border-kosha-border hover:bg-kosha-surface-2'}`}
                >
                  {mode.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  )
}
