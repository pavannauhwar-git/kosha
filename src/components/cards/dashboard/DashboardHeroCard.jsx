import { memo } from 'react'
import { motion } from 'framer-motion'
import { fmt } from '../../../lib/utils'
import { C } from '../../../lib/colors'

function getHeroAmountClass(length) {
  if (length <= 11) return 'text-[clamp(1.92rem,8.9vw,3.12rem)]'
  if (length <= 14) return 'text-[clamp(1.72rem,8.1vw,2.78rem)]'
  if (length <= 17) return 'text-[clamp(1.5rem,7.2vw,2.44rem)]'
  return 'text-[clamp(1.28rem,6.2vw,2.12rem)]'
}

function getHeroStatClass(length) {
  if (length <= 10) return 'text-[clamp(0.82rem,3.2vw,1rem)] sm:text-[14px]'
  if (length <= 13) return 'text-[clamp(0.76rem,2.95vw,0.94rem)] sm:text-[13px]'
  return 'text-[clamp(0.7rem,2.7vw,0.88rem)] sm:text-[12px]'
}

const DashboardHeroCard = memo(function DashboardHeroCard({
  now,
  runningBalance,
  rate,
  earned,
  spent,
  invested,
  bills,
  heroMode,
  onSetHeroMode,
}) {
  const safeToSpend = runningBalance !== null
    ? Math.max(0, runningBalance - bills.reduce((acc, b) => acc + (Number(b.amount) || 0), 0))
    : null

  const mainValueText = heroMode === 'balance'
    ? (runningBalance !== null ? fmt(runningBalance) : '—')
    : (safeToSpend !== null ? fmt(safeToSpend) : '—')
  const mainValueClass = getHeroAmountClass(mainValueText.length)

  const heroBadgeStyle = {
    background: C.heroAccentBg,
    border: '1px solid rgba(255,255,255,0.16)',
  }

  const statChipStyle = {
    background: C.heroStatBg,
    border: '1px solid rgba(255,255,255,0.14)',
  }

  return (
    <motion.div className="card-hero p-5 sm:p-6 relative overflow-hidden">

      {/* Top row — label + mode switch */}
      <div className="flex items-center justify-between mb-3.5 gap-2">
        <p className="text-[10px] font-semibold tracking-[0.18em] uppercase"
          style={{ color: C.heroAccent }}>
          {heroMode === 'balance' ? 'Total balance' : 'Safe to spend'}
        </p>

        <div className="inline-flex items-center rounded-pill p-0.5"
          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)' }}>
          <button
            type="button"
            onClick={() => onSetHeroMode?.('balance')}
            className={`h-6 px-2.5 rounded-pill text-[10px] font-semibold transition-colors ${heroMode === 'balance' ? 'text-white' : 'text-white/70 hover:text-white'}`}
            style={heroMode === 'balance' ? { background: 'rgba(255,255,255,0.2)' } : undefined}
          >
            Balance
          </button>
          <button
            type="button"
            onClick={() => onSetHeroMode?.('safe')}
            className={`h-6 px-2.5 rounded-pill text-[10px] font-semibold transition-colors ${heroMode === 'safe' ? 'text-white' : 'text-white/70 hover:text-white'}`}
            style={heroMode === 'safe' ? { background: 'rgba(255,255,255,0.2)' } : undefined}
          >
            Safe
          </button>
        </div>
      </div>

      {/* Main amount — large */}
      <div>
        <p className={`${mainValueClass} font-bold text-white leading-[0.95] tracking-tight tabular-nums max-w-full whitespace-normal [overflow-wrap:anywhere]`}>
          {mainValueText}
        </p>
      </div>

      {/* Savings badge */}
      <div
        className="mt-2.5 mb-4 inline-flex items-center px-2.5 py-1 rounded-pill"
        style={heroBadgeStyle}
      >
        <span className="text-[12px] font-semibold tracking-wide" style={{ color: C.heroAccent }}>
          {rate}% saved this month
        </span>
      </div>

      {/* Divider */}
      <div className="mb-3.5" style={{ borderTop: `1px solid ${C.heroDivider}` }} />

      {/* Stat chips */}
      <div className="flex justify-between gap-2">
        {[
          { label: 'Earned',   val: earned   },
          { label: 'Spent',    val: spent    },
          { label: 'Invested', val: invested },
        ].map((s, i) => {
          const statText = fmt(s.val)
          const statValueClass = getHeroStatClass(statText.length)

          return (
          <motion.div key={s.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.06 * i, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 min-w-0 px-2.5 py-2 rounded-2xl"
            style={statChipStyle}
          >
            <p className="text-[10px] sm:text-[11px] mb-0.5 truncate tracking-wide"
              style={{ color: C.heroLabel }}>{s.label}</p>
            <p className={`${statValueClass} font-semibold text-white tabular-nums leading-tight tracking-[-0.01em] whitespace-normal [overflow-wrap:anywhere]`}>
              {statText}
            </p>
          </motion.div>
        )})}
      </div>

      {/* Savings progress bar */}
      <div className="mt-3.5">
        <div className="flex justify-between mb-2">
          <span className="text-[11px] tracking-wide" style={{ color: C.heroLabel }}>
            Savings rate
          </span>
          <span className="text-[12px] font-semibold" style={{ color: C.heroAccent }}>
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
