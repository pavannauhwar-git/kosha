import { AnimatePresence, motion } from 'framer-motion'
import { X } from '@phosphor-icons/react'
import useOverlayFocusTrap from '../../hooks/useOverlayFocusTrap'

/**
 * Sheet — the single overlay primitive for the app.
 *
 * Replaces every hand-rolled `.sheet-panel`, the MUI SwipeableDrawer wrapper,
 * the Radix dialog in BudgetSheet, and the raw Framer dialogs. It bakes in:
 *   - focus trapping + Escape-to-close + focus restoration (useOverlayFocusTrap)
 *   - touch-aware initial focus (won't auto-pop the mobile keyboard)
 *   - the shared `.sheet-backdrop` / `.sheet-panel` styling + spring animation
 *   - dialog a11y semantics (role="dialog", aria-modal, aria-label)
 *
 * Variants:
 *   - "bottom" (default): full-width bottom sheet (the dominant pattern)
 *   - "center": centered modal dialog (replaces EditProfileNameDialog-style overlays)
 *
 * @param {boolean}  open
 * @param {Function} onClose
 * @param {string}   [title]                 rendered in the header; also the aria-label fallback
 * @param {string}   [ariaLabel]             explicit aria-label (use when there is no visible title)
 * @param {'bottom'|'center'} [variant]
 * @param {boolean}  [dismissOnBackdrop=true] tap-outside to close (set false while saving)
 * @param {boolean}  [showHandle=true]       drag handle (bottom variant only)
 * @param {boolean}  [showClose=true]        header close (X) button
 * @param {string}   [initialFocusSelector]  selector to focus on open (desktop only; touch focuses container)
 * @param {string}   [className]             extra classes on the panel
 * @param {string}   [contentClassName]      classes on the scrollable content wrapper
 * @param {React.ReactNode} children
 */
export default function Sheet({
  open,
  onClose,
  title,
  ariaLabel,
  variant = 'bottom',
  dismissOnBackdrop = true,
  showHandle = true,
  showClose = true,
  initialFocusSelector,
  className = '',
  contentClassName = 'px-5 pt-2',
  trapFocus = true,
  children,
}) {
  const sheetRef = useOverlayFocusTrap(open && trapFocus, { onClose, initialFocusSelector })

  const isCenter = variant === 'center'
  const panelClass = isCenter ? 'sheet-panel sheet-panel--center' : 'sheet-panel'
  const enter = isCenter
    ? { initial: { y: 24, opacity: 0 }, animate: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 500, damping: 40 } }, exit: { y: 24, opacity: 0, transition: { duration: 0.2 } } }
    : { initial: { y: '100%' }, animate: { y: 0, transition: { type: 'spring', stiffness: 500, damping: 40 } }, exit: { y: '100%', transition: { duration: 0.2 } } }

  const renderPanel = () => (
    <motion.div
      ref={sheetRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel || title || 'Dialog'}
      className={`${panelClass} ${className} ${isCenter ? 'pointer-events-auto' : ''}`.trim()}
      initial={enter.initial}
      animate={enter.animate}
      exit={enter.exit}
    >
      {showHandle && !isCenter && <div className="sheet-handle" />}
      {(title || showClose) && (
        <div className={`mb-5 flex items-center justify-between px-5 ${(!showHandle || isCenter) ? 'pt-5' : 'pt-1'}`}>
          {title ? <h2 className="text-display font-bold text-ink">{title}</h2> : <span />}
          {showClose && (
            <button type="button" onClick={onClose} className="close-btn" aria-label="Close">
              <X size={16} className="text-ink-3" />
            </button>
          )}
        </div>
      )}
      <div className={contentClassName}>{children}</div>
    </motion.div>
  )

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, pointerEvents: 'none' }}
            onClick={dismissOnBackdrop ? onClose : undefined}
          />
          {isCenter ? (
            <motion.div
              key="sheet-center-wrap"
              className="fixed inset-0 z-[var(--ds-z-sheet)] flex items-center justify-center p-4 pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {renderPanel()}
            </motion.div>
          ) : (
            renderPanel()
          )}
        </>
      )}
    </AnimatePresence>
  )
}
