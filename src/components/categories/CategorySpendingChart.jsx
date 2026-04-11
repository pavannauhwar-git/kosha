import { memo, useMemo } from 'react'
import CategoryIcon from './CategoryIcon'
import { fmt } from '../../lib/utils'
import { CATEGORIES } from '../../lib/categories'

const BAR_PALETTE = ['#007FFF', '#2F96FF', '#5CADFF', '#8CC4FF', '#B5D8FF', '#D6E9FF']

const CategorySpendingChart = memo(function CategorySpendingChart({
  entries,
  total,
  title = 'Spent by Category',
  subtitle,
  maxRows = 8,
  budgetMap,
}) {
  const safeEntries = Array.isArray(entries)
    ? entries
      .filter(([, value]) => Number(value || 0) > 0)
      .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
    : []

  const categoryById = useMemo(() => {
    return new Map(CATEGORIES.map((category) => [category.id, category]))
  }, [])

  const safeTotal = total > 0
    ? total
    : safeEntries.reduce((sum, [, value]) => sum + Number(value || 0), 0) || 1

  const rows = useMemo(() => {
    return safeEntries.map(([catId, amt], index) => {
      const amount = Number(amt || 0)
      const category = categoryById.get(catId)
      const sharePct = safeTotal > 0 ? Math.round((amount / safeTotal) * 100) : 0
      const budget = budgetMap?.get?.(catId)
      const budgetLimit = budget ? Number(budget.monthly_limit || 0) : 0
      const budgetPct = budgetLimit > 0 ? Math.round((amount / budgetLimit) * 100) : 0
      const budgetSignal = budgetLimit <= 0
        ? null
        : budgetPct >= 100
          ? { label: 'Over', className: 'text-expense-text' }
          : budgetPct >= 80
            ? { label: 'Near', className: 'text-warning-text' }
            : { label: 'On track', className: 'text-income-text' }

      return {
        id: catId,
        name: category?.label || catId,
        amount,
        amountLabel: fmt(amount),
        sharePct,
        barColor: BAR_PALETTE[index % BAR_PALETTE.length],
        budgetLimit,
        budgetPct,
        budgetSignal,
      }
    })
  }, [safeEntries, safeTotal, categoryById, budgetMap])

  if (!rows.length) return null

  const shownRows = rows.slice(0, maxRows)
  const hiddenRows = rows.slice(maxRows)
  const hiddenAmount = hiddenRows.reduce((sum, row) => sum + row.amount, 0)
  const hiddenShare = safeTotal > 0 ? Math.round((hiddenAmount / safeTotal) * 100) : 0
  const dominant = rows[0]
  const topThreeShare = safeTotal > 0
    ? Math.round((rows.slice(0, 3).reduce((sum, row) => sum + row.amount, 0) / safeTotal) * 100)
    : 0

  return (
    <div className="card p-4 border-0">
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div>
          <p className="section-label">{title}</p>
          {subtitle ? (
            <p className="text-[10px] text-ink-3 mt-0.5">{subtitle}</p>
          ) : (
            <p className="text-[10px] text-ink-3 mt-0.5">Quick monthly spend footprint by category.</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] text-ink-3">Total</p>
          <p className="text-[13px] font-bold text-expense-text tabular-nums">{fmt(safeTotal)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-2.5">
        <span className="px-2 py-1 rounded-pill border border-kosha-border bg-kosha-surface-2 text-[10px] text-ink-2 font-semibold tabular-nums">
          Top: {dominant.name}
        </span>
        <span className="px-2 py-1 rounded-pill border border-kosha-border bg-kosha-surface-2 text-[10px] text-warning-text font-semibold tabular-nums">
          Top share {dominant.sharePct}%
        </span>
        <span className="px-2 py-1 rounded-pill border border-kosha-border bg-kosha-surface-2 text-[10px] text-ink-2 font-semibold tabular-nums">
          Top 3 cover {topThreeShare}%
        </span>
      </div>

      <div className="rounded-card border border-kosha-border bg-kosha-surface-2 overflow-hidden">
        {shownRows.map((row, index) => (
          <div
            key={row.id}
            className={`px-3 py-2.5 ${index !== shownRows.length - 1 || hiddenRows.length > 0 ? 'border-b border-kosha-border' : ''}`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-full border border-kosha-border flex items-center justify-center bg-kosha-surface">
                  <CategoryIcon categoryId={row.id} size={13} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-ink truncate">{row.name}</p>
                  <p className="text-[10px] text-ink-3 tabular-nums">
                    {row.sharePct}% of total
                    {row.budgetLimit > 0 ? ` · ${row.budgetPct}% budget` : ''}
                  </p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[11px] font-semibold tabular-nums text-expense-text">{row.amountLabel}</p>
                {row.budgetSignal && (
                  <p className={`text-[9px] font-semibold ${row.budgetSignal.className}`}>{row.budgetSignal.label}</p>
                )}
              </div>
            </div>

            <div className="mt-1.5 h-1.5 rounded-pill bg-kosha-border overflow-hidden">
              <div
                className="h-full rounded-pill"
                style={{ width: `${Math.max(4, row.sharePct)}%`, background: row.barColor }}
              />
            </div>
          </div>
        ))}

        {hiddenRows.length > 0 && (
          <div className="px-3 py-2 border-t border-dashed border-kosha-border bg-kosha-surface">
            <p className="text-[10px] text-ink-3">
              {hiddenRows.length} smaller categor{hiddenRows.length === 1 ? 'y' : 'ies'} combine to {fmt(hiddenAmount)} ({hiddenShare}%).
            </p>
          </div>
        )}
      </div>

      <p className="text-[10px] text-ink-3 mt-2">Spending mix across {rows.length} active categories this month.</p>
    </div>
  )
})

export default CategorySpendingChart
