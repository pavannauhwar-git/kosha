import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  HeartIcon, CodeIcon, CurrencyInrIcon, CopyIcon, CheckIcon,
  GithubLogoIcon, LockIcon, StarIcon, CaretDownIcon, CaretUpIcon,
} from '@phosphor-icons/react'
import { C } from '../lib/colors'
import KoshaLogo from '../components/brand/KoshaLogo'
import { CHANGELOG } from '../lib/changelog'
import Divider from '../components/common/Divider'
import { createFadeUp, createStagger } from '../lib/animations'
import PageBackHeader from '../components/layout/PageBackHeader'

const fadeUp = createFadeUp(6, 0.18)
const stagger = createStagger(0.06, 0.04)

const UPI_ID = 'kumar.pavan.pk96@okicici'
const REPO_URL = 'https://github.com/pavannauhwar-git/kosha'
const LINKEDIN = 'https://www.linkedin.com/in/pavannauhwar/'

function SectionLabel({ children }) {
  return (
    <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-[0.08em] mb-2 px-1">
      {children}
    </p>
  )
}

function CardRow({ icon, label, sublabel, right, onClick, href }) {
  const inner = (
    <>
      <div className="w-9 h-9 rounded-chip flex items-center justify-center shrink-0 bg-brand-container">
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
               transition-colors active:bg-kosha-surface-2 text-left`

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
  const latestVersion = CHANGELOG[0]?.version || '1.0.0'
  const releaseCount = CHANGELOG.length
  const shippedItems = CHANGELOG.reduce((sum, release) => sum + (release.items?.length || 0), 0)

  function copyUpi() {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(UPI_ID)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="min-h-dvh bg-kosha-bg">

      <PageBackHeader title="About" onBack={() => navigate(-1)} />

      <div className="px-4 pt-6 pb-24 max-w-[560px] mx-auto">
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-3.5 md:space-y-4">

          {/* ── Identity card ───────────────────────────────────── */}
          <motion.div variants={fadeUp} className="card p-4">
            <div className="flex items-center gap-4 pb-4 border-b border-kosha-border">
              <KoshaLogo size={52} />
              <div className="flex-1 min-w-0">
                <p className="text-[22px] font-bold text-ink leading-tight tracking-tight">Kosha</p>
                <p className="text-[13px] text-ink-3 mt-0.5">Your financial command center</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] text-ink-4 uppercase tracking-wide">Version</p>
                <p className="text-[15px] font-semibold text-accent">v{latestVersion}</p>
              </div>
            </div>

            <p className="text-[13px] text-ink-2 leading-relaxed mt-4">
              Track income, expenses, investments, bills, and loans in one place. Kosha gives you direction when you need it fast and precision when the details matter.
            </p>

            <div className="flex gap-3 mt-4">
              <div className="flex-1 bg-kosha-surface-2 rounded-card px-3 py-2.5 text-center">
                <p className="text-[18px] font-semibold text-ink leading-none">{releaseCount}</p>
                <p className="text-[10px] text-ink-3 mt-1">Releases</p>
              </div>
              <div className="flex-1 bg-kosha-surface-2 rounded-card px-3 py-2.5 text-center">
                <p className="text-[18px] font-semibold text-ink leading-none">{shippedItems}+</p>
                <p className="text-[10px] text-ink-3 mt-1">Improvements</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
              <button
                type="button"
                onClick={() => navigate('/guide')}
                className="btn-primary h-10 px-4 text-[12px] whitespace-nowrap"
              >
                Open product guide
              </button>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary h-10 px-4 text-[12px] whitespace-nowrap inline-flex items-center justify-center"
              >
                View GitHub
              </a>
            </div>
          </motion.div>

          <motion.div variants={fadeUp}>
            <SectionLabel>Why Kosha</SectionLabel>
            <div className="card p-4">
              <p className="text-[13px] text-ink-2 leading-relaxed">
                Most finance apps either overwhelm you with dashboards or hide the details you need. Kosha keeps both direction and precision in one flow — Dashboard for pulse, Transactions for truth, Analytics for trends, and Reconciliation for trust.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {['Fast capture', 'Clear insights', 'Loan tracking', 'Bill reminders', 'Privacy first'].map((pill) => (
                  <span key={pill} className="text-[11px] font-semibold px-2.5 py-1 rounded-pill bg-ink/[0.06] text-ink">
                    {pill}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>

          {/* ── Author ────────────────────────────────────────────── */}
          <motion.div variants={fadeUp}>
            <SectionLabel>Author</SectionLabel>
            <div className="card overflow-hidden p-0">
              <CardRow
                icon={<CodeIcon size={17} weight="duotone" color={C.brand} />}
                label="Pavan Kumar Nauhwar"
                sublabel="Developer · India"
                href={LINKEDIN}
                right={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke={C.inkMuted} strokeWidth="2">
                    <polyline points="9,18 15,12 9,6" />
                  </svg>
                }
              />
            </div>
          </motion.div>

          {/* ── What's New ────────────────────────────────────────── */}
          <motion.div variants={fadeUp}>
            <SectionLabel>What's new</SectionLabel>
            <div className="card overflow-hidden p-0">

              {CHANGELOG
                .slice(0, showAllVersions ? CHANGELOG.length : 1)
                .map((release, ri) => (
                  <div key={release.version}>
                    {ri > 0 && <Divider />}
                    <div className="flex items-center justify-between px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-chip bg-brand-container
                              flex items-center justify-center shrink-0">
                          <StarIcon size={17} weight="duotone" color={C.brand} />
                        </div>
                        <div>
                          <p className="text-[15px] font-semibold text-ink">
                            v{release.version}
                          </p>
                          <p className="text-[12px] text-ink-3 mt-0.5">{release.date}</p>
                        </div>
                      </div>
                      {ri === 0 && (
                        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full
                               bg-ink/[0.06] text-ink">
                          Latest
                        </span>
                      )}
                    </div>
                    <Divider />
                    <div className="px-4 py-3.5 space-y-2.5">
                      {release.items.map((item, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-brand mt-[6px] shrink-0" />
                          <p className="text-[13px] text-ink-2 leading-snug">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              }

              {CHANGELOG.length > 1 && (
                <>
                  <Divider />
                  <button
                    onClick={() => setShowAllVersions(v => !v)}
                    className="w-full px-4 py-3 text-[13px] font-semibold text-accent
                               text-center active:bg-kosha-surface-2 transition-colors
                               flex items-center justify-center gap-1.5"
                  >
                    {showAllVersions
                      ? <>Hide older versions <CaretUpIcon size={13} weight="bold" /></>
                      : <>Older versions ({CHANGELOG.length - 1}) <CaretDownIcon size={13} weight="bold" /></>
                    }
                  </button>
                </>
              )}
            </div>
          </motion.div>

          {/* ── Built With ────────────────────────────────────────── */}
          <motion.div variants={fadeUp}>
            <SectionLabel>Built with</SectionLabel>
            <div className="card overflow-hidden p-0">
              <div className="px-4 py-3.5">
                <div className="flex flex-wrap gap-2">
                  {['React 19', 'Supabase', 'Tailwind CSS', 'Vite', 'Framer Motion', 'Recharts', 'Phosphor Icons'].map(tech => (
                    <span key={tech}
                      className="text-[12px] font-medium text-accent bg-brand-container
                                 px-2.5 py-1 rounded-full">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
              <Divider />
              <CardRow
                icon={<GithubLogoIcon size={17} weight="fill" color={C.ink} />}
                label="View on GitHub"
                sublabel="pavannauhwar-git/kosha"
                href={REPO_URL}
                right={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke={C.inkMuted} strokeWidth="2">
                    <polyline points="9,18 15,12 9,6" />
                  </svg>
                }
              />
            </div>
          </motion.div>

          {/* ── Privacy ───────────────────────────────────────────── */}
          <motion.div variants={fadeUp}>
            <SectionLabel>Privacy</SectionLabel>
            <div className="card overflow-hidden p-0">
              <div className="flex items-start gap-3 px-4 py-3.5">
                <div className="w-9 h-9 rounded-chip bg-brand-container
                                flex items-center justify-center shrink-0 mt-0.5">
                  <LockIcon size={17} weight="duotone" color={C.brand} />
                </div>
                <p className="text-[13px] text-ink-2 leading-relaxed flex-1 pt-1">
                  Your data lives in your own Supabase project, protected by
                  row-level security. No telemetry, no tracking pixels, no third-party data sharing — ever.
                </p>
              </div>
            </div>
          </motion.div>

          {/* ── Support ───────────────────────────────────────────── */}
          <motion.div variants={fadeUp}>
            <SectionLabel>Support Kosha</SectionLabel>
            <div className="card overflow-hidden p-0">
              <CardRow
                icon={<CurrencyInrIcon size={17} weight="bold" color={C.brand} />}
                label="Pay via UPI"
                sublabel={UPI_ID}
                onClick={copyUpi}
                right={
                  copied
                    ? <CheckIcon size={15} weight="bold" color={C.income} />
                    : <CopyIcon size={15} color={C.inkMuted} />
                }
              />
            </div>
          </motion.div>

          {/* ── Footer ────────────────────────────────────────────── */}
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
      </div>
    </div>
  )
}
