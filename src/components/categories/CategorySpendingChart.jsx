import { memo, useEffect, useMemo, useState } from 'react'
import CategoryIcon from './CategoryIcon'
import { fmt } from '../../lib/utils'
import { C } from '../../lib/colors'
import { CATEGORIES } from '../../lib/categories'

function CategoryLine({ pct, color, overBudget = false }) {
  const fillPct  = Math.max(0, Math.min(pct, 100))
  const barColor = overBudget ? C.expense : color

  return (
    <div className="h-2 rounded-full overflow-hidden" style={{ background: '#EDE9FF' }}>
      <div
        className="h-full rounded-full"
        style={{
          width:      `${fillPct}%`,
          background: barColor,
          transition: 'width 300ms ease-out',
        }}
      />
    </div>
  )
}

// FIX (defect 5.4): Wrapped in React.memo.
// CategorySpendingChart is rendered inside both Monthly.jsx and Analytics.jsx.
// Neither parent passed it through React.memo, meaning the chart re-rendered
// on every parent re-render — including every transaction mutation refetch —
// even when entries, total, and budgets were all identical.
//
// With memo, the chart only re-renders when its props actually change.
// For Analytics.jsx (no budgets, no onCategoryClick) this means it only
// re-renders when the year changes. For Monthly.jsx it re-renders when
// the month changes or a budget is saved — both correct.
const CategorySpendingChart = memo(function CategorySpendingChart({
  entries,
  total,
  budgets = {},
  title = 'Spent by Category',
  subtitle,
  onCategoryClick,
  month,
  year,
  initialVisibleCount,
  collapseKey,
}) {
  const safeEntries = Array.isArray(entries) ? entries : []

  const safeInitialVisibleCount = Math.max(
    1,
    Number.isFinite(Number(initialVisibleCount))
      ? Number(initialVisibleCount)
      : safeEntries.length
  )

  const hasOverflow = safeEntries.length > safeInitialVisibleCount
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    setExpanded(false)
  }, [collapseKey])

  const visibleEntries = useMemo(() => {
    if (!hasOverflow || expanded) return safeEntries
    return safeEntries.slice(0, safeInitialVisibleCount)
  }, [safeEntries, expanded, hasOverflow, safeInitialVisibleCount])

  const safeTotal = total > 0 ? total : 1
  const budgetedCount = safeEntries.filter(([catId]) => Number(budgets?.[catId] || 0) > 0).length

  if (!safeEntries.length) return null

  const now = new Date()
  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear()
  const daysInMonth    = isCurrentMonth ? new Date(year, month, 0).getDate() : 30
  const pacePct        = isCurrentMonth
    ? Math.round((now.getDate() / daysInMonth) * 100)
    : null

  return (
    <div className="card p-4 border border-kosha-border bg-kosha-surface">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="section-label">{title}</p>
          {subtitle ? (
            <p className="text-[10px] text-ink-3 mt-0.5">{subtitle}</p>
          ) : (
            <p className="text-[10px] text-ink-3 mt-0.5">Largest spend buckets in this month</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] text-ink-3">Total</p>
          <p className="text-[13px] font-bold text-expense-text tabular-nums">{fmt(safeTotal)}</p>
        </div>
      </div>

      <div className="space-y-2.5">
        {visibleEntries.map(([catId, amt]) => {
          const cat = CATEGORIES.find(c => c.id === catId)
          const budget = budgets[catId] || 0
          const hasBudget = budget > 0
          const sharePct = Math.round((amt / safeTotal) * 100)
          const barPct = hasBudget
            ? Math.min(Math.round((amt / budget) * 100), 100)
            : sharePct
          const overBudget = hasBudget && amt > budget
          const remaining = hasBudget ? budget - amt : null
          const RowTag = onCategoryClick ? 'button' : 'div'

          return (
            <RowTag
              key={catId}
              onClick={onCategoryClick ? () => onCategoryClick(cat) : undefined}
              className={`w-full rounded-card border border-kosha-border bg-kosha-surface-2 p-2.5 text-left ${onCategoryClick ? 'transition-colors active:bg-kosha-surface' : ''}`}
            >
              <div className="flex items-start gap-2.5">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 border border-kosha-border"
                  style={{ background: cat?.bg || '#E9EEF6' }}
                >
                  <CategoryIcon categoryId={catId} size={16} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] font-semibold text-ink truncate">{cat?.label || catId}</span>
                    <span className="text-[12px] font-semibold tabular-nums text-expense-text shrink-0">{fmt(amt)}</span>
                  </div>

                  <div className="mt-1.5">
                    <CategoryLine
                      pct={Math.max(6, barPct)}
                      color={cat?.color || C.income}
                      overBudget={overBudget}
                    />
                  </div>

                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <p className={`text-[10px] ${hasBudget ? 'tabular-nums' : ''} ${overBudget ? 'text-expense-text' : 'text-ink-3'}`}>
                      {hasBudget ? `${barPct}% of budget` : `${sharePct}% of total spend`}
                    </p>

                    {hasBudget ? (
                      <span className={`text-[10px] font-semibold tabular-nums shrink-0 ${overBudget ? 'text-expense-text' : 'text-ink-3'}`}>
                        {overBudget
                          ? `+${fmt(Math.abs(remaining))} over`
                          : `${fmt(remaining)} left`}
                      </span>
                    ) : null}
                  </div>

                  {hasBudget && pacePct !== null && barPct > pacePct && !overBudget && (
                    <p className="text-[9px] text-warning-text mt-0.5 font-medium text-right tracking-tight">
                      {barPct - pacePct}% ahead of pace
                    </p>
                  )}
                </div>
              </div>
            </RowTag>
          )
        })}
      </div>

      <div className="pt-2 mt-1 flex items-center justify-between gap-2">
        <p className="text-[10px] text-ink-3">
          {budgetedCount > 0
            ? `${budgetedCount} categor${budgetedCount === 1 ? 'y has' : 'ies have'} budget targets.`
            : 'No category budgets set yet.'}
        </p>

        {hasOverflow && (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="text-[11px] font-semibold text-brand hover:opacity-85"
          >
            {expanded
              ? 'Show fewer categories'
              : `Show all ${safeEntries.length} categories`}
          </button>
        )}
      </div>
    </div>
  )
})

export default CategorySpendingChart
