import { forwardRef, useCallback, useEffect, useRef } from 'react'
import '@material/web/switch/switch.js'

/**
 * Switch — Wraps official Google Material 3 Web Component (<md-switch>)
 */
const Switch = forwardRef(function Switch(
  { checked, onChange, disabled, className = '', style = {}, sx, ...props },
  ref
) {
  const innerRef = useRef(null)
  const setRefs = useCallback((node) => {
    innerRef.current = node
    if (typeof ref === 'function') {
      ref(node)
    } else if (ref && typeof ref === 'object') {
      ref.current = node
    }
  }, [ref])

  useEffect(() => {
    const el = innerRef.current
    if (!el) return

    const handleChange = (e) => {
      // In React 18, Custom Elements do not dispatch synthetic onChange events automatically.
      // We manually bind the native change event listener and fire onChange.
      if (onChange) {
        // Create a synthetic-like event wrapper or just pass the native event
        onChange(e)
      }
    }

    el.addEventListener('change', handleChange)
    return () => el.removeEventListener('change', handleChange)
  }, [onChange])

  // Sync the boolean property imperatively to avoid React boolean attribute coercion issues
  useEffect(() => {
    if (innerRef.current) {
      innerRef.current.selected = !!checked
    }
  }, [checked])

  // Keep disabled state in sync via property (custom element boolean behavior).
  useEffect(() => {
    if (innerRef.current) {
      innerRef.current.disabled = !!disabled
    }
  }, [disabled])

  // Extract pointer-events from MUI style overrides sx (e.g. sx={{ pointerEvents: 'none' }})
  const pointerEvents = sx?.pointerEvents || style.pointerEvents

  return (
    <md-switch
      ref={setRefs}
      class={className}
      aria-disabled={disabled ? 'true' : undefined}
      style={{
        ...style,
        pointerEvents: pointerEvents || undefined,
        opacity: disabled && style.opacity === undefined ? 0.38 : style.opacity,
      }}
      {...props}
    />
  )
})

export default Switch
