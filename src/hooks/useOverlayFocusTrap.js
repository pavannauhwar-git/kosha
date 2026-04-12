import { useEffect, useRef } from 'react'

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

function isFocusableVisible(element) {
  if (!(element instanceof HTMLElement)) return false

  const style = window.getComputedStyle(element)
  if (style.visibility === 'hidden' || style.display === 'none') return false

  return element.getClientRects().length > 0
}

function getFocusableElements(container) {
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter((node) => {
    if (!(node instanceof HTMLElement)) return false
    if (node.getAttribute('aria-hidden') === 'true') return false
    return isFocusableVisible(node)
  })
}

/**
 * Traps keyboard focus within an overlay and restores focus on close.
 */
export default function useOverlayFocusTrap(open, options = {}) {
  const {
    onClose,
    initialFocusSelector,
    restoreFocus = true,
  } = options

  const containerRef = useRef(null)
  const previousActiveRef = useRef(null)

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined

    const container = containerRef.current
    if (!container) return undefined

    const previousActive = document.activeElement instanceof HTMLElement ? document.activeElement : null
    previousActiveRef.current = previousActive

    const focusInitial = () => {
      const targeted = initialFocusSelector
        ? container.querySelector(initialFocusSelector)
        : null
      const fallback = getFocusableElements(container)[0] || container
      const nextTarget = targeted instanceof HTMLElement ? targeted : fallback
      if (nextTarget instanceof HTMLElement) {
        nextTarget.focus({ preventScroll: true })
      }
    }

    const rafId = window.requestAnimationFrame(focusInitial)

    const handleKeyDown = (event) => {
      const active = document.activeElement
      if (!(active instanceof HTMLElement) || !container.contains(active)) return

      if (event.key === 'Escape') {
        if (typeof onClose === 'function') {
          event.preventDefault()
          onClose()
        }
        return
      }

      if (event.key !== 'Tab') return

      const focusable = getFocusableElements(container)
      if (!focusable.length) {
        event.preventDefault()
        container.focus({ preventScroll: true })
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus({ preventScroll: true })
      }

      if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus({ preventScroll: true })
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      window.cancelAnimationFrame(rafId)

      if (!restoreFocus) return

      const previous = previousActiveRef.current
      if (previous && typeof previous.focus === 'function') {
        window.requestAnimationFrame(() => {
          previous.focus({ preventScroll: true })
        })
      }
    }
  }, [open, onClose, initialFocusSelector, restoreFocus])

  return containerRef
}
