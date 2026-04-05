import { motion } from 'framer-motion'

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
}

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondaryAction,
  className = '',
}) {
  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className={`card empty-state py-10 px-6 flex flex-col items-center text-center ${className}`.trim()}
    >
      {icon ? (
        <motion.div
          variants={fadeUp}
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
          className="w-16 h-16 rounded-full bg-kosha-surface-2 flex items-center justify-center mb-4"
        >
          {icon}
        </motion.div>
      ) : null}

      <motion.p variants={fadeUp} className="text-[17px] font-bold text-ink mb-2">{title}</motion.p>
      <motion.p variants={fadeUp} className="text-label text-ink-3 mb-5 max-w-[240px] leading-relaxed">{description}</motion.p>

      {(actionLabel && onAction) || (secondaryLabel && onSecondaryAction) ? (
        <motion.div variants={fadeUp} className="flex items-center justify-center gap-2 flex-wrap">
          {actionLabel && onAction ? (
            <button
              type="button"
              onClick={onAction}
              className="px-6 py-2.5 rounded-pill bg-brand text-white text-label font-semibold active:scale-[0.97] transition-transform duration-75"
            >
              {actionLabel}
            </button>
          ) : null}

          {secondaryLabel && onSecondaryAction ? (
            <button
              type="button"
              onClick={onSecondaryAction}
              className="px-4 py-2.5 rounded-pill bg-kosha-surface border border-kosha-border text-label font-semibold text-ink-2 active:scale-[0.97] transition-transform duration-75"
            >
              {secondaryLabel}
            </button>
          ) : null}
        </motion.div>
      ) : null}
    </motion.div>
  )
}
