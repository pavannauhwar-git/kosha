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
export function useScrollDirection(resetKey) {
  const initialY = typeof window !== 'undefined' ? window.scrollY : 0
  const [scrolledDown, setScrolledDown] = useState(false)
  const lastY   = useRef(initialY)
  const ticking = useRef(false)
  const ignoreUntil = useRef(0)

  useEffect(() => {
    if (typeof window === 'undefined') return

    lastY.current = window.scrollY
    setScrolledDown(false)

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
    ignoreUntil.current = now + 280
  }, [resetKey])

  useEffect(() => {
    let rafId = null

    const update = () => {
      const y = window.scrollY
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now()

      if (now < ignoreUntil.current) {
        // Ignore automatic layout/restore scroll jitter during skeleton -> page swap.
        lastY.current = y
        ticking.current = false
        return
      }

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
        rafId = requestAnimationFrame(update)
        ticking.current = true
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (rafId != null) cancelAnimationFrame(rafId)
    }
  }, [])

  return scrolledDown
}
