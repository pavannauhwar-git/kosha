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
import BackHeaderPage from '../components/layout/BackHeaderPage'
import Button from '../components/ui/Button'

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
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-brand-container border border-brand/15">
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

  function openExternal(url) {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <BackHeaderPage
      title="About"
      onBack={() => navigate(-1)}
      rightSlot={(
        <button
          type="button"
          onClick={() => navigate('/')}
          className="w-9 h-9 rounded-pill flex items-center justify-center bg-kosha-surface-2 active:bg-kosha-border"
        >
          <Home size={16} className="text-ink-2" />
        </button>
      )}
    >
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">

          <motion.div variants={fadeUp} className="card p-0 overflow-hidden">
            <div className="px-4 py-4 bg-kosha-surface-2 border-b border-kosha-border flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-kosha-surface border border-kosha-border flex items-center justify-center">
                <KoshaLogo size={34} />
              </div>
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
                  variant="primary"
                  size="md"
                  fullWidth
                  onClick={() => navigate('/guide')}
                  icon={<Sparkles size={14} />}
                >
                  Open product guide
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  fullWidth
                  onClick={() => openExternal(REPO_URL)}
                  icon={<ExternalLink size={14} />}
                >
                  View GitHub
                </Button>
              </div>
            </div>
          </motion.div>

          <motion.div variants={fadeUp}>
            <SectionLabel>Design Principles</SectionLabel>
            <div className="card p-4 space-y-2.5">
              <div className="mini-panel px-3 py-2.5">
                <p className="text-[12px] font-semibold text-ink">Direction first</p>
                <p className="text-[11px] text-ink-3 mt-0.5">Dashboard gives fast orientation before deep edits.</p>
              </div>
              <div className="mini-panel px-3 py-2.5">
                <p className="text-[12px] font-semibold text-ink">Precision always</p>
                <p className="text-[11px] text-ink-3 mt-0.5">Transactions, bills, loans, and reconciliation preserve record quality.</p>
              </div>
              <div className="mini-panel px-3 py-2.5">
                <p className="text-[12px] font-semibold text-ink">Privacy by default</p>
                <p className="text-[11px] text-ink-3 mt-0.5">No telemetry or ad tracking. Your Supabase project is your source of truth.</p>
              </div>
            </div>
          </motion.div>

          <motion.div variants={fadeUp}>
            <SectionLabel>Release Timeline</SectionLabel>
            <div className="card overflow-hidden p-0">
              {CHANGELOG
                .slice(0, showAllVersions ? CHANGELOG.length : 2)
                .map((release, ri) => (
                  <div key={release.version}>
                    {ri > 0 && <Divider />}
                    <div className="flex items-center justify-between px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-brand-container border border-brand/15
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
                    className="w-full px-4 py-3 text-[13px] font-semibold text-brand
                               text-center active:bg-kosha-surface-2 transition-colors
                               flex items-center justify-center gap-1.5"
                  >
                    {showAllVersions
                      ? <>Hide older releases <CaretUpIcon size={13} weight="bold" /></>
                      : <>Show older releases ({CHANGELOG.length - 2}) <CaretDownIcon size={13} weight="bold" /></>
                    }
                  </button>
                </>
              )}
            </div>
          </motion.div>

          <motion.div variants={fadeUp}>
            <SectionLabel>Connect</SectionLabel>
            <div className="card overflow-hidden p-0">
              <CardRow
                icon={<CodeIcon size={17} weight="duotone" color={C.brand} />}
                label="Pavan Kumar Nauhwar"
                sublabel="Developer · India"
                href={LINKEDIN}
                right={<ExternalLink size={14} className="text-ink-3" />}
              />
              <Divider />
              <CardRow
                icon={<GithubLogoIcon size={17} weight="fill" color={C.ink} />}
                label="View on GitHub"
                sublabel="pavannauhwar-git/kosha"
                href={REPO_URL}
                right={<ExternalLink size={14} className="text-ink-3" />}
              />
              <Divider />
              <CardRow
                icon={<CurrencyInrIcon size={17} weight="bold" color={C.brand} />}
                label="Support Kosha"
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

          <motion.div variants={fadeUp}>
            <SectionLabel>Privacy And Stack</SectionLabel>
            <div className="card p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-container border border-brand/15 flex items-center justify-center shrink-0 mt-0.5">
                  <LockIcon size={17} weight="duotone" color={C.brand} />
                </div>
                <p className="text-[13px] text-ink-2 leading-relaxed flex-1">
                  Your data lives in your own Supabase project, protected by
                  row-level security. No telemetry, no tracking pixels, no third-party data sharing — ever.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-brand-container border border-brand/15 flex items-center justify-center shrink-0 mt-0.5">
                  <ShieldCheck size={16} className="text-brand" />
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
    </BackHeaderPage>
  )
}
