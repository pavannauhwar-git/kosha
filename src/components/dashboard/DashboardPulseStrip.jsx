import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { fmt } from '../../lib/utils'

/**
 * DashboardPulseStrip
 *
 * The horizontal scrollable context strip showing today's spend,
 * upcoming bills, and a contextual spending insight.
 *
 * Extracted so changes to the transaction list or running balance
 * don't cause this strip to re-render unnecessarily.
 */
const DashboardPulseStrip = memo(function DashboardPulseStrip({
  todaySpend,
  totalBillsAmt,
  insight,
}) {
  const navigate = useNavigate()

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <div className="flex gap-2 w-max pr-4">
        {/* Today */}
        <div className="shrink-0 flex flex-col gap-1 px-3 py-2.5 rounded-2xl
                        bg-kosha-surface border border-kosha-border">
          <p className="text-[10px] font-semibold text-ink-4 uppercase tracking-wider">
            Today
          </p>
          <p className={`text-[13px] font-bold tabular-nums leading-none ${
            todaySpend > 0 ? 'text-expense-text' : 'text-income-text'
          }`}>
            {todaySpend > 0 ? fmt(todaySpend, true) : 'All clear 🌿'}
          </p>
        </div>

        {/* Bills due — only if any pending */}
        {totalBillsAmt > 0 && (
          <button
            onClick={() => navigate('/bills')}
            className="shrink-0 flex flex-col gap-1 px-3 py-2.5 rounded-2xl
                       bg-repay-bg border border-repay-border text-left
                       active:opacity-75 transition-opacity"
          >
            <p className="text-[10px] font-semibold text-repay-text uppercase tracking-wider">
              Bills due
            </p>
            <p className="text-[13px] font-bold text-repay-text tabular-nums leading-none">
              {fmt(totalBillsAmt, true)}
            </p>
          </button>
        )}

        {/* Contextual insight */}
        <div className="shrink-0 w-[175px] flex flex-col gap-1 px-3 py-2.5 rounded-2xl
                        bg-kosha-surface-2 border border-kosha-border">
          <p className="text-[10px] font-semibold text-ink-4 uppercase tracking-wider">
            Insight
          </p>
          <p className="text-[12px] font-medium text-ink leading-snug">{insight}</p>
        </div>
      </div>
    </div>
  )
})

export default DashboardPulseStrip
