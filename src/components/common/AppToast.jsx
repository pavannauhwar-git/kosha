import { AnimatePresence, motion } from 'framer-motion'

export default function AppToast({ message, onDismiss }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-[calc(var(--nav-height)+1rem)] left-4 right-4 md:left-[236px] md:bottom-8 z-50 flex items-center gap-3 bg-ink text-white px-4 py-3 rounded-card shadow-card-lg"
        >
          <span className="text-[13px] font-medium flex-1">{message}</span>
          <button
            type="button"
            onClick={onDismiss}
            className="text-white/80 hover:text-white text-xs font-semibold shrink-0 px-2 py-1 rounded-pill border border-white/20 active:opacity-100"
          >
            Dismiss
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
