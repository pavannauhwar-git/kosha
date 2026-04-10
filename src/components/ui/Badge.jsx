const VARIANT_CLASSES = {
  recurring:  'bg-[var(--ds-primary-container)] text-[var(--ds-on-primary-container)]',
  repayment:  'bg-[var(--ds-repay-bg)] text-[var(--ds-repay-text)]',
  income:     'bg-[var(--ds-income-bg)] text-[var(--ds-income-text)]',
  expense:    'bg-[var(--ds-expense-bg)] text-[var(--ds-expense-text)]',
  invest:     'bg-[var(--ds-invest-bg)] text-[var(--ds-invest-text)]',
  category:   'bg-[var(--ds-surface-container)] text-[var(--ds-text-secondary)]',
  status:     'bg-[var(--ds-surface-container-high)] text-[var(--ds-text)]',
  neutral:    'bg-[var(--ds-surface-container)] text-[var(--ds-text-tertiary)]',
}

const SIZE_CLASSES = {
  sm: 'text-[10px] px-2 py-0.5 gap-1',
  md: 'text-[11px] px-2.5 py-1 gap-1.5',
}

/**
 * Badge — small status/tag indicator
 * @param {{ variant?: string, children: React.ReactNode, icon?: React.ReactNode, size?: 'sm'|'md', className?: string }} props
 */
export default function Badge({ variant = 'neutral', children, icon, size = 'sm', className = '' }) {
  return (
    <span
      className={[
        'inline-flex items-center font-semibold rounded-pill whitespace-nowrap select-none',
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant] || VARIANT_CLASSES.neutral,
        className,
      ].join(' ')}
      role="status"
    >
      {icon && <span className="shrink-0 flex items-center">{icon}</span>}
      {children}
    </span>
  )
}
