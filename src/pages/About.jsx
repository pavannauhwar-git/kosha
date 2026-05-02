import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ExternalLink, Home, ShieldCheck, Sparkles, ArrowRight } from 'lucide-react'
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
import BottomSheet from '../components/ui/BottomSheet'
import Button from '../components/ui/Button'
import { copyToClipboard } from '../lib/share'

const fadeUp = createFadeUp(6, 0.18)
const stagger = createStagger(0.06, 0.04)

const UPI_ID = 'kumar.pavan.pk96@okicici'
const REPO_URL = 'https://github.com/pavannauhwar-git/kosha'
const LINKEDIN = 'https://www.linkedin.com/in/pavannauhwar/'
const SUPPORT_UPI_QUERY = `pa=${encodeURIComponent(UPI_ID)}&pn=${encodeURIComponent('Pavan Kumar Nauhwar')}&tn=${encodeURIComponent('Support Kosha')}`
const SUPPORT_UPI_LINK = `upi://pay?${SUPPORT_UPI_QUERY}`

function SectionLabel({ children }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-wider text-ink-3 mb-1.5 px-1">
      {children}
    </p>
  )
}

function StoryRow({ icon, title, description, tone = 'brand' }) {
  const toneClasses = {
    brand: 'bg-brand-container border border-brand/15',
    invest: 'bg-invest-bg border border-invest-border',
  }

  return (
    <div className="flex items-start gap-3 px-4 py-3.5">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${toneClasses[tone] || toneClasses.brand}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-ink leading-snug">{title}</p>
        <p className="text-[12px] text-ink-2 mt-1 leading-relaxed">{description}</p>
      </div>
    </div>
  )
}

function ConnectRow({ href, icon, label, sublabel, tone = 'neutral' }) {
  const toneClasses = {
    invest: 'bg-invest-bg border border-invest-border',
    neutral: 'bg-kosha-surface-2 border border-kosha-border',
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-kosha-surface-2 active:bg-kosha-surface-2"
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${toneClasses[tone] || toneClasses.neutral}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold text-ink leading-snug">{label}</p>
        <p className="text-[12px] text-ink-3 mt-0.5 truncate">{sublabel}</p>
      </div>
      <ExternalLink size={14} className="text-ink-3 shrink-0" />
    </a>
  )
}

