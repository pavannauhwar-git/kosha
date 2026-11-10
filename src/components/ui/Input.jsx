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
    enterKeyHint,
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

  useEffect(() => {
    const el = resolvedRef.current
    if (el && value !== undefined && el.value !== value) {
      el.value = value
    }
  }, [value, resolvedRef])

  // The real <input> lives in the shadow root, has no form owner and never
  // sees enterkeyhint, so the keyboard's Go/Next key does nothing by default.
  useEffect(() => {
    const el = resolvedRef.current
    if (!el || type === 'textarea') return undefined

    const handleKeyDown = (e) => {
      if (e.key !== 'Enter' || e.isComposing || e.defaultPrevented) return
      const form = el.closest('form')
      if (!form) return
      e.preventDefault()
      if (enterKeyHint === 'next') {
        const fields = Array.from(form.querySelectorAll('md-outlined-text-field:not([disabled])'))
        const next = fields[fields.indexOf(el) + 1]
        if (next) {
          next.focus()
          return
        }
      }
      if (typeof form.requestSubmit === 'function') form.requestSubmit()
      else form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    }

    el.addEventListener('keydown', handleKeyDown)
    return () => el.removeEventListener('keydown', handleKeyDown)
  }, [enterKeyHint, type, resolvedRef])

  useEffect(() => {
    const el = resolvedRef.current
    if (!el) return undefined
    let cancelled = false
    Promise.resolve(el.updateComplete).then(() => {
      if (cancelled) return
      const inner = el.shadowRoot?.querySelector('input, textarea')
      if (!inner) return
      if (enterKeyHint) inner.setAttribute('enterkeyhint', enterKeyHint)
      else inner.removeAttribute('enterkeyhint')
    })
    return () => { cancelled = true }
  }, [enterKeyHint, type, resolvedRef])

  useEffect(() => {
    const el = resolvedRef.current
    if (!el || !autoFocus) return undefined
    let cancelled = false
    Promise.resolve(el.updateComplete).then(() => {
      if (!cancelled) el.focus()
    })
    return () => { cancelled = true }
  }, [autoFocus, resolvedRef])

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
      error={hasError ? '' : undefined}
      error-text={hasError ? resolvedHelperText : undefined}
      supporting-text={!hasError ? resolvedHelperText : undefined}
      style={{
        width: '100%',
        ...style,
      }}
      class={className}
      onPointerUp={() => {
        // Bypass Safari 2-tap swallow when keyboard is open
        if (resolvedRef.current) {
          resolvedRef.current.focus()
        }
      }}
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
