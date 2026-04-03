import { memo, useMemo } from 'react'
import { fmt } from '../../../lib/utils'

/**
 * Normalize a transaction description to a merchant-like key.
 * Strip common noise words, lowercase, collapse whitespace.
 */
function normalizeMerchant(desc) {
  if (!desc) return ''
  return String(desc)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\b(paid|for|to|at|from|via|on|in|the|and|of|with)\b/g, '')
    .trim()
    .replace(/\s+/g, ' ')
}

function capitalize(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export default memo(function MerchantIntelCard({ txnRows }) {
  const analysis = useMemo(() => {
    const merchants = new Map()

    for (const row of txnRows) {
      if (row.type !== 'expense') continue
      const amt = Number(row.amount || 0)
      if (!Number.isFinite(amt) || amt <= 0) continue

      const rawDesc = String(row.description || '').trim()
      if (!rawDesc) continue

      const key = normalizeMerchant(rawDesc)
      if (!key || key.length < 2) continue

      const existing = merchants.get(key)
      if (existing) {
        existing.total += amt
        existing.count += 1
        if (amt > existing.maxTxn) existing.maxTxn = amt
        // Keep the first raw description as display name
      } else {
        merchants.set(key, {
          key,
          displayName: capitalize(rawDesc.length > 28 ? rawDesc.slice(0, 28).trim() : rawDesc),
          total: amt,
          count: 1,
          maxTxn: amt,
        })
      }
    }

    // Only show merchants with 2+ transactions (true repeats)
    const repeating = [...merchants.values()]
      .filter((m) => m.count >= 2)
      .sort((a, b) => b.total - a.total)

    if (repeating.length === 0) return null

    const totalExpense = txnRows
      .filter((r) => r.type === 'expense')
      .reduce((s, r) => s + Number(r.amount || 0), 0)

    const top5 = repeating.slice(0, 5).map((m) => ({
      ...m,
      sharePct: totalExpense > 0 ? Math.round((m.total / totalExpense) * 100) : 0,
      avgTicket: Math.round(m.total / m.count),
    }))

    const topMerchantShare = top5[0]?.sharePct || 0

    return {
      top5,
      totalMerchants: repeating.length,
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
        <span className="text-[11px] px-2 py-1 rounded-pill font-semibold bg-kosha-surface-2 text-ink-3 border border-kosha-border">
          {analysis.totalMerchants} repeat{analysis.totalMerchants !== 1 ? 's' : ''}
        </span>
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
              <p className="text-[13px] font-semibold tabular-nums text-expense-text shrink-0">{fmt(m.total)}</p>
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
