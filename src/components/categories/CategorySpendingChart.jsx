import { memo, useMemo } from 'react'
import CategoryIcon from './CategoryIcon'
import { fmt } from '../../lib/utils'
import { CATEGORIES } from '../../lib/categories'

const BAR_PALETTE = ['#0A67D8', '#2F7AD9', '#629CE6', '#8CB7ED', '#B5D0F2', '#D6E6F8']

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

      return {
        id: catId,
        name: category?.label || catId,
        amount,
        amountLabel: fmt(amount),
        sharePct,
        barColor: BAR_PALETTE[index % BAR_PALETTE.length],
        iconBg: category?.bg || '#E7F2FF',
        budgetLimit,
        budgetPct,
      }
    })
  }, [safeEntries, safeTotal, categoryById, budgetMap])

  if (!rows.length) return null

  const shownRows = rows.slice(0, maxRows)
  const hiddenRows = rows.slice(maxRows)
  const hiddenAmount = hiddenRows.reduce((sum, row) => sum + row.amount, 0)
  const hiddenShare = safeTotal > 0 ? Math.round((hiddenAmount / safeTotal) * 100) : 0
  const dominant = rows[0]

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="section-label">{title}</p>
          {subtitle ? (
            <p className="text-[10px] text-ink-3 mt-0.5">{subtitle}</p>
          ) : (
            <p className="text-[10px] text-ink-3 mt-0.5">Ranked category bars show both contribution and exact spend.</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] text-ink-3">Total</p>
          <p className="text-[13px] font-bold text-expense-text tabular-nums">{fmt(safeTotal)}</p>
        </div>
      </div>

      <div className="rounded-card border border-kosha-border bg-kosha-surface-2 p-2.5 mb-2.5">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-card bg-kosha-surface p-2.5 border border-kosha-border">
            <p className="text-[10px] text-ink-3">Dominant category</p>
            <p className="text-[12px] font-bold text-ink truncate">{dominant.name}</p>
          </div>
          <div className="rounded-card bg-kosha-surface p-2.5 border border-kosha-border">
            <p className="text-[10px] text-ink-3">Top share</p>
            <p className="text-[12px] font-bold text-warning-text tabular-nums">{dominant.sharePct}%</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {shownRows.map((row) => (
          <div key={row.id} className="rounded-card border border-kosha-border bg-kosha-surface-2 px-2.5 py-2">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded-full border border-kosha-border flex items-center justify-center" style={{ background: row.iconBg }}>
                  <CategoryIcon categoryId={row.id} size={12} />
                </div>
                <p className="text-[11px] font-semibold text-ink truncate">{row.name}</p>
              </div>
              <p className="text-[11px] font-semibold tabular-nums text-expense-text shrink-0">{row.amountLabel}</p>
            </div>

            <div className="h-2 rounded-pill bg-kosha-border overflow-hidden">
              <div
                className="h-full rounded-pill"
                style={{ width: `${Math.max(4, row.sharePct)}%`, background: row.barColor }}
              />
            </div>

            {row.budgetLimit > 0 ? (
              <div className="flex items-center justify-between mt-1">
                <p className="text-[10px] text-ink-3 tabular-nums">
                  {row.budgetPct}% of {fmt(row.budgetLimit)} budget
                </p>
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                  row.budgetPct >= 100
                    ? 'bg-expense-bg text-expense-text'
                    : row.budgetPct >= 80
                      ? 'bg-warning-bg text-warning-text'
                      : 'bg-income-bg text-income-text'
                }`}>
                  {row.budgetPct >= 100 ? 'Over' : row.budgetPct >= 80 ? 'Near limit' : 'On track'}
                </span>
              </div>
            ) : (
              <p className="text-[10px] text-ink-3 mt-1 tabular-nums">{row.sharePct}% of total spend</p>
            )}
          </div>
        ))}

        {hiddenRows.length > 0 && (
          <div className="rounded-card border border-dashed border-kosha-border bg-kosha-surface-2 px-2.5 py-2">
            <p className="text-[10px] text-ink-3">
              {hiddenRows.length} smaller categor{hiddenRows.length === 1 ? 'y' : 'ies'} combine to {fmt(hiddenAmount)} ({hiddenShare}%).
            </p>
          </div>
        )}
      </div>
    </div>
  )
})

export default CategorySpendingChart
