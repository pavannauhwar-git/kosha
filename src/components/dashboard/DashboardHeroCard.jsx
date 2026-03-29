import { memo } from 'react'
import { motion } from 'framer-motion'
import { fmt } from '../../lib/utils'
import { C } from '../../lib/colors'

/**
 * DashboardHeroCard
 *
 * Extracted from Dashboard.jsx to prevent the entire page re-rendering
 * when unrelated data (e.g. recent transactions list) updates.
 *
 * Wrapped in memo: only re-renders when its own props change.
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
    <motion.div className="card-hero p-6 relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <p className="text-caption font-bold tracking-widest uppercase"
          style={{ color: C.heroAccent }}>
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
          <div className="px-1.5 py-0.5 rounded-full bg-black/10 text-[10px] font-bold text-black/40 uppercase tracking-wider">
            Tap
          </div>
        </div>
        <p className="text-hero font-bold text-ink leading-none tracking-tight tabular-nums">
          {heroMode === 'balance'
            ? (runningBalance !== null ? fmt(runningBalance) : '—')
            : (safeToSpend    !== null ? fmt(safeToSpend)    : '—')}
        </p>
      </div>

      <div className="mt-2 mb-5 inline-flex items-center px-2.5 py-1 rounded-pill"
        style={{ background: C.heroAccentBg }}>
        <span className="text-caption font-semibold" style={{ color: C.heroAccentSolid }}>
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
            className="flex-1 min-w-0 px-2 sm:px-3 py-2.5 rounded-2xl"
            style={{ background: C.heroStatBg }}
          >
            <p className="text-[11px] sm:text-caption mb-0.5 truncate"
              style={{ color: C.heroLabel }}>{s.label}</p>
            <p className="text-[12px] sm:text-label font-bold text-ink tabular-nums truncate">
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
          <span className="text-caption font-bold" style={{ color: C.heroAccentSolid }}>
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
