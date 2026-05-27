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
      className={`card empty-state py-10 px-6 flex flex-col items-center text-center relative overflow-hidden ${className}`.trim()}
      style={{
        background: 'linear-gradient(to bottom, var(--ds-surface), var(--ds-surface-dim))',
        boxShadow: 'var(--ds-shadow-1), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
      }}
    >
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at top right, rgba(0, 127, 255, 0.03), transparent 60%)' }} />
      <div className="relative z-10 flex flex-col items-center">
      {imageUrl ? (
        <motion.div
          variants={fadeUp}
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="mb-4 flex items-center justify-center"
        >
          <img
            src={imageUrl}
            alt="Empty State Illustration"
            className="max-h-[220px] w-auto object-contain illustration filter drop-shadow-sm"
            loading="lazy"
            decoding="async"
          />
        </motion.div>
      ) : icon ? (
        <motion.div
          variants={fadeUp}
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
          className="w-16 h-16 rounded-full bg-brand-container flex items-center justify-center mb-4 border border-brand/10"
        >
          {icon}
        </motion.div>
      ) : null}

      <motion.p variants={fadeUp} className="text-[17px] font-bold text-ink mb-1.5 leading-tight">{title}</motion.p>
      <motion.p variants={fadeUp} className="text-caption text-ink-3 mb-5 max-w-[240px] leading-relaxed">{description}</motion.p>

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
      </div>
    </motion.div>
  )
}
