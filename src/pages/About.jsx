import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ExternalLink, Home, ShieldCheck, Sparkles } from 'lucide-react'
import {
  HeartIcon, CodeIcon, CurrencyInrIcon, CopyIcon, CheckIcon,
  GithubLogoIcon, LockIcon, StarIcon, CaretDownIcon, CaretUpIcon,
} from '@phosphor-icons/react'
import { C } from '../lib/colors'
import KoshaLogo from '../components/brand/KoshaLogo'
import { CHANGELOG } from '../lib/changelog'
import Divider from '../components/common/Divider'
import { createFadeUp, createStagger } from '../lib/animations'
import PageBackHeaderPage from '../components/layout/PageBackHeaderPage'
import Button from '../components/ui/Button'

const fadeUp = createFadeUp(6, 0.18)
const stagger = createStagger(0.06, 0.04)

const UPI_ID = 'kumar.pavan.pk96@okicici'
const REPO_URL = 'https://github.com/pavannauhwar-git/kosha'
const LINKEDIN = 'https://www.linkedin.com/in/pavannauhwar/'
const SUPPORT_UPI_QUERY = `pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent('Pavan Kumar Nauhwar')}&tn=${encodeURIComponent('Support Kosha')}`
const SUPPORT_UPI_LINK = `upi://pay?${SUPPORT_UPI_QUERY}`

function SectionLabel({ children }) {
  return (
    <p className="text-[14px] font-semibold text-ink mb-2 px-1">
      {children}
    </p>
  )
}

function CardRow({ icon, label, sublabel, right, onClick, href, tone = 'brand' }) {
  const toneClasses = {
    brand: 'bg-brand-container border border-brand/15',
    income: 'bg-income-bg border border-income-border',
    expense: 'bg-expense-bg border border-expense-border',
    invest: 'bg-invest-bg border border-invest-border',
    warning: 'bg-warning-bg border border-warning-border',
    neutral: 'bg-kosha-surface-2 border border-kosha-border',
  }

  const inner = (
    <>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${toneClasses[tone] || toneClasses.brand}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-medium text-ink leading-snug">{label}</p>
        {sublabel && <p className="text-[12px] text-ink-3 mt-0.5 truncate">{sublabel}</p>}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </>
  )

  const cls = `w-full flex items-center gap-3 px-4 py-3.5
               transition-colors hover:bg-kosha-surface-2 active:bg-kosha-surface-2 text-left`

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {inner}
      </a>
    )
  }

  return (
    <button onClick={onClick} className={cls}>
      {inner}
    </button>
  )
}

