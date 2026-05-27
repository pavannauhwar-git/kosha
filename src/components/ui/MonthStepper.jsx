import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { MONTH_NAMES } from '../../lib/constants'
import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'

/**
 * MonthStepper — M3 Expressive month/year navigation.
 * Arrow buttons spring-press on tap; month label cross-fades with directional slide.
 */
export default function MonthStepper({ year, month, onChange, minYear = 2020, className = '' }) {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const isAtFuture = year > currentYear || (year === currentYear && month >= currentMonth)
  const isAtMin = year <= minYear && month <= 1

  // Track direction for slide animation
  const [direction, setDirection] = useState(0) // -1 = prev, 1 = next

  const goPrev = () => {
    if (isAtMin) return
    setDirection(-1)
    if (month === 1) {
      onChange(year - 1, 12)
    } else {
      onChange(year, month - 1)
    }
  }

  const goNext = () => {
    if (isAtFuture) return
    setDirection(1)
    if (month === 12) {
      onChange(year + 1, 1)
    } else {
      onChange(year, month + 1)
    }
  }

  const label = `${MONTH_NAMES[month - 1]} ${year}`
  const labelKey = `${year}-${month}`

  return (
    <div className={`flex items-center justify-between bg-[var(--ds-surface-container)] rounded-xl px-2 h-11 ${className}`}>
      {/* Prev arrow */}
      <motion.button
        onClick={goPrev}
        disabled={isAtMin}
        className="w-9 h-9 flex items-center justify-center rounded-lg disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-none md3-state-overlay relative overflow-hidden"
        style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
        aria-label="Previous month"
        type="button"
      >
        <CaretLeft size={18} weight="bold" className="text-[var(--ds-text)]" />
      </motion.button>

      {/* Month label — directional spring slide */}
      <div className="min-w-[120px] text-center overflow-hidden">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={labelKey}
            className="text-label font-semibold text-[var(--ds-text)] select-none block"
            initial={{ x: direction * 24, opacity: 0, scale: 0.95 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: direction * -24, opacity: 0, scale: 0.95 }}
            transition={{
              duration: 0.4,
              ease: [0, 0, 0, 1] // MD3 Standard Decelerate
            }}
          >
            {label}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* Next arrow */}
      <motion.button
        onClick={goNext}
        disabled={isAtFuture}
        className="w-9 h-9 flex items-center justify-center rounded-lg disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-none md3-state-overlay relative overflow-hidden"
        style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
        aria-label="Next month"
        type="button"
      >
        <CaretRight size={18} weight="bold" className="text-[var(--ds-text)]" />
      </motion.button>
    </div>
  )
}
