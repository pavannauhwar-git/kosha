import { forwardRef, useEffect, useRef } from 'react'
import '@material/web/select/outlined-select.js'
import '@material/web/select/select-option.js'

/**
 * Select — Premium, unified select component wrapping official Google Material 3 Web Component (<md-outlined-select>)
 */
const Select = forwardRef(function Select(
  {
    label,
    value,
    onChange,
    options = [], // [{ value: '...', label: '...' }]
    error,
    helperText,
    disabled,
    className = '',
    fullWidth = true,
    _size, // Ignored in M3 Select
    placeholder,
    style = {},
    _sx, // Ignored in M3 Select
    ...rest
  },
  ref
) {
  const innerRef = useRef(null)
  const resolvedRef = ref || innerRef

  useEffect(() => {
    const el = resolvedRef.current
    if (!el) return

    const handleChange = (e) => {
      // In React 18, Custom Elements do not dispatch synthetic onChange events automatically.
      // We manually bind the native change event listener and fire onChange.
      if (onChange) {
        onChange(e)
      }
    }

    el.addEventListener('change', handleChange)
    return () => el.removeEventListener('change', handleChange)
  }, [onChange, resolvedRef])

  const hasError = Boolean(error)
  const resolvedHelperText = error || helperText

  return (
    <md-outlined-select
      ref={resolvedRef}
      label={label}
      value={value ?? ''}
      disabled={disabled ? '' : undefined}
      error={hasError ? '' : undefined}
      error-text={hasError ? resolvedHelperText : undefined}
      supporting-text={!hasError ? resolvedHelperText : undefined}
      style={{
        width: fullWidth ? '100%' : 'auto',
        ...style,
      }}
      class={className}
      {...rest}
    >
      {placeholder && (
        <md-select-option value="" disabled>
          <div slot="headline">{placeholder}</div>
        </md-select-option>
      )}
      {options.map((opt) => (
        <md-select-option key={opt.value} value={opt.value}>
          <div slot="headline">{opt.label}</div>
        </md-select-option>
      ))}
    </md-outlined-select>
  )
})

export default Select
