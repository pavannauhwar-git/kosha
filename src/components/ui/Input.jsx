import { forwardRef, useEffect, useRef } from 'react'
import '@material/web/textfield/outlined-text-field.js'

/**
 * Input — Wraps official Google Material 3 Web Component (<md-outlined-text-field>)
 */
const Input = forwardRef(function Input(
  {
    label,
    placeholder,
    value,
    onChange,
    type = 'text',
    error,
    helperText,
    disabled,
    icon,
    iconRight,
    autoFocus,
    className = '',
    style = {},
    _sx, // MUI-specific styling, mapped if needed
    ...rest
  },
  ref
) {
  const innerRef = useRef(null)
  const resolvedRef = ref || innerRef

  useEffect(() => {
    const el = resolvedRef.current
    if (!el) return

    const handleInput = (e) => {
      // In React 18, Custom Elements do not dispatch synthetic onChange events automatically.
      // We manually bind the native input event listener and fire onChange.
      if (onChange) {
        onChange(e)
      }
    }

    el.addEventListener('input', handleInput)
    return () => el.removeEventListener('input', handleInput)
  }, [onChange, resolvedRef])

  const hasError = Boolean(error)
  const resolvedHelperText = error || helperText

  return (
    <md-outlined-text-field
      ref={resolvedRef}
      label={label}
      placeholder={placeholder}
      value={value ?? ''}
      type={type}
      disabled={disabled ? '' : undefined}
      autofocus={autoFocus ? '' : undefined}
      error={hasError ? '' : undefined}
      error-text={hasError ? resolvedHelperText : undefined}
      supporting-text={!hasError ? resolvedHelperText : undefined}
      style={{
        width: '100%',
        ...style,
      }}
      class={className}
      {...rest}
    >
      {icon && (
        <span slot="leading-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
          {icon}
        </span>
      )}
      {iconRight && (
        <span slot="trailing-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
          {iconRight}
        </span>
      )}
    </md-outlined-text-field>
  )
})

export default Input