export default function About() {
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const [showAllVersions, setShowAllVersions] = useState(false)
  const currentRelease = CHANGELOG[0]
  const olderReleases = CHANGELOG.slice(1)
  const latestVersion = currentRelease?.version || '1.0.0'
  const releaseCount = CHANGELOG.length
  const shippedItems = CHANGELOG.reduce((sum, release) => sum + (release.items?.length || 0), 0)

  function copyUpi() {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(UPI_ID)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function openExternal(url) {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function openSupportUpi() {
    window.location.href = SUPPORT_UPI_LINK
  }

  return (
    <PageBackHeaderPage
      title="About"
      onBack={() => navigate(-1)}
      rightSlot={(
        <button
          type="button"
          onClick={() => navigate('/')}
          aria-label="Go to dashboard"
          className="w-9 h-9 rounded-pill flex items-center justify-center bg-kosha-surface-2 active:bg-kosha-border"
        >
          <Home size={16} className="text-ink-2" />
        </button>
      )}
    >
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">
        <motion.div variants={fadeUp} className="card p-0 overflow-hidden">
          <div className="px-4 py-4 bg-kosha-surface-2 border-b border-kosha-border flex items-center gap-3">
              <KoshaLogo size={42} className="drop-shadow-[0_4px_10px_rgba(0,0,0,0.10)]" />
              <div className="min-w-0 flex-1">
                <p className="text-[20px] font-bold text-ink tracking-tight leading-tight">Kosha</p>
                <p className="text-[12px] text-ink-3 mt-0.5">Your financial command center</p>
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-1 rounded-pill bg-brand-container text-brand border border-brand/15">
                v{latestVersion}
              </span>
          </div>

          <div className="p-4">
              <p className="text-[13px] text-ink-2 leading-relaxed">
                Track income, expenses, investments, bills, and loans in one place. Kosha gives you direction when you need it fast and precision when details matter.
              </p>

              <div className="grid grid-cols-3 gap-2 mt-4">
                <div className="mini-panel px-2.5 py-2 text-center">
                  <p className="text-[16px] font-semibold text-ink leading-none">{releaseCount}</p>
                  <p className="text-[10px] text-ink-3 mt-1">Releases</p>
                </div>
                <div className="mini-panel px-2.5 py-2 text-center">
                  <p className="text-[16px] font-semibold text-ink leading-none">{shippedItems}+</p>
                  <p className="text-[10px] text-ink-3 mt-1">Improvements</p>
                </div>
                <div className="mini-panel px-2.5 py-2 text-center">
                  <p className="text-[16px] font-semibold text-ink leading-none">100%</p>
                  <p className="text-[10px] text-ink-3 mt-1">Self-hosted data</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                <Button
                  variant="secondary"
                  size="md"
                  fullWidth
                  onClick={() => navigate('/guide')}
                  icon={<Sparkles size={14} />}
                  className="bg-brand text-white border-brand hover:brightness-95"
                >
                  Open product guide
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  fullWidth
                  onClick={() => openExternal(REPO_URL)}
                  icon={<ExternalLink size={14} />}
                  className="bg-[#181717] text-white border-[#181717] hover:bg-[#0f0f0f]"
                >
                  View GitHub
                </Button>
              </div>
          </div>
        </motion.div>

          <motion.div variants={fadeUp}>
            <SectionLabel tone="invest">Design Principles</SectionLabel>
            <div className="card p-4 space-y-2.5">
              <div className="rounded-card border border-kosha-border bg-kosha-surface px-3 py-2.5">
                <p className="text-[12px] font-semibold text-ink">Direction first</p>
                <p className="text-[11px] text-ink-3 mt-0.5">Dashboard gives fast orientation before deep edits.</p>
              </div>
              <div className="rounded-card border border-kosha-border bg-kosha-surface px-3 py-2.5">
                <p className="text-[12px] font-semibold text-ink">Precision always</p>
                <p className="text-[11px] text-ink-3 mt-0.5">Transactions, bills, loans, and reconciliation preserve record quality.</p>
              </div>
              <div className="rounded-card border border-kosha-border bg-kosha-surface px-3 py-2.5">
                <p className="text-[12px] font-semibold text-ink">Privacy by default</p>
                <p className="text-[11px] text-ink-3 mt-0.5">No telemetry or ad tracking. Your Supabase project is your source of truth.</p>
              </div>
            </div>
          </motion.div>

          <motion.div variants={fadeUp}>
            <SectionLabel tone="warning">Release Timeline</SectionLabel>
            <div className="card overflow-hidden p-0">
              {currentRelease && (
                <div>
                  <div className="flex items-center justify-between px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-warning-bg border border-warning-border
                            flex items-center justify-center shrink-0">
                        <StarIcon size={17} weight="duotone" color={C.bills} />
                      </div>
                      <div>
                        <p className="text-[15px] font-semibold text-ink">
                          v{currentRelease.version}
                        </p>
                        <p className="text-[12px] text-ink-3 mt-0.5">{currentRelease.date}</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full
                             bg-warning-bg text-warning-text border border-warning-border">
                      Current
                    </span>
                  </div>
                  <Divider />
                  <div className="px-4 py-3.5 space-y-2.5">
                    {currentRelease.items.map((item, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-warning-text mt-[6px] shrink-0" />
                        <p className="text-[13px] text-ink-2 leading-snug">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {showAllVersions && olderReleases.map((release) => (
                <div key={release.version}>
                  <Divider />
                  <div className="flex items-center justify-between px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-invest-bg border border-invest-border
                            flex items-center justify-center shrink-0">
                        <StarIcon size={17} weight="duotone" color={C.investText} />
                      </div>
                      <div>
                        <p className="text-[15px] font-semibold text-ink">
                          v{release.version}
                        </p>
                        <p className="text-[12px] text-ink-3 mt-0.5">{release.date}</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full
                             bg-ink/[0.06] text-ink-2">
                      Archived
                    </span>
                  </div>
                  <Divider />
                  <div className="px-4 py-3.5 space-y-2.5">
                    {release.items.map((item, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-invest-text mt-[6px] shrink-0" />
                        <p className="text-[13px] text-ink-2 leading-snug">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {olderReleases.length > 0 && (
                <>
                  <Divider />
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    fullWidth
                    onClick={() => setShowAllVersions(v => !v)}
                    iconRight={showAllVersions
                      ? <CaretUpIcon size={13} weight="bold" />
                      : <CaretDownIcon size={13} weight="bold" />}
                    className="rounded-none border-0 bg-warning-bg text-warning-text border-warning-border"
                  >
                    {showAllVersions
                      ? 'Hide older releases'
                      : `Expand older releases (${olderReleases.length})`}
                  </Button>
                </>
              )}
            </div>
          </motion.div>

          <motion.div variants={fadeUp}>
            <SectionLabel tone="income">Connect</SectionLabel>
            <div className="card overflow-hidden p-0">
              <CardRow
                icon={<CodeIcon size={17} weight="duotone" color={C.brand} />}
                label="Pavan Kumar Nauhwar"
                sublabel="Developer · India"
                href={LINKEDIN}
                tone="invest"
                right={<ExternalLink size={14} className="text-ink-3" />}
              />
              <Divider />
              <CardRow
                icon={<GithubLogoIcon size={17} weight="fill" color={C.ink} />}
                label="View on GitHub"
                sublabel="pavannauhwar-git/kosha"
                href={REPO_URL}
                tone="neutral"
                right={<ExternalLink size={14} className="text-ink-3" />}
              />
              <Divider />
              <div className="px-4 py-3.5 bg-warning-bg/35">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-warning-bg border border-warning-border">
                    <CurrencyInrIcon size={17} weight="bold" color={C.bills} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium text-ink leading-snug">Support Kosha</p>
                    <p className="text-[12px] text-ink-3 mt-0.5 truncate">{UPI_ID}</p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  fullWidth
                  onClick={openSupportUpi}
                  className="mt-3 bg-ink text-white border-ink hover:brightness-110"
                >
                  Pay with any UPI app
                </Button>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  fullWidth
                  onClick={copyUpi}
                  className="mt-2 bg-kosha-surface text-ink-2 border-kosha-border"
                  icon={copied
                    ? <CheckIcon size={14} weight="bold" color={C.income} />
                    : <CopyIcon size={14} color={C.inkMuted} />}
                >
                  {copied ? 'UPI copied' : 'Copy UPI ID'}
                </Button>

                <p className="text-[10px] text-ink-3 mt-2">This opens the default UPI chooser so you can pick any installed payment app.</p>
              </div>
            </div>
          </motion.div>

          <motion.div variants={fadeUp}>
            <SectionLabel tone="expense">Privacy And Stack</SectionLabel>
            <div className="card p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-expense-bg border border-expense-border flex items-center justify-center shrink-0 mt-0.5">
                  <LockIcon size={17} weight="duotone" color={C.expense} />
                </div>
                <p className="text-[13px] text-ink-2 leading-relaxed flex-1">
                  Your data lives in your own Supabase project, protected by
                  row-level security. No telemetry, no tracking pixels, no third-party data sharing — ever.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-invest-bg border border-invest-border flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck size={16} className="text-invest-text" />
                </div>
                <p className="text-[13px] text-ink-2 leading-relaxed flex-1">
                  Built with React, Supabase, Vite, Tailwind, and Framer Motion for fast interaction and clear information density.
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div variants={fadeUp}
            className="flex items-center justify-center gap-1.5 pt-2 pb-2"
          >
            <p className="text-caption text-ink-4">
              v{latestVersion} · Made with
            </p>
            <HeartIcon size={12} weight="fill" color={C.expense} />
            <p className="text-caption text-ink-4">in India</p>
          </motion.div>

      </motion.div>
    </PageBackHeaderPage>
  )
}
