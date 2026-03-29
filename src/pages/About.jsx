import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeftIcon,
  HeartIcon, CodeIcon, CurrencyInrIcon, CopyIcon, CheckIcon,
  GithubLogoIcon, LockIcon, StarIcon, CaretDownIcon, CaretUpIcon,
  RocketLaunchIcon, ShieldCheckIcon, LightningIcon,
} from '@phosphor-icons/react'
import { C } from '../lib/colors'
import KoshaLogo from '../components/KoshaLogo'
import { CHANGELOG } from '../lib/changelog'
import Divider from '../components/common/Divider'
import { createFadeUp, createStagger } from '../lib/animations'

const fadeUp = createFadeUp(8, 0.22)
const stagger = createStagger(0.06, 0.06)

const UPI_ID = 'kumar.pavan.pk96@okicici'
const REPO_URL = 'https://github.com/pavannauhwar-git/kosha'
const LINKEDIN = 'https://www.linkedin.com/in/pavannauhwar/'

function SectionLabel({ children }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-[0.10em] mb-3 px-1"
       style={{ color: '#6b7c93' }}>
      {children}
    </p>
  )
}

function GlassCard({ children, className = '', style = {} }) {
  return (
    <div
      className={`rounded-[20px] ${className}`}
      style={{
        background: '#ffffff',
        border: '1px solid rgba(0,0,0,0.08)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function CardRow({ icon, label, sublabel, right, onClick, href }) {
  const inner = (
    <>
      <div
        className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0"
        style={{ background: 'rgba(99,91,255,0.08)', border: '1px solid rgba(99,91,255,0.12)' }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-ink leading-snug">{label}</p>
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
    <div className="min-h-dvh" style={{ background: '#f6f9fc' }}>

      {/* ── Sticky header ─────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-20 px-4 py-3 flex items-center gap-3"
        style={{
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(0,0,0,0.06)',
          paddingTop: 'max(env(safe-area-inset-top, 0px), 0.75rem)',
          paddingBottom: '0.75rem',
        }}
      >
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform"
          style={{ background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.08)' }}
        >
          <ArrowLeftIcon size={16} color={C.ink} />
        </button>
        <h1 className="text-[17px] font-bold text-ink tracking-tight">About</h1>
      </div>

      <div className="px-4 pt-6 pb-24 max-w-[560px] mx-auto">
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-7">

          {/* ── Hero section — full mesh gradient ─────────────────── */}
          <motion.div variants={fadeUp}>
            <div
              className="relative overflow-hidden rounded-hero p-6"
              style={{
                background: '#ffffff',
                boxShadow: '0 24px 64px rgba(10,37,64,0.08), 0 8px 24px rgba(0,0,0,0.04)',
                border: '1px solid rgba(0,0,0,0.08)',
              }}
            >
              {/* Subtle brand glow */}
              <div
                className="absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl pointer-events-none"
                style={{ background: 'rgba(99,91,255,0.10)' }}
              />

              <div className="relative z-[1]">
                <div className="flex items-center gap-4 mb-4">
                  <KoshaLogo size={52} />
                  <div>
                    <p
                      className="text-[20px] font-bold leading-tight"
                      style={{ color: '#0a2540' }}
                    >
                      Kosha
                    </p>
                    <p
                      className="text-[13px] font-medium mt-0.5"
                      style={{ color: '#6b7c93' }}
                    >
                      Personal finance, simplified
                    </p>
                  </div>
                </div>

                <p
                  className="text-[14px] leading-relaxed max-w-[440px] mb-5"
                  style={{ color: '#6b7c93' }}
                >
                  Built for clarity and calm. Capture money movement fast, trust your numbers,
                  and make better decisions without noise.
                </p>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { label: 'Version', value: `v${latestVersion}` },
                    { label: 'Releases', value: String(releaseCount) },
                    { label: 'Shipped', value: `${shippedItems}+` },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="rounded-[14px] px-3 py-2.5"
                      style={{
                        background: 'rgba(99,91,255,0.06)',
                        border: '1px solid rgba(99,91,255,0.12)',
                      }}
                    >
                      <p className="text-[10px] font-medium uppercase tracking-wider"
                         style={{ color: '#6b7c93' }}>{label}</p>
                      <p className="text-[14px] font-bold mt-0.5"
                         style={{ color: '#0a2540' }}>{value}</p>
                    </div>
                  ))}
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-2 gap-2.5 mt-4">
                  <button
                    type="button"
                    onClick={() => navigate('/guide')}
                    className="h-11 rounded-[12px] text-[13px] font-semibold
                               active:scale-[0.97] transition-all duration-100"
                    style={{
                      background: 'linear-gradient(135deg, #635bff 0%, #7a73ff 100%)',
                      color: '#ffffff',
                      boxShadow: '0 4px 16px rgba(99,91,255,0.35)',
                    }}
                  >
                    Product guide
                  </button>
                  <a
                    href={REPO_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="h-11 rounded-[12px] text-[13px] font-semibold inline-flex items-center
                               justify-center active:scale-[0.97] transition-all duration-100"
                    style={{
                      background: 'rgba(10,37,64,0.06)',
                      color: '#0a2540',
                      border: '1px solid rgba(10,37,64,0.12)',
                    }}
                  >
                    View GitHub
                  </a>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── Why Kosha — feature pillars ────────────────────────── */}
          <motion.div variants={fadeUp}>
            <SectionLabel>Why Kosha</SectionLabel>
            <GlassCard className="p-5">
              <p className="text-[14px] text-ink-2 leading-relaxed mb-5">
                Most finance tools either overwhelm with dashboards or hide the details you need.
                Kosha keeps direction and precision in one flow.
              </p>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: <RocketLaunchIcon size={18} weight="duotone" color={C.brand} />, label: 'Fast capture' },
                  { icon: <LightningIcon size={18} weight="duotone" color={C.brand} />, label: 'Clear insights' },
                  { icon: <ShieldCheckIcon size={18} weight="duotone" color={C.brand} />, label: 'Privacy first' },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex flex-col items-center gap-2 rounded-[14px] py-3 px-2"
                    style={{ background: 'rgba(99,91,255,0.06)', border: '1px solid rgba(99,91,255,0.10)' }}
                  >
                    {item.icon}
                    <span className="text-[11px] font-semibold text-ink-2 text-center">{item.label}</span>
                  </div>
                ))}
              </div>
            </GlassCard>
          </motion.div>

          {/* ── Author ────────────────────────────────────────────── */}
          <motion.div variants={fadeUp}>
            <SectionLabel>Author</SectionLabel>
            <GlassCard className="overflow-hidden p-0">
              <CardRow
                icon={<CodeIcon size={18} weight="duotone" color={C.brandLight} />}
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
            </GlassCard>
          </motion.div>

          {/* ── What's New ────────────────────────────────────────── */}
          <motion.div variants={fadeUp}>
            <SectionLabel>What's new</SectionLabel>
            <GlassCard className="overflow-hidden p-0">
              {CHANGELOG
                .slice(0, showAllVersions ? CHANGELOG.length : 1)
                .map((release, ri) => (
                  <div key={release.version}>
                    {ri > 0 && <Divider />}
                    <div className="flex items-center justify-between px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0"
                          style={{ background: 'rgba(99,91,255,0.12)', border: '1px solid rgba(99,91,255,0.15)' }}
                        >
                          <StarIcon size={18} weight="duotone" color={C.brandLight} />
                        </div>
                        <div>
                          <p className="text-[15px] font-semibold text-ink">
                            v{release.version}
                          </p>
                          <p className="text-[12px] text-ink-3 mt-0.5">{release.date}</p>
                        </div>
                      </div>
                      {ri === 0 && (
                        <span
                          className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                          style={{ background: 'rgba(99,91,255,0.08)', color: C.brand }}
                        >
                          Latest
                        </span>
                      )}
                    </div>
                    <Divider />
                    <div className="px-4 py-3.5 space-y-2.5">
                      {release.items.map((item, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <div
                            className="w-1.5 h-1.5 rounded-full mt-[7px] shrink-0"
                            style={{ background: C.brand }}
                          />
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
                    className="w-full px-4 py-3 text-[13px] font-semibold text-center
                               active:bg-kosha-surface-2 transition-colors
                               flex items-center justify-center gap-1.5"
                    style={{ color: C.brand }}
                  >
                    {showAllVersions
                      ? <>Hide older versions <CaretUpIcon size={13} weight="bold" /></>
                      : <>Older versions ({CHANGELOG.length - 1}) <CaretDownIcon size={13} weight="bold" /></>
                    }
                  </button>
                </>
              )}
            </GlassCard>
          </motion.div>

          {/* ── Built With ────────────────────────────────────────── */}
          <motion.div variants={fadeUp}>
            <SectionLabel>Built with</SectionLabel>
            <GlassCard className="overflow-hidden p-0">
              <div className="px-4 py-4">
                <div className="flex flex-wrap gap-2">
                  {['React 18', 'Supabase', 'Tailwind CSS', 'Vite', 'Framer Motion', 'Phosphor Icons'].map(tech => (
                    <span
                      key={tech}
                      className="text-[12px] font-semibold px-3 py-1.5 rounded-full"
                      style={{
                        background: 'rgba(99,91,255,0.06)',
                        color: C.brandLight,
                        border: '1px solid rgba(99,91,255,0.12)',
                      }}
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>
              <Divider />
              <CardRow
                icon={<GithubLogoIcon size={18} weight="fill" color={C.ink} />}
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
            </GlassCard>
          </motion.div>

          {/* ── Privacy ───────────────────────────────────────────── */}
          <motion.div variants={fadeUp}>
            <SectionLabel>Privacy</SectionLabel>
            <GlassCard className="overflow-hidden p-0">
              <div className="flex items-start gap-3.5 px-4 py-4">
                <div
                  className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 mt-0.5"
                  style={{ background: 'rgba(14,159,110,0.08)', border: '1px solid rgba(14,159,110,0.12)' }}
                >
                  <LockIcon size={18} weight="duotone" color={C.income} />
                </div>
                <p className="text-[14px] text-ink-2 leading-relaxed flex-1 pt-0.5">
                  Your data lives in your own Supabase instance, protected by
                  row-level security. No analytics, no tracking, no third-party sharing.
                </p>
              </div>
            </GlassCard>
          </motion.div>

          {/* ── Support ───────────────────────────────────────────── */}
          <motion.div variants={fadeUp}>
            <SectionLabel>Support Kosha</SectionLabel>
            <GlassCard className="overflow-hidden p-0">
              <CardRow
                icon={<CurrencyInrIcon size={18} weight="bold" color={C.brand} />}
                label="Pay via UPI"
                sublabel={UPI_ID}
                onClick={copyUpi}
                right={
                  copied
                    ? <CheckIcon size={16} weight="bold" color={C.income} />
                    : <CopyIcon size={16} color={C.inkMuted} />
                }
              />
            </GlassCard>
          </motion.div>

          {/* ── Footer ────────────────────────────────────────────── */}
          <motion.div variants={fadeUp}
            className="flex items-center justify-center gap-1.5 pt-1 pb-2"
          >
            <p className="text-[12px] text-ink-4">
              v{latestVersion} · Made with
            </p>
            <HeartIcon size={12} weight="fill" color={C.expense} />
            <p className="text-[12px] text-ink-4">in India</p>
          </motion.div>

        </motion.div>
      </div>
    </div>
  )
}
