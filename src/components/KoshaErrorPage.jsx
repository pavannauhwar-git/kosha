import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Check, Copy, Home, RotateCw } from 'lucide-react'
import KoshaLogo from './KoshaLogo'

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
      className="fixed inset-0 z-[80] overflow-hidden bg-white text-ink"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
      }}
    >
      <div className="relative flex h-full items-center justify-center p-6">
        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="w-full max-w-[420px] max-h-full overflow-y-auto flex flex-col items-center text-center"
        >
          <div className="mb-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-kosha-surface-2 border border-kosha-border shadow-sm mb-6">
              <AlertTriangle size={28} className={isNotFound ? 'text-warning' : 'text-expense'} />
            </div>
            <h1 className="text-[26px] font-bold tracking-tight text-ink mb-2">
              {isNotFound ? 'Page Not Found' : title}
            </h1>
            <p className="text-body text-ink-3">
              {description} {helperText}
            </p>
          </div>

          <div className="w-full flex flex-col gap-3">
            <button
              type="button"
              onClick={onPrimary}
              className="inline-flex w-full items-center justify-center gap-2 rounded-[12px] bg-ink px-4 py-3.5 text-[15px] font-semibold text-white shadow-sm transition-all duration-100 hover:bg-ink-2 active:scale-[0.98]"
            >
              <PrimaryIcon size={18} />
              {primaryLabel}
            </button>

            <button
              type="button"
              onClick={onSecondary}
              className="inline-flex w-full items-center justify-center gap-2 rounded-[12px] bg-white border border-kosha-border px-4 py-3.5 text-[15px] font-semibold text-ink shadow-sm transition-all duration-100 hover:bg-kosha-surface-2 active:scale-[0.98]"
            >
              <SecondaryIcon size={18} />
              {secondaryLabel}
            </button>
          </div>

          {tertiaryLabel && onTertiary && TertiaryIcon && (
            <button
              type="button"
              onClick={onTertiary}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 px-4 py-3 text-[14px] font-medium text-ink-3 transition-opacity hover:text-ink"
            >
              <TertiaryIcon size={16} />
              {tertiaryLabel}
            </button>
          )}

          {normalizedDetail && (
            <div className="mt-8 w-full text-left">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[12px] font-medium text-ink-3 uppercase tracking-wider">Error Details</p>
                <button
                  type="button"
                  onClick={handleCopyDetail}
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium text-brand hover:underline"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied' : 'Copy log'}
                </button>
              </div>
              <pre className="w-full max-h-48 overflow-auto rounded-xl border border-kosha-border bg-kosha-surface-2 p-4 text-[12px] leading-relaxed text-ink-2 whitespace-pre-wrap break-words">
                {normalizedDetail}
              </pre>
            </div>
          )}
        </motion.section>
      </div>
    </div>
  )
}
