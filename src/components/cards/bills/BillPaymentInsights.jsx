import { memo, useMemo } from 'react'
import { fmt, daysUntil } from '../../../lib/utils'

function paidLagDays(bill) {
  if (!bill?.paid_at || !bill?.due_date) return null
  const due = new Date(`${String(bill.due_date).slice(0, 10)}T12:00:00`)
  const paid = new Date(`${String(bill.paid_at).slice(0, 10)}T12:00:00`)
  if (Number.isNaN(due.getTime()) || Number.isNaN(paid.getTime())) return null
  return Math.round((due.getTime() - paid.getTime()) / (24 * 60 * 60 * 1000))
}

/**
 * Payment discipline card for the Bills page paid tab. Bills without a
 * recorded payment date (paid_at) are counted as cleared but left out of
 * the early / on-time / late split.
 */
export default memo(function BillPaymentInsights({ paidBills, pendingBills }) {
  const insights = useMemo(() => {
    if (!paidBills || paidBills.length === 0) return null

    let earlyCount = 0
    let onTimeCount = 0
    let lateEstimate = 0
    let recurringPaidCount = 0
    let totalPaidAmount = 0

    for (const bill of paidBills) {
      totalPaidAmount += Number(bill.amount || 0)
      if (bill.is_recurring) recurringPaidCount += 1

      const deltaDays = paidLagDays(bill)
      if (deltaDays == null) continue
      if (deltaDays > 0) earlyCount += 1
      else if (deltaDays >= -3) onTimeCount += 1
      else lateEstimate += 1
    }

    const total = paidBills.length
    const timedCount = earlyCount + onTimeCount + lateEstimate
    const onTimePct = timedCount > 0 ? Math.round(((earlyCount + onTimeCount) / timedCount) * 100) : null

    const sorted = [...paidBills].sort((a, b) => {
      const da = new Date(a.due_date || 0).getTime()
      const db = new Date(b.due_date || 0).getTime()
      return db - da
    })

    let streak = 0
    for (const bill of sorted) {
      const deltaDays = paidLagDays(bill)
      if (deltaDays == null) continue
      if (deltaDays >= -3) streak += 1
      else break
    }

    const overdueNow = (pendingBills || []).filter(b => daysUntil(b.due_date) < 0).length

    return {
      total,
      timedCount,
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
          insights.onTimePct == null
            ? 'bg-kosha-surface-2 text-ink-3'
            : insights.onTimePct >= 90
              ? 'bg-income-bg text-income-text'
              : insights.onTimePct >= 70
                ? 'bg-warning-bg text-warning-text'
                : 'bg-expense-bg text-expense-text'
        }`}>
          {insights.onTimePct == null ? 'No payment dates yet' : `${insights.onTimePct}% on-time`}
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
          <p className="text-[10px] text-ink-3">Late</p>
          <p className={`text-[13px] font-semibold tabular-nums ${insights.lateEstimate > 0 ? 'text-warning-text' : 'text-ink'}`}>
            {insights.lateEstimate}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-kosha-border rounded-pill overflow-hidden mb-1.5">
        {insights.timedCount > 0 && (
          <div className="h-full flex">
            {insights.earlyCount > 0 && (
              <div
                className="h-full bg-income-text"
                style={{ width: `${Math.round((insights.earlyCount / insights.timedCount) * 100)}%` }}
              />
            )}
            {insights.onTimeCount > 0 && (
              <div
                className="h-full bg-brand"
                style={{ width: `${Math.round((insights.onTimeCount / insights.timedCount) * 100)}%` }}
              />
            )}
            {insights.lateEstimate > 0 && (
              <div
                className="h-full bg-warning-text"
                style={{ width: `${Math.round((insights.lateEstimate / insights.timedCount) * 100)}%` }}
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
