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
  const variancePct = spendPct - dayPct

  const statusLabel = paceOk ? 'On track' : 'Needs correction'
  const statusClass = paceOk
    ? 'bg-income-bg text-income-text border border-income-border'
    : 'bg-warning-bg text-warning-text border border-warning-border'

  const paceMessage = paceOk
    ? `${Math.max(0, dayPct - spendPct)}% headroom vs month pace.`
    : `${Math.abs(variancePct)}% above pace. Trim discretionary spend for the next few days.`

  return (
    <div className="card p-4 border border-kosha-border bg-kosha-surface">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="section-label mb-0.5">Spending pace</p>
          <p className="text-[13px] text-ink-3">Day {dayOfMonth} of {daysInMonth}</p>
        </div>
        <span className={`text-[11px] px-2.5 py-1 rounded-pill font-semibold ${statusClass}`}>
          {statusLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-card bg-kosha-surface-2 border border-kosha-border px-3 py-2.5">
          <p className="text-[10px] text-ink-3">Month elapsed</p>
          <p className="text-[16px] font-bold text-ink tabular-nums leading-tight">{dayPct}%</p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 border border-kosha-border px-3 py-2.5">
          <p className="text-[10px] text-ink-3">Amount spent</p>
          <p className={`text-[16px] font-bold tabular-nums leading-tight ${paceOk ? 'text-ink' : 'text-expense-text'}`}>
            {spendPct}%
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-caption text-ink-3">Month elapsed</span>
            <span className="text-caption font-semibold text-ink">{dayPct}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden bg-kosha-border">
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
          <div className="h-2 rounded-full overflow-hidden bg-kosha-border">
            <motion.div className="h-full rounded-full bg-expense"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(spendPct, 100)}%` }}
              transition={{ duration: 0.6, delay: 0.08, ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>

      <p className="text-[11px] text-ink-3 mt-2">{paceMessage}</p>
    </div>
  )
})

export default DashboardPaceCard