export default function About() {
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const [showAllVersions, setShowAllVersions] = useState(false)
  const [showUpiSheet, setShowUpiSheet] = useState(false)
  const currentRelease = CHANGELOG[0]
  const olderReleases = CHANGELOG.slice(1)
  const latestVersion = currentRelease?.version || '1.0.0'
  const releaseCount = CHANGELOG.length
  const shippedItems = CHANGELOG.reduce((sum, release) => sum + (release.items?.length || 0), 0)

  async function copyUpi() {
    const res = await copyToClipboard(UPI_ID)
    if (res.success) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
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
          className="w-9 h-9 rounded-pill flex items-center justify-center bg-kosha-surface-2 active:bg-kosha-border transition-colors"
        >
          <Home size={16} className="text-ink-2" />
        </button>
      )}
    >
      <motion.div variants={stagger} initial="hidden" animate="show" className="flex flex-col gap-5 sm:gap-6">
        <motion.div variants={fadeUp} className="card p-0 overflow-hidden">
          <div className="px-4 py-5 bg-gradient-to-br from-brand-container/60 to-kosha-surface-2 border-b border-kosha-border flex items-center justify-between gap-4">
            <div className="flex flex-col items-start text-left min-w-0">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-8 h-8 rounded-xl bg-brand text-white flex items-center justify-center shadow-sm">
                  <KoshaLogo size={18} />
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-pill bg-brand-container text-brand border border-brand/20">
                  v{latestVersion}
                </span>
              </div>
              <p className="text-[22px] font-bold text-ink tracking-tight leading-tight truncate">Kosha</p>
              <p className="text-[12px] text-ink-3 mt-0.5">Your financial command center</p>
            </div>
            <img src="/illustrations/about_hero.png" alt="About Kosha" className="w-40 h-auto object-contain illustration shrink-0" />
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
                <div className="mini-panel px-2.5 py-2 text-center bg-brand-container/40 border-brand/15">
                  <p className="text-[16px] font-semibold text-brand leading-none">100%</p>
                  <p className="text-[10px] text-brand/80 mt-1">Self-hosted</p>
                </div>
              </div>

              <div className="mt-4">
                <Button
                  variant="primary"
                  size="md"
                  fullWidth
                  onClick={() => navigate('/guide')}
                  icon={<Sparkles size={14} />}
                >
                  Open product guide
                </Button>
              </div>
          </div>
        </motion.div>

        <motion.div variants={fadeUp}>
          <SectionLabel>How Kosha Works</SectionLabel>
          <div className="card overflow-hidden p-0">
            <StoryRow
              icon={<Sparkles size={14} className="text-brand" />}
              title="Capture once"
              description="Track transactions, bills, loans, and investments in one place instead of managing separate systems."
              tone="brand"
            />
            <Divider />
            <StoryRow
              icon={<CodeIcon size={14} weight="duotone" color={C.brand} />}
              title="Understand faster"
              description="Dashboards and summaries show what matters now without forcing you through noisy detail screens."
              tone="brand"
            />
            <Divider />
            <StoryRow
              icon={<HeartIcon size={14} weight="fill" color={C.expense} />}
              title="Act with confidence"
              description="Reconcile, review, and improve your habits with data quality controls that keep records trustworthy."
              tone="invest"
            />
          </div>
        </motion.div>

        <motion.div variants={fadeUp}>
          <SectionLabel>Release Timeline</SectionLabel>
          <div className="card overflow-hidden p-0">
            {currentRelease && (
              <div>
                <div className="flex items-center justify-between px-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-brand-container border border-brand/15 flex items-center justify-center shrink-0">
                      <StarIcon size={17} weight="duotone" color={C.brand} />
                    </div>
                    <div>
                      <p className="text-[15px] font-semibold text-ink">v{currentRelease.version}</p>
                      <p className="text-[12px] text-ink-3 mt-0.5">{currentRelease.date}</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-pill bg-brand-container text-brand border border-brand/15">
                    Current
                  </span>
                </div>
                <Divider />
                <div className="px-4 py-3.5 space-y-2.5">
                  {currentRelease.items.map((item, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-ink-2 mt-[6px] shrink-0" />
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
                    <div className="w-9 h-9 rounded-xl bg-kosha-surface-2 border border-kosha-border flex items-center justify-center shrink-0">
                      <StarIcon size={17} weight="duotone" color={C.inkMuted} />
                    </div>
                    <div>
                      <p className="text-[15px] font-semibold text-ink">v{release.version}</p>
                      <p className="text-[12px] text-ink-3 mt-0.5">{release.date}</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-pill bg-kosha-surface-2 text-ink-2 border border-kosha-border">
                    Archived
                  </span>
                </div>
                <Divider />
                <div className="px-4 py-3.5 space-y-2.5">
                  {release.items.map((item, i) => (
                    <div key={i} className="flex items-start gap-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-ink-2 mt-[6px] shrink-0" />
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
                  className="rounded-none border-0 bg-kosha-surface-2 text-ink-2"
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
          <SectionLabel>Connect</SectionLabel>
          <div className="card overflow-hidden p-0">
            <ConnectRow
              href={LINKEDIN}
              icon={<CodeIcon size={17} weight="duotone" color={C.brand} />}
              label="Pavan Kumar Nauhwar"
              sublabel="Developer · India"
              tone="invest"
            />
            <Divider />
            <ConnectRow
              href={REPO_URL}
              icon={<GithubLogoIcon size={17} weight="fill" color={C.ink} />}
              label="View on GitHub"
              sublabel="pavannauhwar-git/kosha"
              tone="neutral"
            />
            <Divider />

            <div className="px-4 py-3.5 bg-warning-bg/35">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-warning-bg border border-warning-border">
                  <CurrencyInrIcon size={17} weight="bold" color={C.bills} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium text-ink leading-snug">Support Kosha</p>
                  <p className="text-[12px] text-ink-3 mt-1 truncate">{UPI_ID}</p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="xs"
                  onClick={copyUpi}
                  className="shrink-0 !h-7 !px-2.5 !bg-kosha-surface !text-ink-2 !border-kosha-border"
                  icon={copied
                    ? <CheckIcon size={12} weight="bold" color={C.income} />
                    : <CopyIcon size={12} color={C.inkMuted} />}
                >
                  {copied ? 'Copied' : 'Copy UPI ID'}
                </Button>
              </div>

              <Button
                type="button"
                variant="primary"
                size="md"
                fullWidth
                onClick={() => setShowUpiSheet(true)}
                icon={<HeartIcon size={14} weight="fill" />}
                className="mt-3"
              >
                Pay to support
              </Button>
            </div>
          </div>
        </motion.div>

        <motion.div variants={fadeUp}>
          <SectionLabel>Privacy And Stack</SectionLabel>
          <div className="card p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-expense-bg border border-expense-border flex items-center justify-center shrink-0 mt-0.5">
                <LockIcon size={17} weight="duotone" color={C.expense} />
              </div>
              <p className="text-[13px] text-ink-2 leading-relaxed flex-1">
                Your data stays in your own Supabase project, protected by row-level security. No telemetry, no ad tracking, no third-party sharing.
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
            <p className="text-caption text-ink-3">
              v{latestVersion} · Made with
            </p>
            <HeartIcon size={12} weight="fill" color={C.expense} />
            <p className="text-caption text-ink-3">in India</p>
          </motion.div>

      </motion.div>

      <BottomSheet
        open={showUpiSheet}
        onClose={() => setShowUpiSheet(false)}
        title="Pay to support"
        description="Choose your preferred UPI app"
      >
        <div className="grid grid-cols-1 gap-3 pb-6">
          {[
            { label: 'Google Pay', href: `gpay://upi/pay?${SUPPORT_UPI_QUERY}`, color: 'bg-[#4285F4]/10 text-[#4285F4] border-[#4285F4]/20' },
            { label: 'PhonePe', href: `phonepe://pay?${SUPPORT_UPI_QUERY}`, color: 'bg-[#5f259f]/10 text-[#5f259f] border-[#5f259f]/20' },
            { label: 'Paytm', href: `paytmmp://pay?${SUPPORT_UPI_QUERY}`, color: 'bg-[#00baf2]/10 text-[#00baf2] border-[#00baf2]/20' },
          ].map((app) => (
            <a
              key={app.label}
              href={app.href}
              className={`flex items-center justify-between px-5 py-4 rounded-card border font-bold text-[15px] transition-all active:scale-[0.98] ${app.color}`}
            >
              {app.label}
              <ArrowRight size={16} />
            </a>
          ))}
          
          <div className="mt-2">
            <Divider />
            <a
              href={SUPPORT_UPI_LINK}
              className="flex items-center justify-center gap-2 w-full py-4 text-ink-3 font-semibold text-[14px] hover:text-ink active:scale-[0.98] transition-all"
            >
              Other UPI App
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </BottomSheet>
    </PageBackHeaderPage>
  )
}
