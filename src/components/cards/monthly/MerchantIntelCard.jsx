import { memo, useMemo } from 'react'
import { fmt } from '../../../lib/utils'
import { repeatMerchants } from '../../../lib/merchants'
import Button from '../../ui/Button'

function capitalize(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export default memo(function MerchantIntelCard({ txnRows = [], onReviewExpenses, onReviewMerchant }) {
  const analysis = useMemo(() => {
    const { repeats, merchants: allMerchants, totalExpense } = repeatMerchants(txnRows)
    if (repeats.length === 0) return null

    if (totalExpense > 0) {
      const sumMerchants = allMerchants.reduce((sum, m) => sum + m.total, 0)
      const otherTotal = totalExpense - sumMerchants

      const itemsForDist = [
        ...allMerchants.map((m) => ({ ref: m, val: m.total })),
        { ref: { isOther: true }, val: Math.max(0, otherTotal) }
      ]

      let currentSum = 0
      itemsForDist.forEach((item) => {
        item.exact = (item.val / totalExpense) * 100
        item.floor = Math.floor(item.exact)
        item.remainder = item.exact - item.floor
        currentSum += item.floor
      })

      itemsForDist.sort((a, b) => b.remainder - a.remainder)
      for (let i = 0; i < itemsForDist.length && currentSum < 100; i++) {
        itemsForDist[i].floor += 1
        currentSum += 1
      }

      itemsForDist.forEach((item) => {
        if (!item.ref.isOther) {
          item.ref.sharePct = item.floor
        }
      })
    }

    const top5 = repeats.slice(0, 5).map((m) => ({
      ...m,
      displayName: capitalize(m.label.length > 28 ? m.label.slice(0, 28).trim() : m.label),
      sharePct: m.sharePct || 0,
      avgTicket: Math.round(m.total / m.count),
    }))

    const topMerchantShare = top5[0]?.sharePct || 0

    return {
      top5,
      totalMerchants: repeats.length,
      topMerchantShare,
      totalExpense,
    }
  }, [txnRows])

  if (!analysis) return null

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-label font-semibold text-ink">Top merchants</p>
          <p className="text-[11px] text-ink-3 mt-0.5">
            Repeat payees ranked by total spend — reveals subscription and habit patterns.
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[11px] px-2 py-1 rounded-pill font-semibold bg-kosha-surface-2 text-ink-3 border border-kosha-border">
            {analysis.totalMerchants} repeat{analysis.totalMerchants !== 1 ? 's' : ''}
          </span>
          {onReviewExpenses && (
            <Button
              variant="secondary"
              size="xs"
              onClick={onReviewExpenses}
              className="whitespace-nowrap"
            >
              Review
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-2.5">
        {analysis.top5.map((m, index) => (
          <div key={m.key} className="rounded-card bg-kosha-surface-2 p-2.5">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-5 h-5 rounded-md bg-kosha-surface-2 flex items-center justify-center text-[10px] font-bold text-ink-3 shrink-0">
                  {index + 1}
                </span>
                <p className="text-[12px] font-semibold text-ink truncate">{m.displayName}</p>
              </div>
              <div className="shrink-0 text-right flex flex-col items-end gap-0.5">
                <p className="text-[13px] font-semibold tabular-nums text-expense-text">{fmt(m.total)}</p>
                {onReviewMerchant && (
                  <button
                    type="button"
                    onClick={() => onReviewMerchant(m)}
                    className="text-[10px] font-semibold text-brand hover:underline"
                  >
                    Inspect
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 text-[10px] text-ink-3">
              <span>{m.count} transactions</span>
              <span>·</span>
              <span>Avg {fmt(m.avgTicket)}</span>
              <span>·</span>
              <span>{m.sharePct}% of spend</span>
            </div>

            <div className="h-1.5 rounded-pill bg-kosha-border overflow-hidden mt-1.5">
              <div
                className="h-full rounded-pill bg-expense-text"
                style={{ width: `${Math.max(5, m.sharePct)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {analysis.topMerchantShare > 25 && (
        <p className="text-[11px] text-warning-text mt-2.5">
          Top merchant accounts for {analysis.topMerchantShare}% of your spend. High concentration on a single payee signals a habit worth reviewing.
        </p>
      )}
    </div>
  )
})
