import Chip from '@mui/material/Chip'

const VARIANT_SX = {
  recurring: {
    backgroundColor: 'var(--ds-primary-container)',
    color: 'var(--ds-on-primary-container)',
  },
  repayment: {
    backgroundColor: 'var(--ds-repay-bg)',
    color: 'var(--ds-repay-text)',
  },
  income: {
    backgroundColor: 'var(--ds-income-bg)',
    color: 'var(--ds-income-text)',
  },
  expense: {
    backgroundColor: 'var(--ds-expense-bg)',
    color: 'var(--ds-expense-text)',
  },
  invest: {
    backgroundColor: 'var(--ds-invest-bg)',
    color: 'var(--ds-invest-text)',
  },
  category: {
    backgroundColor: 'var(--ds-surface-container)',
    color: 'var(--ds-text-secondary)',
  },
  status: {
    backgroundColor: 'var(--ds-surface-container-high)',
    color: 'var(--ds-text)',
  },
  neutral: {
    backgroundColor: 'var(--ds-surface-container)',
    color: 'var(--ds-text-tertiary)',
  },
}

const SIZE_SX = {
  sm: {
    height: '20px',
    fontSize: '10px',
    px: 0.5,
    '& .MuiChip-label': {
      px: 1,
    },
  },
  md: {
    height: '24px',
    fontSize: '11px',
    px: 0.75,
    '& .MuiChip-label': {
      px: 1.25,
    },
  },
}

/**
 * Badge — status indicator wrapping MUI Chip
 */
export default function Badge({
  variant = 'neutral',
  children,
  icon,
  size = 'sm',
  className = '',
}) {
  const customSx = {
    fontWeight: 600,
    borderRadius: '9999px',
    border: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'default',
    ...VARIANT_SX[variant],
    ...SIZE_SX[size],
  }

  return (
    <Chip
      label={children}
      icon={icon ? <span className="shrink-0 flex items-center">{icon}</span> : undefined}
      sx={customSx}
      className={className}
      role="status"
    />
  )
}
