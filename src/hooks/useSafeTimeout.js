import { useEffect, useRef, useCallback } from 'react'

export function useSafeTimeout() {
  const timeoutRefs = useRef(new Set())

  const setSafeTimeout = useCallback((callback, delay) => {
    const id = setTimeout(() => {
      timeoutRefs.current.delete(id)
      callback()
    }, delay)
    timeoutRefs.current.add(id)
    return id
  }, [])

  const clearSafeTimeout = useCallback((id) => {
    clearTimeout(id)
    timeoutRefs.current.delete(id)
  }, [])

  useEffect(() => {
    const refs = timeoutRefs.current
    return () => {
      refs.forEach(clearTimeout)
      refs.clear()
    }
  }, [])

  return { setSafeTimeout, clearSafeTimeout }
}
