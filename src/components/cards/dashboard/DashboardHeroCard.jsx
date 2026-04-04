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

  return (
    <motion.div className="card-hero p-6 sm:p-7 relative overflow-hidden">

      {/* Top row — label + watermark */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] font-semibold tracking-[0.18em] uppercase"
          style={{ color: C.heroAccent }}>
          {heroMode === 'balance' ? 'Total balance' : 'Safe to spend'}
        </p>
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase"
          style={{ color: C.heroDimmer }}>KOSHA</p>
      </div>

      {/* Main amount — large */}
      <div
        onClick={onHeroModeToggle}
        className="cursor-pointer active:scale-[0.99] transition-transform duration-200"
      >
        <p className="text-[clamp(1.35rem,6.8vw,2.375rem)] font-bold text-white leading-[0.95] tracking-tight tabular-nums whitespace-nowrap max-w-full">
          {heroMode === 'balance'
            ? (runningBalance !== null ? fmt(runningBalance) : '—')
            : (safeToSpend    !== null ? fmt(safeToSpend)    : '—')}
        </p>
      </div>

      {/* Savings badge */}
      <div
        className="mt-3 mb-5 inline-flex items-center px-3 py-1.5 rounded-pill"
        style={{ background: 'rgba(201,169,110,0.15)', border: '1px solid rgba(201,169,110,0.25)' }}
      >
        <span className="text-[11px] font-semibold tracking-wide" style={{ color: C.heroAccent }}>
          {rate}% saved this month
        </span>
      </div>

      {/* Divider */}
      <div className="mb-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} />

      {/* Stat chips */}
      <div className="flex justify-between gap-2 sm:gap-3">
        {[
          { label: 'Earned',   val: earned   },
          { label: 'Spent',    val: spent    },
          { label: 'Invested', val: invested },
        ].map(s => (
          <div key={s.label}
            className="flex-1 min-w-0 px-3 sm:px-4 py-2.5 rounded-2xl"
            style={{ background: C.heroStatBg }}
          >
            <p className="text-[10px] sm:text-[11px] mb-0.5 truncate tracking-wide"
              style={{ color: C.heroLabel }}>{s.label}</p>
            <p className="text-[11px] sm:text-[14px] font-semibold text-white tabular-nums leading-none whitespace-nowrap">
              <span className="sm:hidden">{fmt(s.val, true)}</span>
              <span className="hidden sm:inline">{fmt(s.val)}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Savings progress bar */}
      <div className="mt-4">
        <div className="flex justify-between mb-2">
          <span className="text-[10px] tracking-wide" style={{ color: C.heroLabel }}>
            Savings rate
          </span>
          <span className="text-[11px] font-semibold" style={{ color: C.heroAccent }}>
            {rate}%
          </span>
        </div>
        <div className="bar-dark-track">
          <motion.div className="bar-dark-fill"
            initial={{ width: 0 }} animate={{ width: `${rate}%` }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>
    </motion.div>
  )
})

export default DashboardHeroCard
