import { forwardRef, useEffect, useRef } from 'react'
import '@material/web/switch/switch.js'

/**
 * Switch — Wraps official Google Material 3 Web Component (<md-switch>)
 */
const Switch = forwardRef(function Switch(
  { checked, onChange, disabled, className = '', style = {}, sx, ...props },
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
        // Create a synthetic-like event wrapper or just pass the native event
        onChange(e)
      }
    }

    el.addEventListener('change', handleChange)
    return () => el.removeEventListener('change', handleChange)
  }, [onChange, resolvedRef])

  // Sync the boolean property imperatively to avoid React boolean attribute coercion issues
  useEffect(() => {
    if (resolvedRef.current) {
      resolvedRef.current.selected = !!checked
    }
  }, [checked, resolvedRef])

  // Extract pointer-events from MUI style overrides sx (e.g. sx={{ pointerEvents: 'none' }})
  const pointerEvents = sx?.pointerEvents || style.pointerEvents

  return (
    <md-switch
      ref={resolvedRef}
      disabled={disabled}
      class={className}
      style={{
        ...style,
        pointerEvents: pointerEvents || undefined,
      }}
      {...props}
    />
  )
})

export default Switch
