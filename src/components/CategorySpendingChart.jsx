import CategoryIcon from './CategoryIcon'
import { fmt } from '../lib/utils'
import { C } from '../lib/colors'
import { CATEGORIES } from '../lib/categories'

function SvgArcBar({ pct, color, overBudget = false, pacePct = null }) {
  const W = 100
  const H = 8
  const R = H / 2
  const max = W - R * 2
  const fill = Math.max(0, Math.min(pct, 100)) / 100 * max
  const barColor = overBudget ? C.expense : color
  
  // Pace indicator position
  let paceMarker = null;
  if (pacePct !== null) {
     const pacePos = Math.max(0, Math.min(pacePct, 100)) / 100 * max;
     paceMarker = <line x1={R + pacePos} y1={0} x2={R + pacePos} y2={H} stroke={C.ink} strokeWidth={2.5} strokeLinecap="round" />
  }

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{overflow: 'visible'}}>
      <line x1={R} y1={R} x2={W - R} y2={R}
        stroke={C.brandBorder} strokeWidth={H} strokeLinecap="round" />
      {fill > 0 && (
        <line x1={R} y1={R} x2={R + fill} y2={R}
          stroke={barColor} strokeWidth={H} strokeLinecap="round" />
      )}
      {paceMarker}
    </svg>
  )
}

export default function CategorySpendingChart({
  entries,
  total,
  budgets = {},
  title = 'Spent by Category',
  subtitle,
  onCategoryClick,
  month,
  year,
}) {

  const now = new Date()
  const isCurrentMonth = month === now.getMonth() + 1 && year === now.getFullYear()
  const daysInMonth = isCurrentMonth ? new Date(year, month, 0).getDate() : 30
  const pacePct = isCurrentMonth ? Math.round((now.getDate() / daysInMonth) * 100) : null

  if (!entries.length) return null

  return (
    <>
      <div className="flex items-center justify-between -mb-3">
        <p className="section-label">{title}</p>
        {subtitle && <span className="text-caption text-ink-3">{subtitle}</span>}
      </div>

      <div className="card p-0 overflow-hidden">
        {entries.map(([catId, amt], i) => {
          const cat = CATEGORIES.find(c => c.id === catId)
          const budget = budgets[catId] || 0
          const hasBudget = budget > 0
          const barPct = hasBudget
            ? Math.min(Math.round((amt / budget) * 100), 100)
            : Math.round((amt / total) * 100)
          const overBudget = hasBudget && amt > budget
          const remaining = hasBudget ? budget - amt : null
          const RowTag = onCategoryClick ? 'button' : 'div'

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

                <SvgArcBar
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
}
