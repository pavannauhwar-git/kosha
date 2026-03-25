import { useState, useEffect, useRef } from 'react'

/**
 * useScrollDirection
 *
 * Returns `true` when the user has scrolled down past the threshold
 * and is actively moving down — signals the nav to shrink.
 * Returns `false` at the top or when scrolling back up.
 *
 * Uses requestAnimationFrame to batch updates (no jank).
 * Passive scroll listener — zero main-thread blocking.
 */
export function useScrollDirection() {
  const [scrolledDown, setScrolledDown] = useState(false)
  const lastY   = useRef(0)
  const ticking = useRef(false)
  const downAccum = useRef(0)
  const upAccum = useRef(0)

  useEffect(() => {
    const TOP_ALWAYS_SHOW = 80
    const MIN_Y_TO_HIDE = 140
    const HIDE_INTENT_DELTA = 24
    const SHOW_INTENT_DELTA = 12

    lastY.current = window.scrollY || 0

    const update = () => {
      const y = window.scrollY
      const dy = y - lastY.current

      if (y <= TOP_ALWAYS_SHOW) {
        // Keep navigation fully visible near the top of the page.
        setScrolledDown(false)
        downAccum.current = 0
        upAccum.current = 0
      } else {
        if (dy > 0) {
          downAccum.current += dy
          upAccum.current = 0
        } else if (dy < 0) {
          upAccum.current += Math.abs(dy)
          downAccum.current = 0
        }

        // Hide only after clear downward intent and enough scroll depth.
        if (!scrolledDown && y > MIN_Y_TO_HIDE && downAccum.current >= HIDE_INTENT_DELTA) {
          setScrolledDown(true)
          downAccum.current = 0
          upAccum.current = 0
        }

        // Show again with a smaller upward gesture threshold.
        if (scrolledDown && upAccum.current >= SHOW_INTENT_DELTA) {
          setScrolledDown(false)
          downAccum.current = 0
          upAccum.current = 0
        }
      }

      lastY.current  = y
      ticking.current = false
    }

    const onScroll = () => {
      if (!ticking.current) {
        requestAnimationFrame(update)
        ticking.current = true
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return scrolledDown
}
