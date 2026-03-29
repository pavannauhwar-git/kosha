import { memo } from 'react'
import { motion } from 'framer-motion'
import { fmt } from '../../lib/utils'
import { C } from '../../lib/colors'

/**
 * DashboardHeroCard — Stripe-inspired mesh gradient hero
 */
const DashboardHeroCard = memo(function DashboardHeroCard({
  now,
  runningBalance,
  rate,
  earned,
  spent,
  invested,
  bills,
  heroMode,
  onHeroModeToggle,
}) {
  const safeToSpend = runningBalance !== null
    ? Math.max(0, runningBalance - bills.reduce((acc, b) => acc + (Number(b.amount) || 0), 0))
    : null

  return (
    <motion.div className="card-hero card-hero-dashboard p-6 relative overflow-hidden">
      {/* Subtle highlight shimmer */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-hero">
        <div className="absolute -top-24 -left-24 w-72 h-72 rounded-full opacity-30"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.40) 0%, transparent 70%)' }} />
      </div>

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-5">
          <p className="text-[11px] font-semibold tracking-[0.12em] uppercase"
            style={{ color: C.heroAccent }}>
            Balance overview
          </p>
          <p className="text-[11px] font-bold tracking-[0.15em]"
            style={{ color: C.heroDimmer }}>KOSHA</p>
        </div>

        <div
          onClick={onHeroModeToggle}
          className="cursor-pointer active:scale-[0.98] transition-transform"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <p className="text-[13px] font-medium" style={{ color: C.heroLabel }}>
              {heroMode === 'balance' ? 'Total balance' : 'Safe to spend'}
            </p>
            <div className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider"
              style={{ background: 'rgba(255,255,255,0.20)', color: '#ffffff' }}>
              Tap
            </div>
          </div>
          <p className="text-[36px] sm:text-[42px] font-bold text-white leading-none tracking-tight tabular-nums"
            style={{ fontFeatureSettings: '"tnum"' }}>
            {heroMode === 'balance'
              ? (runningBalance !== null ? fmt(runningBalance) : '—')
              : (safeToSpend    !== null ? fmt(safeToSpend)    : '—')}
          </p>
        </div>

        <div className="mt-3 mb-5 inline-flex items-center px-3 py-1.5 rounded-pill"
          style={{ background: C.heroAccentBg }}>
          <span className="text-[12px] font-semibold" style={{ color: C.heroAccentSolid }}>
            {rate}% saved this month
          </span>
        </div>

        <div className="mb-4" style={{ borderTop: `1px solid ${C.heroDivider}` }} />

        <div className="flex justify-between gap-2">
          {[
            { label: 'Earned',   val: earned },
            { label: 'Spent',    val: spent },
            { label: 'Invested', val: invested },
          ].map(s => (
            <div key={s.label}
              className="flex-1 min-w-0 px-2 sm:px-3 py-2.5 sm:py-3 rounded-2xl"
              style={{ background: C.heroStatBg }}
            >
              <p className="text-[11px] mb-1 truncate"
                style={{ color: C.heroLabel }}>{s.label}</p>
              <p className="text-[11px] sm:text-[13px] font-bold text-white tabular-nums truncate">
                {fmt(s.val)}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5">
          <div className="flex justify-between mb-2">
            <span className="text-[12px] font-medium" style={{ color: C.heroLabel }}>
              Savings rate
            </span>
            <span className="text-[12px] font-bold" style={{ color: C.heroAccentSolid }}>
              {rate}%
            </span>
          </div>
          <div className="bar-dark-track">
            <motion.div className="bar-dark-fill"
              initial={{ width: 0 }} animate={{ width: `${rate}%` }}
              transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  )
})

export default DashboardHeroCard
