import { useState, useEffect, useRef, useCallback } from 'react'

// Lightweight, app-wide pull-to-refresh for touch devices.
// Works when the window is scrolled to the very top; shows a small pill
// near the status bar and calls onRefresh() once the user pulls far enough.
function usePullToRefresh(onRefresh, { threshold = 80 } = {}) {
  const [distance, setDistance]   = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  const startYRef   = useRef(null)
  const pullingRef  = useRef(false)

  const handleRefresh = useCallback(async () => {
    if (!onRefresh) return
    setRefreshing(true)
    try {
      await Promise.resolve(onRefresh())
    } finally {
      setRefreshing(false)
    }
  }, [onRefresh])

  useEffect(() => {
    function onTouchStart(e) {
      if (window.scrollY > 0 || refreshing) return
      const t = e.touches[0]
      startYRef.current  = t.clientY
      pullingRef.current = true
      setDistance(0)
    }

    function onTouchMove(e) {
      if (!pullingRef.current || refreshing) return
      const t  = e.touches[0]
      const dy = t.clientY - startYRef.current
      if (dy <= 0) return

      if (window.scrollY > 0) {
        pullingRef.current = false
        setDistance(0)
        return
      }

      // Prevent the default rubber-band scroll so our indicator feels anchored.
      try {
        e.preventDefault()
      } catch {
        /* noop */
      }

      const capped = Math.min(dy, threshold * 1.6)
      setDistance(capped)
    }

    function onTouchEnd() {
      if (!pullingRef.current || refreshing) {
        pullingRef.current = false
        setDistance(0)
        return
      }

      const shouldRefresh = distance >= threshold
      pullingRef.current  = false
      setDistance(0)

      if (shouldRefresh) {
        handleRefresh()
      }
    }

    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove',  onTouchMove,  { passive: false })
    window.addEventListener('touchend',   onTouchEnd)

    return () => {
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove',  onTouchMove)
      window.removeEventListener('touchend',   onTouchEnd)
    }
  }, [distance, refreshing, threshold, handleRefresh])

  const progress = Math.min(distance / threshold, 1)

  return { distance, progress, refreshing }
}

export default function PullToRefresh({ onRefresh }) {
  const { distance, progress, refreshing } = usePullToRefresh(onRefresh)

  const maxOffset = 56
  const translateY = refreshing
    ? 0
    : -maxOffset + distance * 0.4

  const label = refreshing
    ? 'Refreshing…'
    : progress < 1
      ? 'Pull to refresh'
      : 'Release to refresh'

  return (
    <div
      className="fixed top-0 left-0 right-0 z-20 flex justify-center pointer-events-none"
      style={{ transform: `translateY(${translateY}px)` }}
    >
      <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-kosha-surface border border-kosha-border shadow-card text-[11px] font-medium text-ink-3 pointer-events-auto">
        <div
          className={`w-4 h-4 rounded-full border-2 border-brand border-t-transparent ${refreshing ? 'animate-spin' : ''}`}
          style={!refreshing ? { transform: `rotate(${progress * 180}deg)` } : {}}
        />
        <span>{label}</span>
      </div>
    </div>
  )
}

