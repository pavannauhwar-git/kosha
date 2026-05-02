import { motion } from 'framer-motion'
import Button from '../ui/Button'

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.05, 0.7, 0.1, 1] } },
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
}

export default function EmptyState({
  icon,
  imageUrl,
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
      {imageUrl ? (
        <motion.div variants={fadeUp} className="mb-4 flex items-center justify-center">
          <img src={imageUrl} alt="Empty State Illustration" className="max-h-[220px] w-auto object-contain illustration" />
        </motion.div>
      ) : icon ? (
        <motion.div
          variants={fadeUp}
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
          className="w-16 h-16 rounded-full bg-[var(--ds-primary-container)] flex items-center justify-center mb-4"
        >
          {icon}
        </motion.div>
      ) : null}

      <motion.p variants={fadeUp} className="text-[17px] font-bold text-[var(--ds-text)] mb-2">{title}</motion.p>
      <motion.p variants={fadeUp} className="text-label text-[var(--ds-text-tertiary)] mb-5 max-w-[240px] leading-relaxed">{description}</motion.p>

      {(actionLabel && onAction) || (secondaryLabel && onSecondaryAction) ? (
        <motion.div variants={fadeUp} className="flex items-center justify-center gap-2 flex-wrap">
          {actionLabel && onAction ? (
            <Button variant="primary" size="sm" onClick={onAction}>
              {actionLabel}
            </Button>
          ) : null}

          {secondaryLabel && onSecondaryAction ? (
            <Button variant="secondary" size="sm" onClick={onSecondaryAction}>
              {secondaryLabel}
            </Button>
          ) : null}
        </motion.div>
      ) : null}
    </motion.div>
  )
}
