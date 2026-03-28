import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeftIcon,
  HeartIcon, CodeIcon, CurrencyInrIcon, CopyIcon, CheckIcon,
  GithubLogoIcon, LockIcon, StarIcon, CaretDownIcon, CaretUpIcon,
} from '@phosphor-icons/react'
import { C } from '../lib/colors'
import KoshaLogo from '../components/KoshaLogo'
import { CHANGELOG } from '../lib/changelog'
import Divider from '../components/common/Divider'
import { createFadeUp, createStagger } from '../lib/animations'

const fadeUp = createFadeUp(6, 0.18)
const stagger = createStagger(0.06, 0.04)

const UPI_ID = 'kumar.pavan.pk96@okicici'
const REPO_URL = 'https://github.com/pavannauhwar-git/kosha'
const LINKEDIN = 'https://www.linkedin.com/in/pavannauhwar/'

function SectionLabel({ children }) {
  return (
    <p className="text-[11px] font-bold text-ink-3 uppercase tracking-[0.08em] mb-2 px-1">
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

      {/* ── Sticky header ─────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-20 bg-kosha-bg/90 backdrop-blur-md px-4 py-3 flex items-center gap-3 border-b border-kosha-border"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0.75rem)', paddingBottom: '0.75rem' }}
      >
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-kosha-surface border border-kosha-border flex items-center justify-center active:bg-kosha-surface-2"
        >
          <ArrowLeftIcon size={16} className="text-ink-2" />
        </button>
        <h1 className="text-[17px] font-bold text-ink tracking-tight">About</h1>
      </div>

      <div className="px-4 pt-8 pb-24 max-w-[640px] mx-auto">
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-8">

          {/* ── Hero strip ────────────────────────────────────────── */}
          <motion.div variants={fadeUp} className="text-center py-3">
             <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-white shadow-md border border-kosha-border mb-3">
                <KoshaLogo size={28} />
             </div>
             <h1 className="text-display font-bold text-ink mb-2 tracking-tight">Kosha</h1>
             <p className="text-label text-ink-3 max-w-[480px] mx-auto leading-relaxed">
               Personal finance, simplified. Built for clarity and calm. Capture movement fast, trust your numbers, and make better decisions.
             </p>
             <div className="flex items-center justify-center gap-3 mt-5">
                <button
                  type="button"
                  onClick={() => navigate('/guide')}
                  className="h-11 px-6 rounded-pill bg-ink text-white text-[14px] font-medium whitespace-nowrap hover:bg-ink-2 transition-colors"
                >
                  Explore Guide
                </button>
                <a
                  href={REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-11 px-6 rounded-pill bg-white border border-kosha-border text-ink text-[14px] font-medium inline-flex items-center justify-center whitespace-nowrap hover:bg-kosha-surface-2 transition-colors shadow-sm"
                >
                  View GitHub
                </a>
             </div>
          </motion.div>

          <motion.div variants={fadeUp}>
             <div className="grid grid-cols-3 gap-3">
                <div className="card p-4 text-center">
                  <p className="text-[12px] font-medium tracking-wide text-ink-3 uppercase mb-1">Version</p>
                  <p className="text-[18px] font-bold text-ink">v{latestVersion}</p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-[12px] font-medium tracking-wide text-ink-3 uppercase mb-1">Releases</p>
                  <p className="text-[18px] font-bold text-ink">{releaseCount}</p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-[12px] font-medium tracking-wide text-ink-3 uppercase mb-1">Updates</p>
                  <p className="text-[18px] font-bold text-ink">{shippedItems}+</p>
                </div>
             </div>
          </motion.div>

          <motion.div variants={fadeUp}>
            <SectionLabel>Core Philosophy</SectionLabel>
            <div className="card p-6">
              <p className="text-[13px] text-ink-2 leading-relaxed">
                Most finance tools either overwhelm with dashboards or hide the details you need. Kosha is designed to keep both direction and precision in one flow: Dashboard for pulse, Transactions for truth, Reconciliation for trust.
              </p>
              <div className="flex flex-wrap gap-2 mt-3">
                {['Fast capture', 'Clear insights', 'Privacy first'].map((pill) => (
                  <span key={pill} className="text-[11px] font-semibold px-2.5 py-1 rounded-pill bg-brand-container text-brand-on">
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
                               bg-brand-container text-brand-on">
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
                    className="w-full px-4 py-3 text-[13px] font-semibold text-brand
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
                  {['React 18', 'Supabase', 'Tailwind CSS', 'Vite', 'Framer Motion', 'Phosphor Icons'].map(tech => (
                    <span key={tech}
                      className="text-[12px] font-medium text-brand bg-brand-container
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
                  Your data lives in your own Supabase instance, protected by
                  row-level security. No analytics, no tracking, no third-party sharing.
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
