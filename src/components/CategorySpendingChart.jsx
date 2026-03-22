import { memo } from 'react'
import CategoryIcon from './CategoryIcon'
import { fmt } from '../lib/utils'
import { C } from '../lib/colors'
import { CATEGORIES } from '../lib/categories'

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
}) {
  if (!entries.length) return null

  const now = new Date()
  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear()
  const daysInMonth    = isCurrentMonth ? new Date(year, month, 0).getDate() : 30
  const pacePct        = isCurrentMonth
    ? Math.round((now.getDate() / daysInMonth) * 100)
    : null

  return (
    <>
      <div className="flex items-center justify-between -mb-3">
        <p className="section-label">{title}</p>
        {subtitle && <span className="text-caption text-ink-3">{subtitle}</span>}
      </div>

      <div className="card p-0 overflow-hidden">
        {entries.map(([catId, amt], i) => {
          const cat       = CATEGORIES.find(c => c.id === catId)
          const budget    = budgets[catId] || 0
          const hasBudget = budget > 0
          const barPct    = hasBudget
            ? Math.min(Math.round((amt / budget) * 100), 100)
            : Math.round((amt / total) * 100)
          const overBudget = hasBudget && amt > budget
          const remaining  = hasBudget ? budget - amt : null
          const RowTag     = onCategoryClick ? 'button' : 'div'

          return (
            <RowTag
              key={catId}
              onClick={onCategoryClick ? () => onCategoryClick(cat) : undefined}
              className={`w-full flex items-center gap-3 px-4 py-3.5 text-left
                          ${onCategoryClick ? 'active:bg-kosha-surface-2 transition-colors' : ''}
                          ${i < entries.length - 1 ? 'border-b border-kosha-border' : ''}`}
            >
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ background: cat?.bg || '#E9EEF6' }}>
                <CategoryIcon categoryId={catId} size={20} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-label font-medium text-ink truncate">
                    {cat?.label || catId}
                  </span>
                  {hasBudget ? (
                    <span className={`text-caption ml-2 shrink-0 font-semibold
                      ${overBudget ? 'text-expense-text' : 'text-ink-3'}`}>
                      {overBudget
                        ? `+${fmt(Math.abs(remaining))} over`
                        : `${fmt(remaining)} left`}
                    </span>
                  ) : (
                    <span className="text-caption text-ink-4 ml-2 shrink-0">
                      {Math.round((amt / total) * 100)}%
                    </span>
                  )}
                </div>

                <CategoryLine
                  pct={barPct}
                  color={cat?.color || C.income}
                  overBudget={overBudget}
                />

                {hasBudget && (
                  <p className={`text-caption mt-1 tabular-nums
                    ${overBudget ? 'text-expense-text' : 'text-ink-3'}`}>
                    {fmt(amt)} of {fmt(budget)}
                  </p>
                )}

                {/* Pace indicator — only shown when budget is set and month is current */}
                {hasBudget && pacePct !== null && barPct > pacePct && !overBudget && (
                  <p className="text-[10px] text-warning-text mt-1 font-medium text-right tracking-tight">
                    Tracking {barPct - pacePct}% ahead of pace
                  </p>
                )}
              </div>

              <span className="text-label font-semibold tabular-nums ml-2 shrink-0 text-expense-text">
                {fmt(amt)}
              </span>
            </RowTag>
          )
        })}
      </div>
    </>
  )
})

export default CategorySpendingChart
