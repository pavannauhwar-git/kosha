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
          className="fixed bottom-[calc(var(--nav-height)+1rem)] left-4 right-4 z-50 flex items-center gap-3 bg-ink dark:bg-kosha-surface text-white dark:text-ink border border-transparent dark:border-kosha-border px-4 py-3 rounded-card shadow-card-lg max-w-[398px] mx-auto"
        >
          <span className="text-[13px] font-medium flex-1">{message}</span>
          {action && (
            <button
              type="button"
              onClick={action}
              className="text-brand-mid font-semibold text-xs shrink-0 px-2.5 py-1 rounded-pill bg-white/15 dark:bg-brand/10 active:bg-white/25 dark:active:bg-brand/20"
            >
              {actionLabel || 'Undo'}
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="text-white/80 dark:text-ink-2 hover:text-white dark:hover:text-ink text-xs font-semibold shrink-0 px-2 py-1 rounded-pill border border-white/20 dark:border-kosha-border active:opacity-100"
          >
            Dismiss
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
