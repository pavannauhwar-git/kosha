import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Warning, Check, Copy, House, ArrowClockwise } from '@phosphor-icons/react'
import KoshaLogo from '../brand/KoshaLogo'
import { copyToClipboard } from '../../lib/share'
import Button from '../ui/Button'

export default function KoshaErrorPage({
  type = 'runtime',
  title = 'Something went wrong',
  description = 'An unexpected issue interrupted this screen.',
  helperText = 'Please try again in a moment.',
  detail = '',
  primaryLabel = 'Reload app',
  secondaryLabel = 'Go home',
  tertiaryLabel = '',
  onPrimary,
  onSecondary,
  onTertiary,
  primaryIcon: PrimaryIcon = ArrowClockwise,
  secondaryIcon: SecondaryIcon = House,
  tertiaryIcon: TertiaryIcon,
  imageUrl,
}) {
  const [copied, setCopied] = useState(false)
  const normalizedDetail = useMemo(() => String(detail || '').trim().slice(0, 1800), [detail])
  const headingRef = useRef(null)

  const isNotFound = type === 'not-found'
  const badgeLabel = isNotFound ? '404' : 'System Error'
  const toneClass = isNotFound
    ? 'bg-warning-bg text-warning-text border-warning-border'
    : 'bg-expense-bg text-expense-text border-expense-border'

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      headingRef.current?.focus()
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [])

  async function handleCopyDetail() {
    if (!normalizedDetail) return
    const res = await copyToClipboard(normalizedDetail)
    if (res.success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] overflow-hidden bg-kosha-bg"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
      }}
    >
      <div className="relative flex h-full items-center justify-center px-4 py-8">
        <motion.section
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.24, ease: [0.05, 0.7, 0.1, 1] }}
          className="w-full max-w-[470px] max-h-full overflow-y-auto card p-6"
        >
          <div className="mb-5 flex items-center justify-between gap-3 pb-4 border-b border-kosha-border">
            <div className="flex items-center gap-3">
              <KoshaLogo size={36} />
              <div>
                <p className="text-[15px] font-bold text-ink tracking-tight">Kosha</p>
                <p className="text-caption font-medium text-ink-3">{isNotFound ? 'Page not found' : 'Recovery mode'}</p>
              </div>
            </div>
            <span className={`rounded-pill border px-2.5 py-1 text-[11px] font-semibold ${toneClass}`}>
              {badgeLabel}
            </span>
          </div>

          {imageUrl ? (
            <div className="flex flex-col items-center text-center mb-6">
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.4 }}
                className="mb-6"
              >
                <img
                  src={imageUrl}
                  alt="Error illustration"
                  className="w-48 h-48 object-contain illustration drop-shadow-xl"
                />
              </motion.div>
              <h1 ref={headingRef} tabIndex="-1" className="text-[24px] font-bold leading-tight tracking-tight text-ink">
                {title}
              </h1>
              <p className="mt-2 text-[15px] leading-relaxed text-ink-2 max-w-[340px]">
                {description}
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${toneClass}`}>
                <Warning size={18} />
              </div>
              <div>
                <h1 ref={headingRef} tabIndex="-1" className="text-[20px] font-bold leading-tight tracking-tight text-ink">{title}</h1>
                <p className="mt-1.5 text-label leading-relaxed text-ink-2">{description}</p>
              </div>
            </div>
          )}

          {!isNotFound && <p className="mt-3 text-caption leading-relaxed text-ink-3">{helperText}</p>}
          {isNotFound && helperText && <p className="mt-1 text-caption leading-relaxed text-ink-3">{helperText}</p>}

          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              variant="primary"
              onClick={onPrimary}
              icon={<PrimaryIcon size={16} />}
              fullWidth
            >
              {primaryLabel}
            </Button>

            <Button
              variant="secondary"
              onClick={onSecondary}
              icon={<SecondaryIcon size={16} />}
              fullWidth
            >
              {secondaryLabel}
            </Button>
          </div>

          {tertiaryLabel && onTertiary && TertiaryIcon && (
            <Button
              variant="secondary"
              onClick={onTertiary}
              icon={<TertiaryIcon size={16} />}
              fullWidth
              className="mt-2"
              style={{
                '--md-outlined-button-label-text-color': 'var(--ds-accent-text)',
                '--md-outlined-button-hover-label-text-color': 'var(--ds-accent-text)',
                '--md-outlined-button-focus-label-text-color': 'var(--ds-accent-text)',
                '--md-outlined-button-pressed-label-text-color': 'var(--ds-accent-text)',
                '--md-outlined-button-hover-state-layer-color': 'var(--ds-accent-text)',
                '--md-outlined-button-pressed-state-layer-color': 'var(--ds-accent-text)',
              }}
            >
              {tertiaryLabel}
            </Button>
          )}

          {normalizedDetail && (
            <div className="mt-4 rounded-card border border-kosha-border bg-kosha-surface-2">
              <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                <p className="text-caption font-semibold text-ink-2">Technical details</p>
                <motion.button
                  type="button"
                  onClick={handleCopyDetail}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 20 }}
                  className="inline-flex items-center gap-1.5 rounded-pill border border-kosha-border bg-kosha-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-2"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Copied' : 'Copy'}
                </motion.button>
              </div>

              <pre className="max-h-44 overflow-auto border-t border-kosha-border px-3 py-3 text-[11px] leading-relaxed text-ink-3 whitespace-pre-wrap break-words">
                {normalizedDetail}
              </pre>
            </div>
          )}
        </motion.section>
      </div>
    </div>
  )
}
