import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Check, Copy, Home, RotateCw } from 'lucide-react'
import KoshaLogo from './KoshaLogo'
import { C } from '../lib/colors'

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

  const badgeStyle = isNotFound
    ? { background: 'rgba(217,119,6,0.08)', color: '#d97706', border: '1px solid rgba(217,119,6,0.15)' }
    : { background: 'rgba(232,54,78,0.08)', color: C.expense, border: `1px solid rgba(232,54,78,0.15)` }

  const alertIconBg = isNotFound
    ? { background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.15)' }
    : { background: 'rgba(232,54,78,0.08)', border: '1px solid rgba(232,54,78,0.15)' }

  const alertIconColor = isNotFound ? '#d97706' : C.expense

  async function handleCopyDetail() {
    if (!normalizedDetail || !navigator.clipboard?.writeText) return
    await navigator.clipboard.writeText(normalizedDetail)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div
      className="fixed inset-0 z-[80] overflow-hidden"
      style={{
        background: '#f6f9fc',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
      }}
    >
      {/* ── Mesh gradient orbs ─────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute -top-20 left-1/2 -translate-x-1/2 rounded-full blur-3xl"
          style={{
            width: 420,
            height: 420,
            background: 'radial-gradient(circle, rgba(99,91,255,0.20) 0%, transparent 65%)',
          }}
        />
        <div
          className="absolute -bottom-24 -left-16 rounded-full blur-3xl"
          style={{
            width: 380,
            height: 380,
            background: 'radial-gradient(circle, rgba(14,159,110,0.15) 0%, transparent 65%)',
          }}
        />
        <div
          className="absolute top-1/3 -right-20 rounded-full blur-3xl"
          style={{
            width: 300,
            height: 300,
            background: isNotFound
              ? 'radial-gradient(circle, rgba(217,119,6,0.14) 0%, transparent 65%)'
              : 'radial-gradient(circle, rgba(232,54,78,0.14) 0%, transparent 65%)',
          }}
        />
      </div>

      <div className="relative flex h-full items-center justify-center px-4 py-8">
        <motion.section
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[470px] max-h-full overflow-y-auto rounded-hero p-6"
          style={{
            background: '#ffffff',
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
          }}
        >
          {/* ── Header: logo + badge ───────────────────────────── */}
          <div className="mb-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <KoshaLogo size={42} />
              <div>
                <p className="text-[11px] font-bold tracking-[0.18em]"
                   style={{ color: C.brand }}>KOSHA</p>
                <p className="text-[12px] font-medium" style={{ color: C.inkMuted }}>Recovery mode</p>
              </div>
            </div>
            <span
              className="rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={badgeStyle}
            >
              {badgeLabel}
            </span>
          </div>

          {/* ── Detail card ────────────────────────────────────── */}
          <div
            className="rounded-[20px] p-4"
            style={{
              background:
                'linear-gradient(145deg, rgba(99,91,255,0.06) 0%, rgba(0,0,0,0.01) 85%)',
              border: '1px solid rgba(0,0,0,0.06)',
            }}
          >
            <div className="flex items-start gap-3">
              <div
                className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={alertIconBg}
              >
                <AlertTriangle size={18} color={alertIconColor} />
              </div>
              <div>
                <h1 className="text-[22px] font-bold leading-tight tracking-tight"
                    style={{ color: C.ink }}>{title}</h1>
                <p className="mt-1.5 text-[14px] leading-relaxed"
                   style={{ color: 'rgba(0,0,0,0.55)' }}>{description}</p>
              </div>
            </div>
          </div>

          <p className="mt-3 text-[12px] leading-relaxed" style={{ color: C.inkMuted }}>{helperText}</p>

          {/* ── Action buttons ─────────────────────────────────── */}
          <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <button
              type="button"
              onClick={onPrimary}
              className="inline-flex w-full items-center justify-center gap-2 rounded-[14px] px-4 py-3 text-[14px] font-semibold text-white transition-all duration-100 active:scale-[0.97]"
              style={{
                background: 'linear-gradient(135deg, #635bff 0%, #7a73ff 100%)',
                boxShadow: '0 4px 16px rgba(99,91,255,0.35)',
              }}
            >
              <PrimaryIcon size={16} />
              {primaryLabel}
            </button>

            <button
              type="button"
              onClick={onSecondary}
              className="inline-flex w-full items-center justify-center gap-2 rounded-[14px] px-4 py-3 text-[14px] font-semibold transition-all duration-100 active:scale-[0.97]"
              style={{
                background: '#ffffff',
                color: C.ink,
                border: '1px solid rgba(0,0,0,0.10)',
              }}
            >
              <SecondaryIcon size={16} />
              {secondaryLabel}
            </button>
          </div>

          {tertiaryLabel && onTertiary && TertiaryIcon && (
            <button
              type="button"
              onClick={onTertiary}
              className="mt-2.5 inline-flex w-full items-center justify-center gap-2 rounded-[14px] px-4 py-3 text-[14px] font-semibold transition-all duration-100 active:scale-[0.97]"
              style={{
                background: '#f6f9fc',
                color: C.brand,
                border: '1px solid rgba(0,0,0,0.08)',
              }}
            >
              <TertiaryIcon size={16} />
              {tertiaryLabel}
            </button>
          )}

          {/* ── Technical details ──────────────────────────────── */}
          {normalizedDetail && (
            <div
              className="mt-4 rounded-[16px] overflow-hidden"
              style={{
                background: '#f6f9fc',
                border: '1px solid rgba(0,0,0,0.06)',
              }}
            >
              <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                <p className="text-[12px] font-semibold" style={{ color: 'rgba(0,0,0,0.50)' }}>
                  Technical details
                </p>
                <button
                  type="button"
                  onClick={handleCopyDetail}
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors active:scale-[0.97]"
                  style={{
                    background: 'rgba(0,0,0,0.04)',
                    color: 'rgba(0,0,0,0.50)',
                    border: '1px solid rgba(0,0,0,0.08)',
                  }}
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>

              <pre
                className="max-h-44 overflow-auto px-3.5 py-3 text-[11px] leading-relaxed whitespace-pre-wrap break-words"
                style={{
                  color: 'rgba(0,0,0,0.40)',
                  borderTop: '1px solid rgba(0,0,0,0.06)',
                }}
              >
                {normalizedDetail}
              </pre>
            </div>
          )}
        </motion.section>
      </div>
    </div>
  )
}
