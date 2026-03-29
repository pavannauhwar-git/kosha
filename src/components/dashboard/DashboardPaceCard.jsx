import { memo } from 'react'
import { motion } from 'framer-motion'

/**
 * DashboardPaceCard
 *
 * Shows the monthly spending pace — two progress bars comparing
 * "days elapsed" vs "budget consumed". Extracted from Dashboard.jsx
 * so it only re-renders when month summary data changes, not when
 * the recent transaction list or running balance updates.
 */
const DashboardPaceCard = memo(function DashboardPaceCard({
  dayOfMonth,
  daysInMonth,
  earned,
  spent,
  paceOk,
}) {
  const dayPct   = Math.round((dayOfMonth / daysInMonth) * 100)
  const spendPct = earned > 0 ? Math.round((spent / earned) * 100) : 0

  return (
    <div className="card p-3.5">
      <div className="mb-2">
        <p className={`text-[15px] font-bold leading-snug ${
          paceOk ? 'text-income-text' : 'text-expense-text'
        }`}>
          {paceOk ? '✓ On track' : '⚡ Running hot'}
        </p>
        <p className="text-caption text-ink-3">Day {dayOfMonth} of {daysInMonth}</p>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-caption text-ink-3">Month elapsed</span>
            <span className="text-caption font-semibold text-ink">{dayPct}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.06)' }}>
            <motion.div className="h-full rounded-full bg-income"
              initial={{ width: 0 }}
              animate={{ width: `${dayPct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-caption text-ink-3">Amount spent</span>
            <span className={`text-caption font-semibold ${
              paceOk ? 'text-ink' : 'text-expense-text'
            }`}>
              {spendPct}%
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.06)' }}>
            <motion.div className="h-full rounded-full bg-expense"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(spendPct, 100)}%` }}
              transition={{ duration: 0.6, delay: 0.08, ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
})

export default DashboardPaceCard
