import { forwardRef } from 'react'
import MuiSwitch from '@mui/material/Switch'

/**
 * Switch — High-performance, premium Switch wrapping MUI Switch.
 * Seamlessly integrates with our CSS design tokens and dark mode.
 */
const Switch = forwardRef(function Switch(
  { checked, onChange, disabled, className = '', style = {}, sx = {}, ...props },
  ref
) {
  return (
    <MuiSwitch
      ref={ref}
      checked={!!checked}
      onChange={onChange}
      disabled={disabled}
      className={className}
      style={style}
      sx={{
        width: 52,
        height: 32,
        padding: 0,
        display: 'inline-flex',
        '& .MuiSwitch-switchBase': {
          padding: 0,
          margin: '4px',
          transitionDuration: '200ms',
          '&.Mui-checked': {
            transform: 'translateX(20px)',
            color: 'var(--ds-on-primary)',
            '& + .MuiSwitch-track': {
              backgroundColor: 'var(--ds-primary)',
              opacity: 1,
              border: 0,
            },
            '&.Mui-disabled + .MuiSwitch-track': {
              backgroundColor: 'var(--ds-surface-container-highest)',
              opacity: 0.38,
            },
          },
          '&.Mui-disabled': {
            color: 'var(--ds-text-disabled)',
          },
        },
        '& .MuiSwitch-thumb': {
          boxSizing: 'border-box',
          width: 24,
          height: 24,
          boxShadow: 'none',
        },
        '& .MuiSwitch-track': {
          borderRadius: 32 / 2,
          backgroundColor: 'var(--ds-surface-container-highest)',
          opacity: 1,
          transition: 'background-color 200ms ease',
        },
        ...sx,
      }}
      {...props}
    />
  )
})

export default Switch
