import { memo, useMemo } from 'react'
import { fmt } from '../../../lib/utils'
import { PAYMENT_MODES } from '../../../lib/categories'

const MODE_MAP = new Map(PAYMENT_MODES.map((m) => [m.id, m]))

export default memo(function PaymentModeCard({ txnRows }) {
  const analysis = useMemo(() => {
    const byMode = new Map()

    for (const row of txnRows) {
      if (row.type !== 'expense') continue
      const amt = Number(row.amount || 0)
      if (!Number.isFinite(amt) || amt <= 0) continue
      const mode = String(row.payment_mode || 'other').toLowerCase()
      byMode.set(mode, (byMode.get(mode) || 0) + amt)
    }

    if (byMode.size === 0) return null

    const total = [...byMode.values()].reduce((s, v) => s + v, 0)
    if (total <= 0) return null

    const rows = [...byMode.entries()]
      .map(([id, value]) => {
        const meta = MODE_MAP.get(id) || { label: id.replace(/_/g, ' '), color: '#9CA3AF', bg: '#F9FAFB' }
        return {
          id,
          label: meta.label,
          value,
          pct: Math.round((value / total) * 100),
          color: meta.color,
          bg: meta.bg,
        }
      })
      .sort((a, b) => b.value - a.value)

    const creditCard = byMode.get('credit_card') || 0
    const creditPct = total > 0 ? Math.round((creditCard / total) * 100) : 0

    return { rows, total, creditPct }
  }, [txnRows])

  if (!analysis) return null

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-label font-semibold text-ink">Payment mode split</p>
          <p className="text-[11px] text-ink-3 mt-0.5">
            How you pay affects what you spend — credit cards enable larger tickets.
          </p>
        </div>
        {analysis.creditPct > 0 && (
          <span className={`text-[11px] px-2 py-1 rounded-pill font-semibold ${
            analysis.creditPct <= 30
              ? 'bg-income-bg text-income-text'
              : analysis.creditPct <= 50
                ? 'bg-warning-bg text-warning-text'
                : 'bg-expense-bg text-expense-text'
          }`}>
            Credit {analysis.creditPct}%
          </span>
        )}
      </div>

      {/* Stacked bar */}
      <div className="rounded-card bg-kosha-surface-2 p-3 mb-2.5">
        <div className="h-3 rounded-pill overflow-hidden flex">
          {analysis.rows.map((row) => (
            <div
              key={row.id}
              className="h-full"
              style={{
                width: `${Math.max(3, row.pct)}%`,
                backgroundColor: row.color,
              }}
              title={`${row.label}: ${row.pct}%`}
            />
          ))}
        </div>
        <div className="flex items-center gap-3 flex-wrap mt-2">
          {analysis.rows.slice(0, 5).map((row) => (
            <div key={row.id} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
              <span className="text-[10px] text-ink-3">{row.label} {row.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Rows */}
      <div className="space-y-2">
        {analysis.rows.map((row) => (
          <div key={row.id}>
            <div className="flex items-center justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: row.color }}
                />
                <p className="text-[11px] text-ink-2 truncate">{row.label}</p>
              </div>
              <p className="text-[11px] tabular-nums text-ink shrink-0">
                {row.pct}% · {fmt(row.value, true)}
              </p>
            </div>
            <div className="h-1.5 rounded-pill bg-kosha-border overflow-hidden">
              <div
                className="h-full rounded-pill"
                style={{ width: `${Math.max(5, row.pct)}%`, backgroundColor: row.color }}
              />
            </div>
          </div>
        ))}
      </div>

      {analysis.creditPct > 40 && (
        <p className="text-[11px] text-warning-text mt-2">
          Credit card accounts for {analysis.creditPct}% of spend. Consider shifting routine purchases to UPI or debit to reduce future interest risk.
        </p>
      )}
    </div>
  )
})
