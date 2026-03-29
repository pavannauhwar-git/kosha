import { memo } from 'react'
import { motion } from 'framer-motion'
import { fmt } from '../../../lib/utils'
import { C } from '../../../lib/colors'

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

  const heroAccentStrong = C.heroAccent
  const heroBadgeBg = 'linear-gradient(135deg, rgba(198, 255, 0, 0.92) 0%, rgba(228, 255, 112, 0.88) 100%)'
  const heroBadgeText = '#16376A'

  return (
    <motion.div className="card-hero p-6 relative overflow-hidden">
      <div className="flex items-center justify-between mb-3.5">
        <p className="text-caption font-bold tracking-widest uppercase"
          style={{ color: heroAccentStrong }}>
          Balance overview
        </p>
        <p className="text-caption font-bold tracking-widest"
          style={{ color: C.heroDimmer }}>KOSHA</p>
      </div>

      <div
        onClick={onHeroModeToggle}
        className="cursor-pointer active:scale-[0.98] transition-transform"
      >
        <div className="flex items-center gap-2 mb-1">
          <p className="text-caption font-medium" style={{ color: C.heroLabel }}>
            {heroMode === 'balance' ? 'Total balance' : 'Safe to spend'}
          </p>
          <div className="px-1.5 py-0.5 rounded-full bg-white/12 border border-white/10 text-[10px] font-bold text-white/80 uppercase tracking-wider">
            Tap
          </div>
        </div>
        <p className="text-hero font-bold text-white leading-[0.92] tracking-tight tabular-nums">
          {heroMode === 'balance'
            ? (runningBalance !== null ? fmt(runningBalance) : '—')
            : (safeToSpend    !== null ? fmt(safeToSpend)    : '—')}
        </p>
      </div>

      <div
        className="mt-2.5 mb-5 inline-flex items-center px-2.5 py-1 rounded-pill border"
        style={{ background: heroBadgeBg, borderColor: 'rgba(255,255,255,0.38)' }}
      >
        <span className="text-caption font-bold" style={{ color: heroBadgeText }}>
          {rate}% saved this month
        </span>
      </div>

      <div className="border-t mb-4" style={{ borderColor: C.heroDivider }} />

      <div className="flex justify-between gap-1.5 sm:gap-2">
        {[
          { label: 'Earned',   val: earned   },
          { label: 'Spent',    val: spent    },
          { label: 'Invested', val: invested },
        ].map(s => (
          <div key={s.label}
            className="flex-1 min-w-0 px-2 sm:px-3 py-2.5 rounded-2xl border border-white/10 backdrop-blur-[1px]"
            style={{ background: C.heroStatBg }}
          >
            <p className="text-[11px] sm:text-caption mb-0.5 truncate"
              style={{ color: C.heroLabel }}>{s.label}</p>
            <p className="text-[12px] sm:text-label font-bold text-white tabular-nums truncate">
              {fmt(s.val)}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <div className="flex justify-between mb-2">
          <span className="text-caption font-medium" style={{ color: C.heroLabel }}>
            Savings rate
          </span>
          <span className="text-caption font-bold" style={{ color: heroAccentStrong }}>
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
    </motion.div>
  )
})

export default DashboardHeroCard
