const VARIANT_CLASSES = {
  elevated: 'bg-[var(--ds-surface)] shadow-card',
  filled:   'bg-[var(--ds-surface-container)]',
  outlined: 'bg-[var(--ds-surface)] border border-[var(--ds-border)]',
}

const PADDING_CLASSES = {
  none: '',
  sm:   'p-3',
  md:   'p-5',
  lg:   'p-6',
}

/**
 * Card — container surface with optional press state
 * @param {{ variant?: 'elevated'|'filled'|'outlined', padding?: 'none'|'sm'|'md'|'lg', pressable?: boolean, onClick?: function, className?: string, children: React.ReactNode }} props
 */
export default function Card({
  variant = 'elevated',
  padding = 'md',
  pressable = false,
  onClick,
  className = '',
  children,
  ...rest
}) {
  const isClickable = pressable || onClick
  const Tag = isClickable ? 'button' : 'div'

  return (
    <Tag
      onClick={onClick}
      className={[
        'rounded-card w-full text-left',
        VARIANT_CLASSES[variant],
        PADDING_CLASSES[padding],
        isClickable ? 'cursor-pointer transition-all duration-200 hover:shadow-card-md active:scale-[0.98] focus-visible:outline-none' : '',
        className,
      ].filter(Boolean).join(' ')}
      {...(isClickable ? { type: 'button', role: 'button' } : {})}
      {...rest}
    >
      {children}
    </Tag>
  )
}
