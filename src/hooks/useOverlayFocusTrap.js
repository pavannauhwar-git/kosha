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
    
    // Traverses ancestors up to the trapped container to skip elements in any aria-hidden="true" subtrees
    let current = node
    while (current && current !== container) {
      if (current.getAttribute('aria-hidden') === 'true') return false
      current = current.parentElement
    }
    
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

  const onCloseRef = useRef(onClose)
  const initialFocusSelectorRef = useRef(initialFocusSelector)
  const restoreFocusRef = useRef(restoreFocus)

  // Sync refs with the latest prop values on every render without triggering effect runs
  useEffect(() => {
    onCloseRef.current = onClose
    initialFocusSelectorRef.current = initialFocusSelector
    restoreFocusRef.current = restoreFocus
  })

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined

    const container = containerRef.current
    if (!container) return undefined

    const previousActive = document.activeElement instanceof HTMLElement ? document.activeElement : null
    previousActiveRef.current = previousActive

    const focusInitial = () => {
      const targeted = initialFocusSelectorRef.current
        ? container.querySelector(initialFocusSelectorRef.current)
        : null
      const fallback = getFocusableElements(container)[0] || container
      let nextTarget = targeted instanceof HTMLElement ? targeted : fallback

      // On touch/mobile devices, avoid programmatically focusing inputs/textareas/selects/editable elements
      // on initial mount to prevent the virtual keyboard from automatically popping up and covering the sheet.
      const isTouchDevice = typeof window !== 'undefined' && ('ontouchstart' in window || (navigator && navigator.maxTouchPoints > 0));
      if (isTouchDevice && nextTarget instanceof HTMLElement) {
        const tagName = nextTarget.tagName.toLowerCase();
        const isInput = tagName === 'input' || tagName === 'textarea' || tagName === 'select' || nextTarget.isContentEditable;
        if (isInput) {
          nextTarget = container;
        }
      }

      if (nextTarget instanceof HTMLElement) {
        nextTarget.focus({ preventScroll: true })
      }
    }

    // Shift focus synchronously to immediately prevent aria-hidden timing race conditions.
    focusInitial()
    const rafId = window.requestAnimationFrame(focusInitial)

    const handleKeyDown = (event) => {
      const active = document.activeElement
      const insideContainer = active instanceof HTMLElement && container.contains(active)

      if (event.key === 'Escape') {
        const currentOnClose = onCloseRef.current
        if (typeof currentOnClose === 'function') {
          event.preventDefault()
          currentOnClose()
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

      // Focus escaped the overlay (e.g. on <body>): pull it back in.
      if (!insideContainer) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus({ preventScroll: true })
        return
      }

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

      // Explicitly blur active text inputs/textareas inside the container before unmounting
      // to prevent iOS Safari from keeping the native typing/undo session active.
      if (container && document.activeElement instanceof HTMLElement && container.contains(document.activeElement)) {
        const tagName = document.activeElement.tagName.toLowerCase()
        if (tagName === 'input' || tagName === 'textarea' || document.activeElement.isContentEditable) {
          document.activeElement.blur()
        }
      }

      if (!restoreFocusRef.current) return

      const previous = previousActiveRef.current
      if (previous && typeof previous.focus === 'function') {
        window.requestAnimationFrame(() => {
          previous.focus({ preventScroll: true })
        })
      }
    }
  }, [open])

  return containerRef
}
