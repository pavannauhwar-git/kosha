import { useEffect } from 'react'

// Smallest viewport shrink treated as an on-screen keyboard. Browser toolbars
// sliding in and out and rubber-band overscroll move the visual viewport by
// less than this during a fast fling.
const MIN_KEYBOARD_PX = 120

const NON_TEXT_INPUT_TYPES = new Set([
  'button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit',
])

function isTextEntry(el) {
  if (!el || el === document.body) return false
  if (el.isContentEditable) return true
  const tag = el.tagName
  if (tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'MD-OUTLINED-TEXT-FIELD') return true
  if (tag === 'INPUT') return !NON_TEXT_INPUT_TYPES.has(String(el.type || 'text').toLowerCase())
  return false
}

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
    // The scroll correction only runs on the open→close transition. Browsers
    // fire visualViewport 'scroll'/'resize' continuously during normal page
    // scrolling, so the keyboard only counts as open while a text field has
    // focus and the viewport has shrunk by a keyboard's height. Otherwise a
    // fling that moves the toolbar or bounces at the end looks like a keyboard
    // opening and closing, and the page jumps.
    let keyboardWasOpen = false
    // Page position when a field was focused, before iOS scrolls it into view.
    let scrollBeforeKeyboard = null

    // A fixed bottom sheet / centered dialog repositions itself above the
    // keyboard via the --kb-inset CSS var. iOS additionally scrolls the layout
    // viewport to reveal the focused input, which double-shifts the overlay and
    // pushes its top off the top of the screen. While such an overlay is open
    // we keep the page pinned at the top so the --kb-inset lift is the single
    // source of truth.
    const hasFixedOverlay = () =>
      !!document.querySelector('.sheet-panel, [aria-modal="true"]')

    const apply = () => {
      // Shield against pinch-zoom or accessibility page zooms on iOS: if scaled,
      // vv.height changes which creates a fake keyboard offset. We clamp inset to 0 in this case.
      const scale = vv.scale || 1
      const editing = isTextEntry(document.activeElement)
      const inset = editing && scale <= 1.01
        ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
        : 0
      root.style.setProperty('--kb-inset', `${Math.round(inset)}px`)

      const keyboardOpen = inset >= MIN_KEYBOARD_PX
      const keyboardJustClosed = keyboardWasOpen && !keyboardOpen
      keyboardWasOpen = keyboardOpen

      if (keyboardOpen) {
        // Prevent iOS from scrolling the focused input (and the overlay holding
        // it) above the top edge of the screen.
        if (hasFixedOverlay() && window.scrollY !== 0) {
          window.scrollTo(0, 0)
        }
      } else if (keyboardJustClosed) {
        // Keyboard fully closed — undo the page displacement iOS added so
        // fixed bottom:0 elements (the nav) are not left floating. Sheets
        // restore the list position themselves when they close.
        const target = hasFixedOverlay() ? 0 : (scrollBeforeKeyboard ?? window.scrollY)
        scrollBeforeKeyboard = null
        if (Math.abs(window.scrollY - target) > 1) window.scrollTo(0, target)
      }
    }

    const onChange = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(apply)
    }

    const onFocusIn = (event) => {
      if (!keyboardWasOpen && isTextEntry(event.target)) scrollBeforeKeyboard = window.scrollY
      onChange()
    }

    apply()
    vv.addEventListener('resize', onChange)
    vv.addEventListener('scroll', onChange)
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onChange)
    return () => {
      cancelAnimationFrame(raf)
      vv.removeEventListener('resize', onChange)
      vv.removeEventListener('scroll', onChange)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onChange)
      root.style.removeProperty('--kb-inset')
    }
  }, [])

  return null
}
