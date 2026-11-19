import { forwardRef, useEffect, useRef } from 'react'
import '@material/web/switch/switch.js'

/**
 * Switch — High-performance, premium Switch wrapping official Google Material 3 Web Component (<md-switch>).
 * `decorative` is for rows that are themselves the switch (role="switch"):
 * the visual switch is then hidden from screen readers, focus and taps.
 */
const Switch = forwardRef(function Switch(
  { checked, onChange, disabled, decorative = false, className = '', style = {}, _sx, ...props },
  ref
) {
  const innerRef = useRef(null)
  const resolvedRef = ref || innerRef

  useEffect(() => {
    const el = resolvedRef.current
    if (!el) return

    const handleChange = (e) => {
      if (onChange) {
        // Mock a standard React event target structure to keep compatibility with existing handlers
        onChange({
          ...e,
          target: {
            ...e.target,
            checked: el.selected,
            value: el.selected,
          }
        })
      }
    }

    el.addEventListener('change', handleChange)
    return () => el.removeEventListener('change', handleChange)
  }, [onChange, resolvedRef])

  if (decorative) {
    return (
      <md-switch
        ref={resolvedRef}
        selected={checked ? '' : undefined}
        disabled={disabled ? '' : undefined}
        inert=""
        aria-hidden="true"
        tabIndex={-1}
        class={className}
        style={style}
      />
    )
  }

  return (
    <md-switch
      ref={resolvedRef}
      selected={checked ? '' : undefined}
      disabled={disabled ? '' : undefined}
      aria-label={props['aria-label'] || props.ariaLabel || 'Toggle'}
      class={className}
      style={style}
      {...props}
    />
  )
})

export default Switch
