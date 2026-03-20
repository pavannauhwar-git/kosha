import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { X } from 'lucide-react'
import { Heart, Code, CurrencyInr, Copy, Check, Coffee, GithubLogo } from '@phosphor-icons/react'
import { C } from '../lib/colors'
import { useAuth } from '../context/AuthContext'
import KoshaLogo from '../components/KoshaLogo'

export default function About({ asOverlay = false }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [copied, setCopied] = useState(false)

  const UPI_ID = 'kumar.pavan.pk96@okicici'
  const REPO_URL = 'https://github.com/pavannauhwar-git/kosha'

  function copyUpi() {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(UPI_ID)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function handleClose() {
    if (asOverlay) {
      navigate(-1)
      return
    }
    navigate(user ? '/' : '/login', { replace: true })
  }

  const wrapperClass = asOverlay
    ? 'fixed inset-0 z-50 flex items-start justify-center px-4'
    : 'min-h-dvh bg-kosha-bg'

  const contentWrapperClass = asOverlay
    ? 'relative w-full max-w-[480px] overflow-y-auto rounded-2xl bg-kosha-bg shadow-2xl'
    : 'min-h-dvh bg-kosha-bg'

  const contentBottomPad = asOverlay ? 'pb-6' : 'pb-24'
  const overlayWrapperStyle = asOverlay
    ? {
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
      }
    : undefined

  const overlayContentStyle = asOverlay
    ? {
        maxHeight: 'calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 24px)',
      }
    : undefined

  return (
    <div className={wrapperClass} style={overlayWrapperStyle}>
      {asOverlay && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />}

      <div className={contentWrapperClass} style={overlayContentStyle}>
        {/* ── Close button ──────────────────────────────────────────── */}
        <div className="sticky top-0 z-10 bg-kosha-bg/85 backdrop-blur-md px-4 py-3 flex justify-end">
          <button
            onClick={handleClose}
            aria-label="Close"
            className="w-9 h-9 rounded-full bg-kosha-surface border border-kosha-border
                       flex items-center justify-center active:bg-kosha-surface-2"
          >
            <X size={18} className="text-ink-2" />
          </button>
        </div>

        <div className={`px-6 ${contentBottomPad} max-w-[480px] mx-auto`}>

          {/* ── Logo & name ─────────────────────────────────────────── */}
          <div className="flex flex-col items-center mt-1 mb-8">
            <KoshaLogo size={64} />
            <p className="text-caption text-ink-3 tracking-widest uppercase font-semibold mt-3">
              Your Financial Sheath
            </p>
          </div>

          {/* ── About blurb ─────────────────────────────────────────── */}
          <div className="card p-5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Code size={18} weight="duotone" color={C.brand} />
              <h2 className="text-[16px] font-bold text-ink">About</h2>
            </div>
            <p className="text-[14px] text-ink-2 leading-relaxed">
                Built by <a
                  href="https://www.linkedin.com/in/pavannauhwar/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-ink underline"
                >
                  Pavan Kumar Nauhwar
                </a> — a
              developer who wanted a better way to track finances. Kosha is designed to be
              fast, private, and delightfully simple. No ads, no bloat — just clean personal
              finance tracking that stays out of your way.
            </p>
          </div>

          {/* ── Built with love ─────────────────────────────────────── */}
          <div className="card p-5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Heart size={18} weight="duotone" color="#DC2626" />
              <h2 className="text-[16px] font-bold text-ink">Built With</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {['React', 'Supabase', 'Tailwind CSS', 'Vite', 'Framer Motion', 'Phosphor Icons'].map(tech => (
                <span key={tech}
                  className="text-caption font-medium text-brand bg-brand-container
                           px-2.5 py-1 rounded-full">
                  {tech}
                </span>
              ))}
            </div>

            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 w-full flex items-center justify-center gap-2.5 py-3
                       rounded-[14px] border border-kosha-border bg-white
                       active:bg-kosha-surface-2 transition-all duration-75"
            >
              <GithubLogo size={18} weight="fill" className="text-ink" />
              <span className="text-[14px] font-semibold text-ink">View on GitHub</span>
            </a>
          </div>

          {/* ── Support ─────────────────────────────────────────────── */}
          <div className="card p-5 mb-4">
            <div className="flex items-center gap-2 mb-3">
              <Coffee size={18} weight="duotone" color={C.brand} />
              <h2 className="text-[16px] font-bold text-ink">Support Kosha</h2>
            </div>
            <p className="text-[14px] text-ink-2 leading-relaxed mb-4">
              If Kosha helps you manage your money better, consider supporting its development.
              Every contribution helps keep this project alive and ad-free.
            </p>

            <div className="space-y-3">
              {/* UPI — primary */}
              <button
                onClick={copyUpi}
                className="w-full flex items-center justify-center gap-2.5 py-3.5
                         rounded-[14px] bg-brand text-white
                         text-[15px] font-semibold
                         active:scale-[0.98] transition-all duration-75 shadow-sm"
              >
                <CurrencyInr size={18} weight="bold" />
                {copied ? 'UPI ID Copied!' : 'Pay via UPI'}
              </button>

              {/* UPI ID display */}
              <button
                onClick={copyUpi}
                className="w-full flex items-center justify-center gap-2 py-3
                         rounded-[14px] border border-kosha-border bg-white
                         active:bg-kosha-surface-2 transition-all duration-75"
              >
                <span className="text-[14px] font-mono text-ink-2">{UPI_ID}</span>
                {copied
                  ? <Check size={14} weight="bold" className="text-income-text" />
                  : <Copy size={14} className="text-ink-3" />
                }
              </button>
            </div>
          </div>

          {/* ── Version ─────────────────────────────────────────────── */}
          <p className="text-center text-caption text-ink-4 mt-8">
            Kosha v1.0 · Made with <Heart size={15} weight="fill" className="inline text-expense-text" /> in India
          </p>
        </div>
      </div>
    </div>
  )
}
