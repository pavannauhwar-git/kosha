import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Single-slot toast state. This is a 1:1 extraction of the pushToast/dismissToast
 * helpers currently duplicated in Transactions/Bills/Loans, so those pages can
 * delete their local copies WITHOUT changing a single call site.
 *  - pushToast(message, { action, actionLabel = 'Undo', duration = 3600 })
 *  - duration <= 0 keeps the toast until dismissed (Transactions relies on this).
 */
export default function useToast() {
  const [toast, setToast] = useState(null)
  const [toastAction, setToastAction] = useState(null)
  const [toastActionLabel, setToastActionLabel] = useState(null)
  const toastTimeoutRef = useRef(null)

  const dismissToast = useCallback(() => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current)
      toastTimeoutRef.current = null
    }
    setToast(null)
    setToastAction(null)
    setToastActionLabel(null)
  }, [])

  const pushToast = useCallback((message, options = {}) => {
    const { action = null, actionLabel = 'Undo', duration = 3600 } = options
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current)
      toastTimeoutRef.current = null
    }
    setToast(message)
    if (typeof action === 'function') {
      setToastAction(() => action)
      setToastActionLabel(actionLabel)
    } else {
      setToastAction(null)
      setToastActionLabel(null)
    }
    if (duration > 0) {
      toastTimeoutRef.current = setTimeout(() => {
        setToast(null)
        setToastAction(null)
        setToastActionLabel(null)
        toastTimeoutRef.current = null
      }, duration)
    }
  }, [])

  useEffect(() => () => { if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current) }, [])

  return { toast, toastAction, toastActionLabel, pushToast, dismissToast }
}
