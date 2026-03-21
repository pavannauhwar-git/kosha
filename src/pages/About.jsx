import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import {
  HeartIcon, CodeIcon, CurrencyInrIcon, CopyIcon, CheckIcon, CoffeeIcon, GithubLogoIcon,
  SparkleIcon, LockIcon, StarIcon,
} from '@phosphor-icons/react'
import { C } from '../lib/colors'
import KoshaLogo from '../components/KoshaLogo'
import { CHANGELOG } from '../lib/changelog'

const fadeUp = {
  hidden: { opacity: 0, y: 6 },
  show: { opacity: 1, y: 0, transition: { duration: 0.18, ease: 'easeOut' } },
}
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
}

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

function CardRow({ icon, label, sublabel, right, onClick, href, destructive = false }) {
  const inner = (
    <>
      <div className={`w-9 h-9 rounded-chip flex items-center justify-center shrink-0
                       ${destructive ? 'bg-expense-bg' : 'bg-brand-container'}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-medium text-ink leading-snug">{label}</p>
        {sublabel && <p className="text-[12px] text-ink-3 mt-0.5">{sublabel}</p>}
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

function Divider() {
  return <div className="h-px bg-kosha-border mx-4" />
}

export default function About() {
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)
  const [showAllVersions, setShowAllVersions] = useState(false)

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
        className="sticky top-0 z-20 bg-kosha-bg/90 backdrop-blur-md
                   px-4 py-3 flex items-center gap-3 border-b border-kosha-border"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 1rem)' }}
      >
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-kosha-surface border border-kosha-border
                     flex items-center justify-center active:bg-kosha-surface-2"
        >
          <ArrowLeft size={16} className="text-ink-2" />
        </button>
        <h1 className="text-[17px] font-bold text-ink tracking-tight">About</h1>
      </div>

      <div className="px-4 pt-6 pb-24 max-w-[560px] mx-auto">
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">

          {/* ── Hero — text left, logo right ──────────────────────── */}
          <motion.div variants={fadeUp}
            className="flex items-center justify-between gap-4 px-1 pb-2"
          >
            <div>
              <h2 className="text-[28px] font-bold text-ink tracking-tight leading-tight">
                Kosha
              </h2>
              <p className="text-caption font-semibold text-ink-3 tracking-widest uppercase mt-1">
                Your Financial Sheath
              </p>
            </div>
            <KoshaLogo size={56} />
          </motion.div>

          {/* ── About ─────────────────────────────────────────────── */}
          <motion.div variants={fadeUp}>
            <SectionLabel>About</SectionLabel>
            <div className="card overflow-hidden p-0">
              <CardRow
                icon={<CodeIcon size={17} weight="duotone" color={C.brand} />}
                label="Built by Pavan Kumar Nauhwar"
                sublabel="Developer · India"
                href={LINKEDIN}
                right={
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke={C.ink4} strokeWidth="2">
                    <polyline points="9,18 15,12 9,6" />
                  </svg>
                }
              />
              <Divider />
              <div className="px-4 py-3.5">
                <p className="text-[14px] text-ink-2 leading-relaxed">
                  A finance tracker built for people who want clarity, not clutter.
                  No ads, no subscriptions — just clean personal finance that stays out of your way.
                </p>
              </div>
            </div>
          </motion.div>

          {/* ── What's New ────────────────────────────────────────── */}
          <motion.div variants={fadeUp}>
            <SectionLabel>What's New</SectionLabel>
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
                          <p className="text-[15px] font-semibold text-ink">Version {release.version}</p>
                          <p className="text-[12px] text-ink-3 mt-0.5">{release.date}</p>
                        </div>
                      </div>
                      {ri === 0 && (
                        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full
                               bg-income-bg text-income-text">
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

              {/* Toggle — only shows if there's more than 1 release */}
              {CHANGELOG.length > 1 && (
                <>
                  <Divider />
                  <button
                    onClick={() => setShowAllVersions(v => !v)}
                    className="w-full px-4 py-3 text-[13px] font-semibold text-brand
                     text-center active:bg-kosha-surface-2 transition-colors"
                  >
                    {showAllVersions
                      ? 'Hide older versions'
                      : `Show older versions (${CHANGELOG.length - 1})`}
                  </button>
                </>
              )}

            </div>
          </motion.div>

          {/* ── Built With ────────────────────────────────────────── */}
          <motion.div variants={fadeUp}>
            <SectionLabel>Built With</SectionLabel>
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
                    stroke={C.ink4} strokeWidth="2">
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
                <div className="flex-1">
                  <p className="text-[15px] font-medium text-ink leading-snug">
                    Your data stays yours
                  </p>
                  <p className="text-[13px] text-ink-2 leading-relaxed mt-1.5">
                    All financial data is stored in your own Supabase instance, protected by
                    row-level security. No analytics, no tracking, no third-party data sharing.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── Support ───────────────────────────────────────────── */}
          <motion.div variants={fadeUp}>
            <SectionLabel>Support Kosha</SectionLabel>
            <div className="card overflow-hidden p-0">
              <div className="flex items-start gap-3 px-4 py-3.5">
                <div className="w-9 h-9 rounded-chip bg-brand-container
                                flex items-center justify-center shrink-0 mt-0.5">
                  <CoffeeIcon size={17} weight="duotone" color={C.brand} />
                </div>
                <p className="text-[13px] text-ink-2 leading-relaxed flex-1">
                  If Kosha helps you manage your money better, consider supporting its
                  development. Every contribution keeps this project alive and ad-free.
                </p>
              </div>
              <Divider />
              <CardRow
                icon={<CurrencyInrIcon size={17} weight="bold" color={C.brand} />}
                label="Pay via UPI"
                sublabel={UPI_ID}
                onClick={copyUpi}
                right={
                  copied
                    ? <CheckIcon size={15} weight="bold" className="text-income-text" />
                    : <CopyIcon size={15} className="text-ink-3" />
                }
              />
            </div>
          </motion.div>

          {/* ── Footer ────────────────────────────────────────────── */}
          <motion.div variants={fadeUp}
            className="flex items-center justify-center gap-1.5 pt-2 pb-2"
          >
            <p className="text-caption text-ink-4">
              Kosha v{CHANGELOG[0].version} · Made with
            </p>
            <HeartIcon size={12} weight="fill" className="text-expense-text" />
            <p className="text-caption text-ink-4">in India</p>
          </motion.div>

        </motion.div>
      </div>
    </div>
  )
}
