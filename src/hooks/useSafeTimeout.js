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
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      timeoutRefs.current.forEach(clearTimeout)
      // eslint-disable-next-line react-hooks/exhaustive-deps
      timeoutRefs.current.clear()
    }
  }, [])

  return { setSafeTimeout, clearSafeTimeout }
}
