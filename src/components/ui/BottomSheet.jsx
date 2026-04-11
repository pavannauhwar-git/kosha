import { useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform, useDragControls } from 'framer-motion'
import * as Dialog from '@radix-ui/react-dialog'

/**
 * BottomSheet — gesture-dismissable on mobile, centered modal on desktop
 * @param {{ open: boolean, onClose: function, title?: string, description?: string, children: React.ReactNode, className?: string }} props
 */
export default function BottomSheet({
  open,
  onClose,
  title,
  description = 'Dialog content.',
  children,
  className = '',
}) {
  const sheetRef = useRef(null)
  const y = useMotionValue(0)
  const backdropOpacity = useTransform(y, [0, 300], [1, 0])

  const handleDragEnd = useCallback((_, info) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose()
    }
  }, [onClose])

  useEffect(() => {
    if (open) {
      y.set(0)
    }
  }, [open, y])

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-40"
                style={{
                  background: 'rgba(17, 19, 24, 0.40)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  opacity: backdropOpacity,
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              />
            </Dialog.Overlay>

            <Dialog.Content asChild>
              <motion.div
                ref={sheetRef}
                className={[
                  'fixed z-50 focus:outline-none',
                  'bottom-0 left-0 right-0 md:bottom-auto md:top-1/2 md:left-1/2',
                  'md:-translate-x-1/2 md:-translate-y-1/2',
                  'w-full md:max-w-lg md:rounded-2xl',
                  'bg-[var(--ds-surface)] rounded-t-3xl md:rounded-3xl',
                  'shadow-xl',
                  className,
                ].join(' ')}
                style={{
                  maxHeight: 'calc(100dvh - var(--ds-safe-top, 0px) - 0.5rem)',
                  paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))',
                  y,
                }}
                initial={{ y: '100%', opacity: 0.8 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 32, stiffness: 400 }}
                drag="y"
                dragConstraints={{ top: 0 }}
                dragElastic={0.2}
                onDragEnd={handleDragEnd}
                aria-label={title || 'Sheet'}
              >
                {/* Drag handle */}
                <div className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing md:hidden" aria-hidden="true">
                  <div className="w-10 h-1 rounded-full bg-[var(--ds-text-disabled)]" />
                </div>

                {/* Header */}
                {title && (
                  <div className="flex items-center justify-between px-6 pb-4">
                    <Dialog.Title className="text-lg font-bold text-[var(--ds-text)]">
                      {title}
                    </Dialog.Title>
                    <Dialog.Close asChild>
                      <button
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--ds-surface-container)] text-[var(--ds-text-tertiary)] hover:bg-[var(--ds-surface-container-high)] transition-colors"
                        aria-label="Close"
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </button>
                    </Dialog.Close>
                  </div>
                )}

                <Dialog.Description className="sr-only">
                  {description}
                </Dialog.Description>

                {/* Scrollable content */}
                <div className="overflow-y-auto px-6" style={{ maxHeight: 'calc(100dvh - 10rem)' }}>
                  {children}
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
