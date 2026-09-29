import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'

// Holds one pending delete at a time. `commit`, `restore` and `onError` may change
// every render; the hook reads the latest versions through a ref.
export function useUndoableDelete({ commit, restore, onError, windowMs = 4200 }) {
  const pendingRef = useRef(null)
  const handlersRef = useRef({ commit, restore, onError })
  useLayoutEffect(() => {
    handlersRef.current = { commit, restore, onError }
  })

  const run = useCallback(async (pending) => {
    if (!pending) return
    clearTimeout(pending.timeoutId)
    try {
      await handlersRef.current.commit(pending.id, pending.snapshot)
    } catch (error) {
      handlersRef.current.restore?.(pending.snapshot)
      handlersRef.current.onError?.(error)
    }
  }, [])

  const flush = useCallback(() => {
    const pending = pendingRef.current
    pendingRef.current = null
    return run(pending)
  }, [run])

  const schedule = useCallback((id, snapshot) => {
    const current = pendingRef.current
    if (current && current.id !== id) void flush()
    else if (current) clearTimeout(current.timeoutId)

    const timeoutId = setTimeout(() => {
      if (pendingRef.current?.id === id) void flush()
    }, windowMs)
    pendingRef.current = { id, snapshot, timeoutId }
  }, [flush, windowMs])

  const undo = useCallback((id) => {
    const pending = pendingRef.current
    if (!pending || pending.id !== id) return false
    clearTimeout(pending.timeoutId)
    pendingRef.current = null
    handlersRef.current.restore?.(pending.snapshot)
    return true
  }, [])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') void flush()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flush)
      void flush()
    }
  }, [flush])

  return { schedule, undo, flush }
}
