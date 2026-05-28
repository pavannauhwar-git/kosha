import { forwardRef, useCallback } from 'react'
import { hapticTap } from '../../lib/haptics'
import '@material/web/button/filled-button.js'
import '@material/web/button/outlined-button.js'
import '@material/web/button/text-button.js'
import '@material/web/button/filled-tonal-button.js'
import '@material/web/progress/circular-progress.js'

/**
 * Button — Wraps official Google Material 3 Web Component buttons.
 */
const Button = forwardRef(function Button(
  {
    as, // preserved for API compatibility
    variant = 'primary',
    size = 'md',
    disabled,
    loading,
    icon,
    iconRight,
    fullWidth,
    className = '',
    style = {},
    sx, // MUI-specific styling, mapped if needed
    children,
    onClick,
    href,
    target,
    ...rest
  },
  ref
) {
  const isDisabled = disabled || loading

  const handleClick = useCallback((e) => {
    if (isDisabled) return
    hapticTap()
    if (onClick) onClick(e)
  }, [isDisabled, onClick])

  // Map variants to specific custom element tags
  let Tag = 'md-filled-button'
  if (variant === 'secondary') {
    Tag = 'md-outlined-button'
  } else if (variant === 'ghost') {
    Tag = 'md-text-button'
  } else if (variant === 'tonal') {
    Tag = 'md-filled-tonal-button'
  }

  // Calculate size variables
  const sizeHeights = {
    xs: '28px',
    sm: '32px',
    md: '40px',
    lg: '48px',
    xl: '48px',
  }
  const heightVal = sizeHeights[size] || '40px'

  // Map button styles using CSS custom properties for Material Web Components
  const buttonStyle = {
    display: fullWidth ? 'flex' : 'inline-flex',
    width: fullWidth ? '100%' : 'auto',
    verticalAlign: 'middle',
    ...style,
  }

  // Set the height property dynamically
  const typeKey = Tag.split('-')[1] // filled, outlined, text, filled-tonal (resolved to filled)
  const buttonType = Tag === 'md-filled-tonal-button' ? 'filled-tonal' : typeKey
  buttonStyle[`--md-${buttonType}-button-container-height`] = heightVal

  // Color overrides for semantic buttons (danger, success, tonal).
  // Material Web exposes SEPARATE tokens for icon vs label — both must be set.
  if (variant === 'danger') {
    buttonStyle['--md-filled-button-container-color']          = 'var(--ds-expense-bg)'
    buttonStyle['--md-filled-button-label-text-color']         = 'var(--ds-expense-text)'
    buttonStyle['--md-filled-button-hover-label-text-color']   = 'var(--ds-expense-text)'
    buttonStyle['--md-filled-button-focus-label-text-color']   = 'var(--ds-expense-text)'
    buttonStyle['--md-filled-button-pressed-label-text-color'] = 'var(--ds-expense-text)'
    buttonStyle['--md-filled-button-icon-color']               = 'var(--ds-expense-text)'
    buttonStyle['--md-filled-button-hover-icon-color']         = 'var(--ds-expense-text)'
    buttonStyle['--md-filled-button-focus-icon-color']         = 'var(--ds-expense-text)'
    buttonStyle['--md-filled-button-pressed-icon-color']       = 'var(--ds-expense-text)'
    buttonStyle['--md-filled-button-hover-state-layer-color']   = 'var(--ds-expense-text)'
    buttonStyle['--md-filled-button-pressed-state-layer-color'] = 'var(--ds-expense-text)'
  } else if (variant === 'success') {
    buttonStyle['--md-filled-button-container-color']          = 'var(--ds-income-bg)'
    buttonStyle['--md-filled-button-label-text-color']         = 'var(--ds-income-text)'
    buttonStyle['--md-filled-button-hover-label-text-color']   = 'var(--ds-income-text)'
    buttonStyle['--md-filled-button-focus-label-text-color']   = 'var(--ds-income-text)'
    buttonStyle['--md-filled-button-pressed-label-text-color'] = 'var(--ds-income-text)'
    buttonStyle['--md-filled-button-icon-color']               = 'var(--ds-income-text)'
    buttonStyle['--md-filled-button-hover-icon-color']         = 'var(--ds-income-text)'
    buttonStyle['--md-filled-button-focus-icon-color']         = 'var(--ds-income-text)'
    buttonStyle['--md-filled-button-pressed-icon-color']       = 'var(--ds-income-text)'
    buttonStyle['--md-filled-button-hover-state-layer-color']   = 'var(--ds-income-text)'
    buttonStyle['--md-filled-button-pressed-state-layer-color'] = 'var(--ds-income-text)'
  } else if (variant === 'tonal') {
    // Default tonal uses M3 secondary-container (gray). Override to warning amber.
    buttonStyle['--md-filled-tonal-button-container-color']          = 'var(--ds-warning-bg)'
    buttonStyle['--md-filled-tonal-button-label-text-color']         = 'var(--ds-warning-text)'
    buttonStyle['--md-filled-tonal-button-hover-label-text-color']   = 'var(--ds-warning-text)'
    buttonStyle['--md-filled-tonal-button-focus-label-text-color']   = 'var(--ds-warning-text)'
    buttonStyle['--md-filled-tonal-button-pressed-label-text-color'] = 'var(--ds-warning-text)'
    buttonStyle['--md-filled-tonal-button-icon-color']               = 'var(--ds-warning-text)'
    buttonStyle['--md-filled-tonal-button-hover-icon-color']         = 'var(--ds-warning-text)'
    buttonStyle['--md-filled-tonal-button-focus-icon-color']         = 'var(--ds-warning-text)'
    buttonStyle['--md-filled-tonal-button-pressed-icon-color']       = 'var(--ds-warning-text)'
    buttonStyle['--md-filled-tonal-button-hover-state-layer-color']   = 'var(--ds-warning-text)'
    buttonStyle['--md-filled-tonal-button-pressed-state-layer-color'] = 'var(--ds-warning-text)'
  }

  // Slotted leading icon / loader
  const leadingIcon = loading ? (
    <md-circular-progress
      slot="icon"
      indeterminate
      style={{
        '--md-circular-progress-size': '16px',
        '--md-circular-progress-active-indicator-width': '2px',
        display: 'inline-flex',
      }}
    />
  ) : icon ? (
    <span slot="icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
      {icon}
    </span>
  ) : null

  // Slotted trailing icon
  const trailingIcon = !loading && iconRight ? (
    <span slot="icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
      {iconRight}
    </span>
  ) : null

  return (
    <Tag
      ref={ref}
      disabled={isDisabled ? '' : undefined}
      onClick={handleClick}
      href={href}
      target={target}
      trailing-icon={iconRight ? '' : undefined}
      style={buttonStyle}
      class={className}
      {...rest}
    >
      {leadingIcon}
      {trailingIcon}
      {children}
    </Tag>
  )
})

export default Button
