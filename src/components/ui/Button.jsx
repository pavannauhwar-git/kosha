import { forwardRef } from 'react'

const SIZE_CLASSES = {
  sm: 'h-8 px-3 text-[11px] gap-1.5',
  md: 'h-11 px-5 text-[13px] gap-2',
  lg: 'h-13 px-7 text-[15px] gap-2.5',
}

const VARIANT_CLASSES = {
  primary:   'bg-[var(--ds-primary)] text-white shadow-fab hover:bg-[var(--ds-primary-dark)] active:scale-[0.97]',
  secondary: 'bg-[var(--ds-surface)] text-[var(--ds-text-secondary)] shadow-card border border-[var(--ds-border)] hover:bg-[var(--ds-surface-container)] active:scale-[0.97]',
  ghost:     'bg-transparent text-[var(--ds-text-secondary)] hover:bg-[var(--ds-surface-container)] active:scale-[0.97] border border-transparent',
  danger:    'bg-[var(--ds-expense-bg)] text-[var(--ds-expense-text)] border border-[var(--ds-expense-border)] hover:bg-red-100 active:scale-[0.97]',
  tonal:     'bg-[var(--ds-primary-container)] text-[var(--ds-on-primary-container)] hover:brightness-95 active:scale-[0.97] border border-transparent',
}

const DISABLED_CLASSES = 'opacity-45 pointer-events-none'

/**
 * Button — primary interactive element
 * @param {{ variant?: 'primary'|'secondary'|'ghost'|'danger'|'tonal', size?: 'sm'|'md'|'lg', disabled?: boolean, loading?: boolean, icon?: React.ReactNode, iconRight?: React.ReactNode, fullWidth?: boolean, className?: string, children: React.ReactNode }} props
 */
const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', disabled, loading, icon, iconRight, fullWidth, className = '', children, ...rest },
  ref
) {
  const isDisabled = disabled || loading
  return (
    <button
      ref={ref}
      disabled={isDisabled}
      className={[
        'inline-flex items-center justify-center font-semibold rounded-pill select-none cursor-pointer',
        'transition-all duration-200',
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
        isDisabled ? DISABLED_CLASSES : '',
        fullWidth ? 'w-full' : '',
        className,
      ].filter(Boolean).join(' ')}
      {...rest}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" role="status" aria-label="Loading" />
      ) : icon ? (
        <span className="shrink-0 flex items-center">{icon}</span>
      ) : null}
      {children && <span>{children}</span>}
      {iconRight && <span className="shrink-0 flex items-center">{iconRight}</span>}
    </button>
  )
})

export default Button
