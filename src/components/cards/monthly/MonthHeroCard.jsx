import { memo } from 'react'
import { motion } from 'framer-motion'
import { fmt, savingsRate } from '../../../lib/utils'
import { C } from '../../../lib/colors'
import { MONTH_NAMES } from '../../../lib/constants'

function getHeroAmountClass(length) {
  if (length <= 11) return 'text-[clamp(1.62rem,7.6vw,2.7rem)]'
  if (length <= 14) return 'text-[clamp(1.46rem,6.9vw,2.4rem)]'
  if (length <= 17) return 'text-[clamp(1.3rem,6.1vw,2.08rem)]'
  return 'text-[clamp(1.1rem,5.3vw,1.78rem)]'
}

function getHeroStatClass(length) {
  if (length <= 10) return 'text-[clamp(0.82rem,3.2vw,1rem)] sm:text-[14px]'
  if (length <= 13) return 'text-[clamp(0.76rem,2.95vw,0.94rem)] sm:text-[13px]'
  return 'text-[clamp(0.7rem,2.7vw,0.88rem)] sm:text-[12px]'
}

const MonthHeroCard = memo(function MonthHeroCard({ month, year, data }) {
  const earned = data?.earned || 0
  const spent = data?.expense || 0
  const invested = data?.investment || 0
  const balance = data?.balance || 0
  const balanceText = fmt(balance)
  const balanceClass = getHeroAmountClass(balanceText.length)
  const rate = savingsRate(earned, spent)
  const heroAccentStrong = C.heroAccent
  const heroBadgeStyle = {
    background: C.heroAccentBg,
    border: '1px solid rgba(255,255,255,0.16)',
  }

  const statChipStyle = {
    background: C.heroStatBg,
    border: '1px solid rgba(255,255,255,0.14)',
  }

  return (
    <div className="card-hero p-5 sm:p-6 relative overflow-hidden">
      <div className="flex items-center justify-between mb-3.5">
        <p className="text-[10px] font-semibold tracking-[0.18em] uppercase" style={{ color: heroAccentStrong }}>
          {MONTH_NAMES[month - 1].slice(0, 3)} {year}
        </p>
        <p className="text-[10px] font-semibold tracking-[0.2em] uppercase" style={{ color: C.heroDimmer }}>
          KOSHA
        </p>
      </div>

      <p className="text-[10px] font-medium mb-1 tracking-wide" style={{ color: C.heroLabel }}>Monthly balance</p>
      <p className={`${balanceClass} font-bold leading-[0.95] tracking-tight tabular-nums max-w-full whitespace-normal [overflow-wrap:anywhere] ${balance >= 0 ? 'text-white' : 'text-[#FFB3AF]'}`}>
        {balanceText}
      </p>

      <div
        className="mt-2.5 mb-4 inline-flex items-center px-2.5 py-1 rounded-pill"
        style={heroBadgeStyle}
      >
        <span className="text-[12px] font-semibold tracking-wide" style={{ color: heroAccentStrong }}>
          {rate}% saved this month
        </span>
      </div>

      <div className="mb-3.5" style={{ borderTop: `1px solid ${C.heroDivider}` }} />

      <div className="flex justify-between gap-2">
        {[
          { label: 'Earned', val: earned },
          { label: 'Spent', val: spent },
          { label: 'Invested', val: invested },
        ].map((s, i) => {
          const statText = fmt(s.val)
          const statValueClass = getHeroStatClass(statText.length)

          return (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.06 * i, ease: [0.22, 1, 0.36, 1] }}
            className="flex-1 min-w-0 px-2.5 py-2 rounded-2xl"
            style={statChipStyle}
          >
            <p className="text-[10px] sm:text-[11px] mb-0.5 truncate tracking-wide" style={{ color: C.heroLabel }}>
              {s.label}
            </p>
            <p className={`${statValueClass} font-semibold text-white tabular-nums leading-tight tracking-[-0.01em] whitespace-normal [overflow-wrap:anywhere]`}>
              {statText}
            </p>
          </motion.div>
        )})}
      </div>

      <div className="mt-3.5">
        <div className="flex justify-between mb-2">
          <span className="text-[11px] tracking-wide" style={{ color: C.heroLabel }}>Savings rate</span>
          <span className="text-[12px] font-semibold" style={{ color: heroAccentStrong }}>{rate}%</span>
        </div>
        <div className="bar-dark-track">
          <motion.div
            className="bar-dark-fill"
            initial={{ width: 0 }}
            animate={{ width: `${rate}%` }}
            transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
          />
        </div>
      </div>
    </div>
  )
})

export default MonthHeroCard
