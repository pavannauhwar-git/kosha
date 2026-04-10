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
    <motion.div className="card-hero p-5 sm:p-6 relative overflow-hidden">

      {/* Top row — label + watermark */}
      <div className="flex items-center justify-between mb-3.5">
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
        <p className="text-[clamp(1.05rem,5.4vw,1.95rem)] font-bold text-white leading-[0.95] tracking-tight tabular-nums whitespace-nowrap max-w-full overflow-hidden text-ellipsis">
          {heroMode === 'balance'
            ? (runningBalance !== null ? fmt(runningBalance) : '—')
            : (safeToSpend    !== null ? fmt(safeToSpend)    : '—')}
        </p>
      </div>

      {/* Savings badge */}
      <div
        className="mt-2.5 mb-4 inline-flex items-center px-2.5 py-1 rounded-pill"
        style={{ background: 'rgba(201,169,110,0.15)', border: '1px solid rgba(201,169,110,0.25)' }}
      >
        <span className="text-[11px] font-semibold tracking-wide" style={{ color: C.heroAccent }}>
          {rate}% saved this month
        </span>
      </div>

      {/* Divider */}
      <div className="mb-3.5" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }} />

      {/* Stat chips */}
      <div className="flex justify-between gap-2">
        {[
          { label: 'Earned',   val: earned   },
          { label: 'Spent',    val: spent    },
          { label: 'Invested', val: invested },
        ].map((s, i) => (
          <motion.div key={s.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.06 * i, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 min-w-0 px-2.5 py-2 rounded-2xl"
            style={{ background: C.heroStatBg }}
          >
            <p className="text-[10px] sm:text-[11px] mb-0.5 truncate tracking-wide"
              style={{ color: C.heroLabel }}>{s.label}</p>
            <p className="text-[clamp(0.54rem,2.1vw,0.82rem)] sm:text-[13px] font-semibold text-white tabular-nums leading-tight tracking-[-0.01em] whitespace-nowrap overflow-hidden text-ellipsis">
              {fmt(s.val)}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Savings progress bar */}
      <div className="mt-3.5">
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
