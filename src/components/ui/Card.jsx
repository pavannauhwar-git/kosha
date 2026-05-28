import { motion, useReducedMotion } from 'framer-motion'
import MuiCard from '@mui/material/Card'

const VARIANT_SX = {
  elevated: {
    backgroundColor: 'var(--ds-surface)',
    boxShadow: 'var(--ds-shadow-sm)',
    border: 'none',
  },
  filled: {
    backgroundColor: 'var(--ds-surface-container)',
    boxShadow: 'none',
    border: 'none',
  },
  outlined: {
    backgroundColor: 'var(--ds-surface)',
    border: '1px solid var(--ds-border)',
    boxShadow: 'none',
  },
}

const PADDING_SX = {
  none: { p: 0 },
  sm: { p: 1.5 }, // 12px
  md: { p: 2.5 }, // 20px
  lg: { p: 3 },   // 24px
}

/**
 * Card — M3 Expressive spring interactions on pressable cards.
 * Static cards remain pure MuiCard for minimal overhead.
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
  const shouldReduceMotion = useReducedMotion()

  // M3 standard Large corner radius for cards is 16px (md3-lg)
  const baseRadius = '16px'

  const customSx = {
    borderRadius: baseRadius,
    width: '100%',
    textAlign: 'left',
    display: 'block',
    boxSizing: 'border-box',
    ...VARIANT_SX[variant],
    ...PADDING_SX[padding],
  }

  if (isClickable) {
    const parentStyle = {
      display: 'block',
      width: '100%',
      backgroundColor: VARIANT_SX[variant].backgroundColor,
      border: VARIANT_SX[variant].border,
      boxShadow: VARIANT_SX[variant].boxShadow || 'none',
      cursor: 'pointer',
      userSelect: 'none',
      position: 'relative',
      overflow: 'hidden',
    }

    // Pass transparent / borderless styles to inner MuiCard
    const innerSx = {
      width: '100%',
      textAlign: 'left',
      display: 'block',
      boxSizing: 'border-box',
      backgroundColor: 'transparent',
      boxShadow: 'none',
      border: 'none',
      borderRadius: 'inherit', // Let inner card match the morphing parent!
      ...PADDING_SX[padding],
    }

    return (
      <motion.div
        onClick={onClick}
        className={`${className} md3-state-overlay relative`}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick?.(e)
          }
        }}
        whileHover={{
          borderRadius: shouldReduceMotion ? baseRadius : '24px',
          scale: shouldReduceMotion ? 1 : 1.015,
          boxShadow: 'var(--ds-shadow-md)',
        }}
        whileTap={{
          borderRadius: shouldReduceMotion ? baseRadius : '14px',
          scale: shouldReduceMotion ? 1 : 0.98,
          boxShadow: 'var(--ds-shadow-sm)',
        }}
        initial={{
          borderRadius: baseRadius,
          boxShadow: VARIANT_SX[variant].boxShadow || 'none',
        }}
        animate={{
          borderRadius: baseRadius,
          boxShadow: VARIANT_SX[variant].boxShadow || 'none',
        }}
        transition={{
          type: 'spring',
          stiffness: 450,
          damping: 32,
        }}
        style={parentStyle}
      >
        <MuiCard
          sx={innerSx}
          component="div"
          {...rest}
        >
          {children}
        </MuiCard>
      </motion.div>
    )
  }

  return (
    <MuiCard
      sx={customSx}
      className={className}
      component="div"
      {...rest}
    >
      {children}
    </MuiCard>
  )
}
