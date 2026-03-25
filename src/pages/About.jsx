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

  function copyUpi() {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(UPI_ID)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="page">
      <header className="relative min-h-[34vh] md:min-h-[38vh] -mx-4 px-4 pt-4 pb-7 flex flex-col justify-end mb-2"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 1.4rem)' }}>
        <div className="absolute inset-x-0 top-0 h-[70%] bg-gradient-to-b from-brand/12 via-brand-accent/6 to-transparent pointer-events-none" />
        <div className="relative z-[1]">
          <button
            onClick={() => navigate(-1)}
            className="oneui-glass oneui-squircle w-10 h-10 flex items-center justify-center mb-6"
          >
            <ArrowLeftIcon size={16} className="text-ink-2" />
          </button>
          <h1 className="oneui-title text-ink m-0">About</h1>
          <p className="text-label text-ink-3 mt-1.5">Product story, versions, and contribution links.</p>
        </div>
      </header>

      <div className="pb-24 max-w-[560px] mx-auto">
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">

          {/* ── Identity strip ────────────────────────────────────── */}
          <motion.div variants={fadeUp}
            className="flex items-center gap-4 px-1 pb-2"
          >
            <KoshaLogo size={48} />
            <div>
              <p className="text-[16px] font-bold text-ink leading-snug">
                Personal finance, simplified
              </p>
              <p className="text-[12px] text-ink-3 mt-1">
                No ads · No subscriptions · Your data
              </p>
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
              v{CHANGELOG[0].version} · Made with
            </p>
            <HeartIcon size={12} weight="fill" color={C.expense} />
            <p className="text-caption text-ink-4">in India</p>
          </motion.div>

        </motion.div>
      </div>
    </div>
  )
}
