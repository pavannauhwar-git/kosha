import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { MONTH_SHORT } from '../../lib/constants'
import BottomSheet from '../ui/BottomSheet'
import Button from '../ui/Button'

const RECENT_MONTH_COUNT = 6
const RECENT_YEAR_COUNT = 5

export default function PickerNavigator({
  label,
  onPrev,
  onNext,
  mode = 'month',
  month,
  year,
  minYear = 1900,
  maxYear = 2100,
  onSelectMonthYear,
  onSelectYear,
  className = 'mb-4',
}) {
  const [open, setOpen] = useState(false)
  const [draftMonth, setDraftMonth] = useState(month || 1)
  const [draftYear, setDraftYear] = useState(year || new Date().getFullYear())

  useEffect(() => {
    if (!open) return
    if (mode === 'month') {
      setDraftMonth(month || 1)
    }
    setDraftYear(year || new Date().getFullYear())
  }, [open, mode, month, year])

  const yearOptions = useMemo(() => {
    const count = Math.max(0, maxYear - minYear + 1)
    return Array.from({ length: count }, (_, index) => maxYear - index)
  }, [minYear, maxYear])

  const recentMonths = useMemo(() => {
    const now = new Date()
    const rows = []

    for (let offset = 0; offset < RECENT_MONTH_COUNT; offset += 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - offset, 1)
      const itemYear = d.getFullYear()
      const itemMonth = d.getMonth() + 1

      if (itemYear < minYear || itemYear > maxYear) continue

      rows.push({
        month: itemMonth,
        year: itemYear,
        label: `${MONTH_SHORT[itemMonth - 1]} ${itemYear}`,
      })
    }

    return rows
  }, [minYear, maxYear])

  const recentYears = useMemo(() => {
    const currentYear = new Date().getFullYear()
    return Array.from({ length: RECENT_YEAR_COUNT }, (_, index) => currentYear - index)
      .filter((itemYear) => itemYear >= minYear && itemYear <= maxYear)
  }, [minYear, maxYear])

  function applySelection() {
    if (mode === 'month') {
      onSelectMonthYear?.({ month: draftMonth, year: draftYear })
    } else {
      onSelectYear?.(draftYear)
    }
    setOpen(false)
  }

  function selectCurrentPeriod() {
    const now = new Date()
    const currentYear = now.getFullYear()

    if (mode === 'month') {
      const currentMonth = now.getMonth() + 1
      setDraftYear(currentYear)
      setDraftMonth(currentMonth)
      onSelectMonthYear?.({ month: currentMonth, year: currentYear })
    } else {
      setDraftYear(currentYear)
      onSelectYear?.(currentYear)
    }

    setOpen(false)
  }

  function quickApplyRecentMonth(itemMonth, itemYear) {
    setDraftMonth(itemMonth)
    setDraftYear(itemYear)
    onSelectMonthYear?.({ month: itemMonth, year: itemYear })
    setOpen(false)
  }

  function quickApplyRecentYear(itemYear) {
    setDraftYear(itemYear)
    onSelectYear?.(itemYear)
    setOpen(false)
  }

  return (
    <>
      <div className={`flex items-center justify-between ${className}`}>
        <button
          onClick={onPrev}
          className="w-8 h-8 rounded-full bg-kosha-surface border border-kosha-border
                     flex items-center justify-center active:bg-kosha-surface-2
                     hover:bg-kosha-surface-2 focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:outline-none transition-[background-color] duration-150"
        >
          <ChevronLeft size={16} className="text-ink-2" />
        </button>

        <button
          type="button"
          className="cursor-pointer leading-none"
          onClick={() => setOpen(true)}
        >
          <h1 className="text-value font-semibold text-ink tracking-tight leading-[1.05]">{label}</h1>
          <p className="text-[10px] text-ink-4 text-center mt-0">Jump to</p>
        </button>

        <button
          onClick={onNext}
          className="w-8 h-8 rounded-full bg-kosha-surface border border-kosha-border
                     flex items-center justify-center active:bg-kosha-surface-2
                     hover:bg-kosha-surface-2 focus-visible:ring-2 focus-visible:ring-brand/20 focus-visible:outline-none transition-[background-color] duration-150"
        >
          <ChevronRight size={16} className="text-ink-2" />
        </button>
      </div>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={mode === 'month' ? 'Jump to month' : 'Jump to year'}
        description={mode === 'month'
          ? 'Choose any month and year to view monthly summary.'
          : 'Choose any year to view yearly analytics.'}
      >
        <div className="pb-3">
          {mode === 'month' && recentMonths.length > 0 && (
            <div className="mb-2.5">
              <p className="text-[11px] text-ink-3 uppercase tracking-[0.08em] mb-2">Recent months</p>
              <div className="overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
                <div className="flex items-center gap-2 min-w-max">
                  {recentMonths.map((item) => {
                    const active = item.month === draftMonth && item.year === draftYear
                    return (
                      <button
                        key={`${item.year}-${item.month}`}
                        type="button"
                        onClick={() => quickApplyRecentMonth(item.month, item.year)}
                        className={[
                          'h-9 px-3 rounded-pill text-[12px] font-semibold border whitespace-nowrap transition-[background-color,border-color,color] duration-150',
                          active
                            ? 'bg-brand-container text-brand border-brand/20'
                            : 'bg-kosha-surface text-ink-3 border-kosha-border hover:bg-kosha-surface-2',
                        ].join(' ')}
                      >
                        {item.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {mode === 'year' && recentYears.length > 0 && (
            <div className="mb-2.5">
              <p className="text-[11px] text-ink-3 uppercase tracking-[0.08em] mb-2">Recent years</p>
              <div className="overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
                <div className="flex items-center gap-2 min-w-max">
                  {recentYears.map((itemYear) => {
                    const active = itemYear === draftYear
                    return (
                      <button
                        key={itemYear}
                        type="button"
                        onClick={() => quickApplyRecentYear(itemYear)}
                        className={[
                          'h-9 px-3 rounded-pill text-[12px] font-semibold border whitespace-nowrap transition-[background-color,border-color,color] duration-150',
                          active
                            ? 'bg-brand-container text-brand border-brand/20'
                            : 'bg-kosha-surface text-ink-3 border-kosha-border hover:bg-kosha-surface-2',
                        ].join(' ')}
                      >
                        {itemYear}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="mb-2.5">
            <p className="text-[11px] text-ink-3 uppercase tracking-[0.08em] mb-1.5">Year</p>
            <div className="relative">
              <select
                value={draftYear}
                onChange={(e) => setDraftYear(Number(e.target.value))}
                className="w-full h-11 appearance-none rounded-card border border-kosha-border bg-kosha-surface-2 px-4 pr-10
                           text-[15px] leading-[1.2] text-ink focus:outline-none focus:border-brand focus:bg-kosha-surface"
              >
                {yearOptions.map((optionYear) => (
                  <option key={optionYear} value={optionYear}>{optionYear}</option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3 pointer-events-none" />
            </div>
          </div>

          {mode === 'month' && (
            <div className="mb-3">
              <p className="text-[11px] text-ink-3 uppercase tracking-[0.08em] mb-2">Month</p>
              <div className="grid grid-cols-3 gap-2">
                {MONTH_SHORT.map((monthLabel, index) => {
                  const monthNumber = index + 1
                  const active = draftMonth === monthNumber
                  return (
                    <button
                      key={monthLabel}
                      type="button"
                      onClick={() => setDraftMonth(monthNumber)}
                      className={[
                        'h-9 rounded-card text-[12px] font-semibold border transition-[background-color,border-color,color] duration-150',
                        active
                          ? 'bg-brand-container text-brand border-brand/20'
                          : 'bg-kosha-surface text-ink-3 border-kosha-border hover:bg-kosha-surface-2',
                      ].join(' ')}
                    >
                      {monthLabel}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 mt-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={selectCurrentPeriod}
            >
              {mode === 'month' ? 'Current month' : 'Current year'}
            </Button>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={applySelection}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      </BottomSheet>
    </>
  )
}
