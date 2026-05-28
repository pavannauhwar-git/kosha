import { memo, useMemo } from 'react'
import { fmt, daysUntil } from '../../../lib/utils'

/**
 * Payment discipline card for the Bills page paid tab.
 * Since paid_at is not stored on liabilities, we use due_date relative
 * to today to infer which bills were likely paid on time vs late.
 * Bills with due_date in the past that are paid → on-time if due_date is recent.
 * Bills with linked_transaction_id → can be cross-referenced for exact lag.
 */
export default memo(function BillPaymentInsights({ paidBills, pendingBills }) {
  const insights = useMemo(() => {
    if (!paidBills || paidBills.length === 0) return null

    // For paid bills, if due_date is in the future → paid early,
    // if due_date is in the past → likely paid around or after due date
    let earlyCount = 0
    let onTimeCount = 0
    let lateEstimate = 0
    let recurringPaidCount = 0
    let totalPaidAmount = 0

    for (const bill of paidBills) {
      const amt = Number(bill.amount || 0)
      totalPaidAmount += amt

      if (bill.is_recurring) recurringPaidCount += 1

      // Use actual paid_at, fallback to updated_at, fallback to today heuristic
      const effectivePaidDate = bill.paid_at || bill.updated_at
      let deltaDays
      if (effectivePaidDate) {
        const due = new Date(bill.due_date || 0)
        due.setHours(12, 0, 0, 0)
        const paid = new Date(effectivePaidDate)
        paid.setHours(12, 0, 0, 0)
        deltaDays = Math.round((due - paid) / (1000 * 60 * 60 * 24))
      } else {
        deltaDays = daysUntil(bill.due_date)
      }

      if (deltaDays > 0) {
        earlyCount += 1
      } else if (deltaDays >= -3) {
        onTimeCount += 1
      } else {
        lateEstimate += 1
      }
    }

    const total = paidBills.length
    const onTimePct = total > 0 ? Math.round(((earlyCount + onTimeCount) / total) * 100) : 100

    // Current streak — consecutive paid bills from most recent that were on-time
    const sorted = [...paidBills].sort((a, b) => {
      const da = new Date(a.due_date || 0).getTime()
      const db = new Date(b.due_date || 0).getTime()
      return db - da // most recent first
    })

    let streak = 0
    for (const bill of sorted) {
      const effectivePaidDate = bill.paid_at || bill.updated_at
      let deltaDays
      if (effectivePaidDate) {
        const due = new Date(bill.due_date || 0)
        due.setHours(12, 0, 0, 0)
        const paid = new Date(effectivePaidDate)
        paid.setHours(12, 0, 0, 0)
        deltaDays = Math.round((due - paid) / (1000 * 60 * 60 * 24))
      } else {
        deltaDays = daysUntil(bill.due_date)
      }

      if (deltaDays >= -3) {
        streak += 1
      } else {
        break
      }
    }

    // Overdue pending count
    const overdueNow = (pendingBills || []).filter(b => daysUntil(b.due_date) < 0).length

    return {
      total,
      earlyCount,
      onTimeCount,
      lateEstimate,
      onTimePct,
      streak,
      recurringPaidCount,
      totalPaidAmount,
      overdueNow,
    }
  }, [paidBills, pendingBills])

  if (!insights) return null

  return (
    <div className="card p-3.5 sm:p-4 bg-kosha-surface mb-4">
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div>
          <p className="section-label">Payment discipline</p>
          <p className="text-caption text-ink-3 mt-0.5">Your bill payment track record</p>
        </div>
        <span className={`text-[11px] px-2 py-1 rounded-pill font-semibold ${
          insights.onTimePct >= 90
            ? 'bg-income-bg text-income-text'
            : insights.onTimePct >= 70
              ? 'bg-warning-bg text-warning-text'
              : 'bg-expense-bg text-expense-text'
        }`}>
          {insights.onTimePct}% on-time
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2.5">
        <div className="rounded-card bg-kosha-surface-2 px-3 py-3">
          <p className="text-caption text-ink-3 mb-0.5">Bills cleared</p>
          <p className="text-base font-semibold text-income-text tabular-nums leading-none">{insights.total}</p>
          <p className="text-caption text-ink-3 mt-1">{fmt(insights.totalPaidAmount)} total</p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 px-3 py-3">
          <p className="text-caption text-ink-3 mb-0.5">On-time streak</p>
          <p className="text-base font-semibold text-ink tabular-nums leading-none">{insights.streak}</p>
          <p className="text-caption text-ink-3 mt-1">consecutive bills</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2.5">
        <div className="rounded-card bg-income-bg/30 border border-income-border p-2">
          <p className="text-[10px] text-ink-3">Early</p>
          <p className="text-[13px] font-semibold text-income-text tabular-nums">{insights.earlyCount}</p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">On time</p>
          <p className="text-[13px] font-semibold text-ink tabular-nums">{insights.onTimeCount}</p>
        </div>
        <div className={`rounded-card p-2 ${insights.lateEstimate > 0 ? 'bg-warning-bg/30 border border-warning-border' : 'bg-kosha-surface-2 border border-kosha-border'}`}>
          <p className="text-[10px] text-ink-3">Late (est)</p>
          <p className={`text-[13px] font-semibold tabular-nums ${insights.lateEstimate > 0 ? 'text-warning-text' : 'text-ink'}`}>
            {insights.lateEstimate}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-kosha-border rounded-pill overflow-hidden mb-1.5">
        {insights.total > 0 && (
          <div className="h-full flex">
            {insights.earlyCount > 0 && (
              <div
                className="h-full bg-income-text"
                style={{ width: `${Math.round((insights.earlyCount / insights.total) * 100)}%` }}
              />
            )}
            {insights.onTimeCount > 0 && (
              <div
                className="h-full bg-brand"
                style={{ width: `${Math.round((insights.onTimeCount / insights.total) * 100)}%` }}
              />
            )}
            {insights.lateEstimate > 0 && (
              <div
                className="h-full bg-warning-text"
                style={{ width: `${Math.round((insights.lateEstimate / insights.total) * 100)}%` }}
              />
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 text-[10px] text-ink-3">
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-income-text" /> Early</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-brand" /> On time</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-warning-text" /> Late</span>
      </div>

      {insights.overdueNow > 0 && (
        <p className="text-[11px] text-warning-text mt-2">
          {insights.overdueNow} bill{insights.overdueNow > 1 ? 's are' : ' is'} currently overdue — clearing them preserves your on-time streak.
        </p>
      )}
    </div>
  )
})
