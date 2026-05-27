import MuiSkeleton from '@mui/material/Skeleton'

const VARIANT_SX = {
  text: { borderRadius: '4px', height: '16px' },
  circle: { borderRadius: '50%', aspectRatio: '1/1', width: '40px' },
  rect: { borderRadius: '12px' },
  card: { borderRadius: '20px', height: '128px' },
  row: { borderRadius: '20px', height: '64px' },
}

/**
 * Skeleton — placeholder component wrapping MUI Skeleton
 */
export default function Skeleton({
  variant = 'rect',
  width,
  height,
  count = 1,
  className = '',
}) {
  const items = Array.from({ length: count }, (_, i) => i)

  const customSx = {
    backgroundColor: 'var(--ds-shimmer-1)',
    ...VARIANT_SX[variant],
    ...(width ? { width } : {}),
    ...(height ? { height } : {}),
  }

  // MUI variant mapping: text -> text, circle -> circular, others -> rounded
  const muiVariant = variant === 'text'
    ? 'text'
    : variant === 'circle'
      ? 'circular'
      : 'rounded'

  return (
    <>
      {items.map((i) => (
        <MuiSkeleton
          key={i}
          variant={muiVariant}
          animation="wave"
          sx={customSx}
          className={className}
          role="status"
          aria-label="Loading"
        />
      ))}
    </>
  )
}
