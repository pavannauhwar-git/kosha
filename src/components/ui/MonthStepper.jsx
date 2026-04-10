import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { MONTH_NAMES } from '../../lib/constants'

/**
 * MonthStepper — month/year navigation that blocks future months
 * @param {{ year: number, month: number, onChange: function, minYear?: number, className?: string }} props
 */
export default function MonthStepper({ year, month, onChange, minYear = 2020, className = '' }) {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const isAtFuture = year > currentYear || (year === currentYear && month >= currentMonth)
  const isAtMin = year <= minYear && month <= 1

  const goPrev = () => {
    if (isAtMin) return
    if (month === 1) {
      onChange(year - 1, 12)
    } else {
      onChange(year, month - 1)
    }
  }

  const goNext = () => {
    if (isAtFuture) return
    if (month === 12) {
      onChange(year + 1, 1)
    } else {
      onChange(year, month + 1)
    }
  }

  const label = `${MONTH_NAMES[month - 1]} ${year}`

  return (
    <div className={`flex items-center justify-between bg-[var(--ds-surface-container)] rounded-xl px-2 h-11 ${className}`}>
      <button
        onClick={goPrev}
        disabled={isAtMin}
        className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[var(--ds-surface-container-high)] transition-colors disabled:opacity-30 disabled:pointer-events-none"
        aria-label="Previous month"
        type="button"
      >
        <CaretLeft size={18} weight="bold" className="text-[var(--ds-text)]" />
      </button>

      <span className="text-label font-semibold text-[var(--ds-text)] select-none min-w-[120px] text-center">
        {label}
      </span>

      <button
        onClick={goNext}
        disabled={isAtFuture}
        className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[var(--ds-surface-container-high)] transition-colors disabled:opacity-30 disabled:pointer-events-none"
        aria-label="Next month"
        type="button"
      >
        <CaretRight size={18} weight="bold" className="text-[var(--ds-text)]" />
      </button>
    </div>
  )
}
