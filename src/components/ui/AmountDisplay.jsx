import { memo, useEffect, useRef, useState } from 'react'
import { fmt } from '../../lib/utils'

const TYPE_COLORS = {
  income:     'var(--ds-income-text)',
  expense:    'var(--ds-expense-text)',
  investment: 'var(--ds-invest-text)',
  balance:    'var(--ds-text)',
  neutral:    'var(--ds-text)',
}

const SIZE_CLASSES = {
  sm:   'text-label font-semibold',
  md:   'text-value font-bold',
  lg:   'text-display font-bold',
  hero: 'text-hero font-black',
}

/**
 * AmountDisplay — formatted number with optional animated count-up
 * @param {{ amount: number, type?: string, size?: 'sm'|'md'|'lg'|'hero', animate?: boolean, prefix?: string, currency?: string, className?: string }} props
 */
const AmountDisplay = memo(function AmountDisplay({
  amount,
  type = 'neutral',
  size = 'md',
  animate = false,
  prefix,
  currency = 'INR',
  className = '',
}) {
  const [displayValue, setDisplayValue] = useState(animate ? 0 : amount)
  const rafRef = useRef(null)
  const startTimeRef = useRef(null)

  useEffect(() => {
    if (!animate) {
      setDisplayValue(amount)
      return
    }

    const duration = 600
    const start = displayValue
    const diff = amount - start

    const tick = (timestamp) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp
      const elapsed = timestamp - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayValue(start + diff * eased)

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick)
      }
    }

    startTimeRef.current = null
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [amount, animate])

  const autoPrefix = prefix ?? (type === 'income' ? '+' : type === 'expense' ? '-' : '')
  const color = TYPE_COLORS[type] || TYPE_COLORS.neutral
  const symbol = currency === 'INR' ? '₹' : '$'

  return (
    <span
      className={`${SIZE_CLASSES[size]} tabular-nums tracking-tight ${animate ? 'animate-count-up' : ''} ${className}`}
      style={{ color }}
      aria-label={`${autoPrefix}${fmt(Math.abs(amount))}`}
    >
      {autoPrefix}{symbol}{Math.abs(Math.round(displayValue)).toLocaleString('en-IN')}
    </span>
  )
})

export default AmountDisplay
