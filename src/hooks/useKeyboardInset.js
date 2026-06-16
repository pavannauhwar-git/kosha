import { useEffect } from 'react'

/**
 * Tracks the on-screen keyboard inset via the VisualViewport API and publishes
 * it as the CSS var `--kb-inset` on <html>. Fixes the iOS standalone-PWA bug
 * where a position:fixed bottom sheet floats up when the keyboard opens and
 * leaves the sheet (and the bottom nav) displaced after it closes.
 *
 * Mount ONCE at the app shell (see Step 0.2).
 */
export default function useKeyboardInset() {
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!vv) return undefined

    const root = document.documentElement
    let raf = 0

    const apply = () => {
      // Pixels at the bottom currently covered by the keyboard (and any inset).
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      root.style.setProperty('--kb-inset', `${Math.round(inset)}px`)
      // When the keyboard has fully closed, snap any residual page scroll back
      // to the top so fixed bottom:0 elements (the nav) are not left displaced.
      if (inset <= 1 && window.scrollY !== 0) {
        window.scrollTo(0, 0)
      }
    }

    const onChange = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(apply)
    }

    apply()
    vv.addEventListener('resize', onChange)
    vv.addEventListener('scroll', onChange)
    return () => {
      cancelAnimationFrame(raf)
      vv.removeEventListener('resize', onChange)
      vv.removeEventListener('scroll', onChange)
      root.style.removeProperty('--kb-inset')
    }
  }, [])

  return null
}
