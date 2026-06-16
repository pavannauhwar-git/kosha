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
    // Tracks the previous keyboard state so the scroll correction only runs on
    // the open→close transition — NOT on every viewport event. iOS fires the
    // visualViewport 'scroll'/'resize' events continuously during normal page
    // scrolling (dynamic toolbar show/hide, rubber-band overscroll). The old
    // unconditional `scrollTo(0,0)` on `inset <= 1` therefore yanked the page
    // back to the top mid-scroll.
    let keyboardWasOpen = false

    // A fixed bottom sheet / centered dialog repositions itself above the
    // keyboard via the --kb-inset CSS var. iOS additionally scrolls the layout
    // viewport to reveal the focused input, which double-shifts the overlay and
    // pushes its top off the top of the screen. While such an overlay is open
    // we keep the page pinned at the top so the --kb-inset lift is the single
    // source of truth.
    const hasFixedOverlay = () =>
      !!document.querySelector('.sheet-panel, [aria-modal="true"]')

    const apply = () => {
      // Pixels at the bottom currently covered by the keyboard (and any inset).
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      root.style.setProperty('--kb-inset', `${Math.round(inset)}px`)

      const keyboardOpen = inset > 1
      const keyboardJustClosed = keyboardWasOpen && !keyboardOpen
      keyboardWasOpen = keyboardOpen

      if (keyboardOpen) {
        // Prevent iOS from scrolling the focused input (and the overlay holding
        // it) above the top edge of the screen.
        if (hasFixedOverlay() && window.scrollY !== 0) {
          window.scrollTo(0, 0)
        }
      } else if (keyboardJustClosed && window.scrollY !== 0) {
        // Keyboard fully closed — snap any residual page displacement back so
        // fixed bottom:0 elements (the nav) are not left floating.
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
