import { forwardRef, useId } from 'react'

/**
 * Input — text input with label, validation, icons
 * @param {{ label?: string, placeholder?: string, value?: string, onChange?: function, type?: string, error?: string, helperText?: string, disabled?: boolean, icon?: React.ReactNode, iconRight?: React.ReactNode, autoFocus?: boolean, className?: string }} props
 */
const Input = forwardRef(function Input(
  { label, placeholder, value, onChange, type = 'text', error, helperText, disabled, icon, iconRight, autoFocus, className = '', ...rest },
  ref
) {
  const id = useId()
  const hasError = Boolean(error)

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={id} className="text-label font-medium text-[var(--ds-text-secondary)]">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ds-text-tertiary)] flex items-center pointer-events-none">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          id={id}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-invalid={hasError}
          aria-describedby={error ? `${id}-error` : helperText ? `${id}-helper` : undefined}
          className={[
            'w-full rounded-xl text-body text-[var(--ds-text)] placeholder:text-[var(--ds-text-disabled)]',
            'bg-[var(--ds-surface-container)] border transition-[border-color,box-shadow,background-color] duration-200',
            'focus:outline-none focus:bg-[var(--ds-surface)]',
            'min-h-[44px] py-3',
            icon ? 'pl-10 pr-4' : iconRight ? 'pl-4 pr-10' : 'px-4',
            hasError
              ? 'border-[var(--ds-expense)] focus:ring-2 focus:ring-[var(--ds-expense)]/20'
              : 'border-[var(--ds-border)] focus:border-[var(--ds-primary)] focus:ring-2 focus:ring-[var(--ds-primary)]/12',
            disabled ? 'opacity-45 pointer-events-none' : '',
          ].filter(Boolean).join(' ')}
          {...rest}
        />
        {iconRight && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--ds-text-tertiary)] flex items-center">
            {iconRight}
          </span>
        )}
      </div>
      {hasError && (
        <p id={`${id}-error`} className="text-caption text-[var(--ds-expense-text)] flex items-center gap-1" role="alert">
          {error}
        </p>
      )}
      {!hasError && helperText && (
        <p id={`${id}-helper`} className="text-caption text-[var(--ds-text-tertiary)]">
          {helperText}
        </p>
      )}
    </div>
  )
})

export default Input
