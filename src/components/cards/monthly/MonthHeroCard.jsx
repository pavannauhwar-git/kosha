import { motion } from 'framer-motion'
import { fmt, savingsRate } from '../../../lib/utils'
import { C } from '../../../lib/colors'
import { MONTH_NAMES } from '../../../lib/constants'

export default function MonthHeroCard({ month, year, data }) {
  const earned = data?.earned || 0
  const spent = data?.expense || 0
  const invested = data?.investment || 0
  const balance = data?.balance || 0
  const rate = savingsRate(earned, spent)
  const heroAccentSoft = 'rgba(242, 213, 60, 0.78)'
  const heroAccentBgSoft = 'rgba(242, 213, 60, 0.18)'

  return (
    <div className="card-hero p-6 relative overflow-hidden">
      <div className="flex items-center justify-between mb-3.5">
        <p className="text-caption font-bold tracking-widest uppercase" style={{ color: heroAccentSoft }}>
          {MONTH_NAMES[month - 1].slice(0, 3)} {year}
        </p>
        <p className="text-caption font-bold tracking-widest" style={{ color: C.heroDimmer }}>
          KOSHA
        </p>
      </div>

      <p className="text-caption font-medium mb-1" style={{ color: C.heroLabel }}>
        Monthly balance
      </p>
      <p className={`text-hero font-bold leading-[0.92] tabular-nums ${balance >= 0 ? 'text-white' : 'text-[#FFB3AF]'}`}>
        {fmt(balance)}
      </p>

      <div className="mt-2.5 mb-5 inline-flex items-center px-2.5 py-1 rounded-pill border border-white/12" style={{ background: heroAccentBgSoft }}>
        <span className="text-caption font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
          {rate}% saved
        </span>
      </div>

      <div className="border-t mb-4" style={{ borderColor: C.heroDivider }} />

      <div className="flex justify-between gap-1.5 sm:gap-2 mb-5">
        {[
          { label: 'Earned', val: earned },
          { label: 'Spent', val: spent },
          { label: 'Invested', val: invested },
        ].map(s => (
          <div key={s.label} className="flex-1 min-w-0 px-2 sm:px-3 py-2.5 rounded-2xl border border-white/10 backdrop-blur-[1px]" style={{ background: C.heroStatBg }}>
            <p className="text-[11px] sm:text-caption mb-0.5 truncate" style={{ color: C.heroLabel }}>
              {s.label}
            </p>
            <p className="text-[12px] sm:text-label font-bold text-white tabular-nums truncate">{fmt(s.val)}</p>
          </div>
        ))}
      </div>

      <div>
        <div className="flex justify-between mb-2">
          <span className="text-caption" style={{ color: C.heroLabel }}>Savings rate</span>
          <span className="text-caption font-semibold" style={{ color: heroAccentSoft }}>{rate}%</span>
        </div>
        <div className="bar-dark-track">
          <motion.div
            className="bar-dark-fill"
            initial={{ width: 0 }}
            animate={{ width: `${rate}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
        </div>
      </div>
    </div>
  )
}
