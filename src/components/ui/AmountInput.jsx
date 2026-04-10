import { forwardRef, useCallback, useId, useRef, useState } from 'react'
import { fmt } from '../../lib/utils'

const TYPE_COLORS = {
  income:     { ring: 'var(--ds-income)', bg: 'var(--ds-income-bg)', text: 'var(--ds-income-text)' },
  expense:    { ring: 'var(--ds-expense)', bg: 'var(--ds-expense-bg)', text: 'var(--ds-expense-text)' },
  investment: { ring: 'var(--ds-invest)', bg: 'var(--ds-invest-bg)', text: 'var(--ds-invest-text)' },
}

/**
 * AmountInput — currency-aware amount field. Formats on blur, reects non-numeric silently.
 * @param {{ value: string, onChange: function, type?: 'income'|'expense'|'investment', currency?: string, autoFocus?: boolean, error?: string, placeholder?: string, className?: string }} props
 */
const AmountInput = forwardRef(function AmountInput(
  { value, onChange, type = 'expense', currency = 'INR', autoFocus, error, placeholder = '0', className = '', ...rest },
  ref
) {
  const id = useId()
  const innerRef = useRef(null)
  const inputRef = ref || innerRef
  const [focused, setFocused] = useState(false)
  const colors = TYPE_COLORS[type] || TYPE_COLORS.expense

  const handleChange = useCallback((e) => {
    const raw = e.target.value
    if (raw === '' || /^[0-9]*\.?[0-9]*$/.test(raw)) {
      onChange(raw)
    }
  }, [onChange])

  const handleBlur = useCallback(() => {
    setFocused(false)
    if (value && !isNaN(Number(value))) {
      const num = parseFloat(value)
      if (num !== 0) {
        onChange(String(num))
      }
    }
  }, [value, onChange])

  const symbol = currency === 'INR' ? '₹' : '$'
  const hasError = Boolean(error)

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div
        className="relative flex items-center rounded-2xl transition-all duration-200"
        style={{
          background: focused ? colors.bg : 'var(--ds-surface-container)',
          border: `2px solid ${focused ? colors.ring : hasError ? 'var(--ds-expense)' : 'transparent'}`,
        }}
      >
        <span
          className="pl-5 text-display font-bold select-none"
          style={{ color: colors.text }}
          aria-hidden="true"
        >
          {symbol}
        </span>
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          aria-label={`Amount in ${currency}`}
          aria-invalid={hasError}
          className="flex-1 bg-transparent text-hero font-black tracking-tight py-4 pr-5 pl-2 text-[var(--ds-text)] placeholder:text-[var(--ds-text-disabled)] focus:outline-none min-w-0"
          {...rest}
        />
      </div>
      {hasError && (
        <p className="text-caption text-[var(--ds-expense-text)] px-1" role="alert">{error}</p>
      )}
    </div>
  )
})

export default AmountInput
