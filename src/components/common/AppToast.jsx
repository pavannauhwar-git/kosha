import { AnimatePresence, motion } from 'framer-motion'

export default function AppToast({ message, onDismiss, action, actionLabel }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="fixed bottom-[calc(var(--ds-nav-height)+1.25rem)] left-4 right-4 flex items-center gap-3 bg-ink dark:bg-kosha-bg backdrop-blur-md text-on-grad border border-on-grad/10 px-4 py-3 rounded-card shadow-apple-card max-w-[400px] mx-auto" style={{ zIndex: "var(--ds-z-toast)" }}
        >
          <span className="text-[13px] font-medium flex-1">{message}</span>
          {action && (
            <button
              type="button"
              onClick={action}
              className="text-brand-mid font-semibold text-xs shrink-0 px-2.5 py-1 rounded-pill bg-on-grad/15 active:bg-on-grad/25 transition-colors"
            >
              {actionLabel || 'Undo'}
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="text-on-grad/70 hover:text-on-grad text-xs font-semibold shrink-0 px-2 py-1 rounded-pill border border-on-grad/20 active:bg-on-grad/5 transition-all"
          >
            Dismiss
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
