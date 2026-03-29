import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Check, Copy, Home, RotateCw } from 'lucide-react'
import KoshaLogo from '../brand/KoshaLogo'

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
  primaryIcon: PrimaryIcon = RotateCw,
  secondaryIcon: SecondaryIcon = Home,
  tertiaryIcon: TertiaryIcon,
}) {
  const [copied, setCopied] = useState(false)
  const normalizedDetail = useMemo(() => String(detail || '').trim().slice(0, 1800), [detail])

  const isNotFound = type === 'not-found'
  const badgeLabel = isNotFound ? '404' : 'System Error'
  const toneClass = isNotFound
    ? 'bg-warning-bg text-warning-text border-warning-border'
    : 'bg-expense-bg text-expense-text border-expense-border'

  async function handleCopyDetail() {
    if (!normalizedDetail || !navigator.clipboard?.writeText) return
    await navigator.clipboard.writeText(normalizedDetail)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
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
          transition={{ duration: 0.24, ease: 'easeOut' }}
          className="w-full max-w-[470px] max-h-full overflow-y-auto card p-6"
        >
          <div className="mb-5 flex items-center justify-between gap-3 pb-4 border-b border-kosha-border">
            <div className="flex items-center gap-3">
              <KoshaLogo size={36} />
              <div>
                <p className="text-[15px] font-bold text-ink tracking-tight">Kosha</p>
                <p className="text-caption font-medium text-ink-3">Recovery mode</p>
              </div>
            </div>
            <span className={`rounded-pill border px-2.5 py-1 text-[11px] font-semibold ${toneClass}`}>
              {badgeLabel}
            </span>
          </div>

          <div className="flex items-start gap-3">
            <div className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${toneClass}`}>
              <AlertTriangle size={18} />
            </div>
            <div>
              <h1 className="text-[20px] font-bold leading-tight tracking-tight text-ink">{title}</h1>
              <p className="mt-1.5 text-label leading-relaxed text-ink-2">{description}</p>
            </div>
          </div>

          <p className="mt-3 text-caption leading-relaxed text-ink-3">{helperText}</p>

          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={onPrimary}
              className="inline-flex w-full items-center justify-center gap-2 rounded-[14px] bg-brand px-4 py-3 text-[14px] font-semibold text-white transition-all duration-100 active:scale-[0.98]"
            >
              <PrimaryIcon size={16} />
              {primaryLabel}
            </button>

            <button
              type="button"
              onClick={onSecondary}
              className="inline-flex w-full items-center justify-center gap-2 rounded-[14px] border border-kosha-border bg-kosha-surface px-4 py-3 text-[14px] font-semibold text-ink transition-all duration-100 active:scale-[0.98]"
            >
              <SecondaryIcon size={16} />
              {secondaryLabel}
            </button>
          </div>

          {tertiaryLabel && onTertiary && TertiaryIcon && (
            <button
              type="button"
              onClick={onTertiary}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-[14px] border border-kosha-border bg-kosha-surface-2 px-4 py-3 text-[14px] font-semibold text-brand transition-all duration-100 active:scale-[0.98]"
            >
              <TertiaryIcon size={16} />
              {tertiaryLabel}
            </button>
          )}

          {normalizedDetail && (
            <div className="mt-4 rounded-card border border-kosha-border bg-kosha-surface-2">
              <div className="flex items-center justify-between gap-2 px-3 py-2.5">
                <p className="text-caption font-semibold text-ink-2">Technical details</p>
                <button
                  type="button"
                  onClick={handleCopyDetail}
                  className="inline-flex items-center gap-1.5 rounded-pill border border-kosha-border bg-white px-2.5 py-1 text-[11px] font-semibold text-ink-2"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
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
