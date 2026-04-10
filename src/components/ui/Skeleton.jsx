const VARIANT_MAP = {
  text:   'h-4 rounded',
  circle: 'rounded-full aspect-square',
  rect:   'rounded-xl',
  card:   'rounded-card h-32',
  row:    'rounded-card h-16',
}

/**
 * Skeleton — loading placeholder with pulse animation
 * @param {{ variant?: 'text'|'circle'|'rect'|'card'|'row', width?: string, height?: string, count?: number, className?: string }} props
 */
export default function Skeleton({ variant = 'rect', width, height, count = 1, className = '' }) {
  const items = Array.from({ length: count }, (_, i) => i)

  return (
    <>
      {items.map((i) => (
        <div
          key={i}
          className={[
            'animate-skeleton-pulse',
            VARIANT_MAP[variant],
            width || (variant === 'text' ? 'w-full' : variant === 'circle' ? 'w-10' : 'w-full'),
            height || '',
            className,
          ].join(' ')}
          style={{
            background: `linear-gradient(90deg, var(--ds-shimmer-1) 0%, var(--ds-shimmer-2) 40%, var(--ds-shimmer-1) 80%)`,
            backgroundSize: '800px 100%',
          }}
          role="status"
          aria-label="Loading"
        />
      ))}
    </>
  )
}
