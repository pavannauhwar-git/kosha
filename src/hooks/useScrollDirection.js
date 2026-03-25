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

  useEffect(() => {
    const update = () => {
      const y = window.scrollY

      if (y < 60) {
        // Always show full nav near the top
        setScrolledDown(false)
      } else if (y > lastY.current + 6) {
        // Scrolling down — shrink
        setScrolledDown(true)
      } else if (y < lastY.current - 6) {
        // Scrolling up — expand
        setScrolledDown(false)
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
