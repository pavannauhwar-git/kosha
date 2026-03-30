import { memo, useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, Treemap, Tooltip as RechartsTooltip } from 'recharts'
import CategoryIcon from './CategoryIcon'
import { fmt } from '../../lib/utils'
import { C } from '../../lib/colors'
import { CATEGORIES } from '../../lib/categories'

function TreemapTooltip({ active, payload, total }) {
  if (!active || !payload?.length) return null

  const row = payload[0]?.payload || {}
  const amount = Number(row?.amount || row?.value || 0)
  const share = total > 0 ? Math.round((amount / total) * 100) : 0

  return (
    <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5 shadow-card">
      <p className="text-[11px] font-semibold text-ink mb-1">{row?.name || 'Category'}</p>
      <div className="flex items-center justify-between gap-3 text-[11px] mb-0.5">
        <span className="text-ink-3">Spend</span>
        <span className="font-semibold text-expense-text tabular-nums">{fmt(amount)}</span>
      </div>
      <div className="flex items-center justify-between gap-3 text-[11px]">
        <span className="text-ink-3">Share</span>
        <span className="font-semibold text-ink tabular-nums">{share}%</span>
      </div>
    </div>
  )
}

function TreemapCell(props) {
  const { x, y, width, height, payload } = props
  if (!Number.isFinite(x) || !Number.isFinite(y) || width <= 0 || height <= 0 || !payload) return null

  const showLabel = width > 68 && height > 36
  const showShare = width > 90 && height > 54

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={8}
        ry={8}
        fill={payload.tileColor || '#E7F2FF'}
        stroke="rgba(255,255,255,0.95)"
        strokeWidth={1}
      />
      <rect
        x={x + 2}
        y={y + 2}
        width={Math.max(0, width - 4)}
        height={4}
        rx={2}
        ry={2}
        fill={payload.accentColor || C.brand}
        fillOpacity={0.9}
      />
      {showLabel && (
        <text x={x + 7} y={y + 18} fill="#1F2B5D" fontSize={11} fontWeight={700}>
          {payload.name}
        </text>
      )}
      {showShare && (
        <text x={x + 7} y={y + 34} fill="rgba(31,43,93,0.7)" fontSize={10} fontWeight={600}>
          {payload.sharePct}%
        </text>
      )}
    </g>
  )
}

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
  const [viewMode, setViewMode] = useState('list')

  const safeInitialVisibleCount = Math.max(
    1,
    Number.isFinite(Number(initialVisibleCount))
      ? Number(initialVisibleCount)
      : safeEntries.length
  )

  const hasOverflow = safeEntries.length > safeInitialVisibleCount
  const canShowTreemap = safeEntries.length >= 4
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    setExpanded(false)
  }, [collapseKey])

  useEffect(() => {
    if (!canShowTreemap && viewMode !== 'list') {
      setViewMode('list')
    }
  }, [canShowTreemap, viewMode])

  const visibleEntries = useMemo(() => {
    if (!hasOverflow || expanded) return safeEntries
    return safeEntries.slice(0, safeInitialVisibleCount)
  }, [safeEntries, expanded, hasOverflow, safeInitialVisibleCount])

  const categoryById = useMemo(() => {
    return new Map(CATEGORIES.map((category) => [category.id, category]))
  }, [])

  const safeTotal = total > 0 ? total : 1
  const budgetedCount = safeEntries.filter(([catId]) => Number(budgets?.[catId] || 0) > 0).length
  const treemapRows = useMemo(() => safeEntries.map(([catId, amt]) => {
    const cat = categoryById.get(catId)
    const amount = Number(amt || 0)
    return {
      id: catId,
      name: cat?.label || catId,
      value: amount,
      amount,
      sharePct: Math.round((amount / safeTotal) * 100),
      tileColor: cat?.bg || '#E7F2FF',
      accentColor: cat?.color || C.brand,
    }
  }), [safeEntries, safeTotal, categoryById])
  const dominant = treemapRows[0] || null

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
          {canShowTreemap && (
            <div className="inline-flex rounded-pill border border-kosha-border bg-kosha-surface mt-2 p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`h-6 px-2 rounded-pill text-[10px] font-semibold transition-colors ${viewMode === 'list' ? 'bg-brand text-white' : 'text-ink-2 hover:bg-kosha-surface-2'}`}
              >
                List
              </button>
              <button
                type="button"
                onClick={() => setViewMode('treemap')}
                className={`h-6 px-2 rounded-pill text-[10px] font-semibold transition-colors ${viewMode === 'treemap' ? 'bg-brand text-white' : 'text-ink-2 hover:bg-kosha-surface-2'}`}
              >
                Treemap
              </button>
            </div>
          )}
        </div>
      </div>

      {viewMode === 'treemap' ? (
        <div className="space-y-2.5">
          <div className="rounded-card border border-kosha-border bg-kosha-surface-2 p-2.5">
            <ResponsiveContainer width="100%" height={220}>
              <Treemap
                data={treemapRows}
                dataKey="value"
                stroke="rgba(255,255,255,0.9)"
                content={<TreemapCell />}
                isAnimationActive
                onClick={(node) => {
                  if (!onCategoryClick) return
                  const id = node?.id || node?.payload?.id
                  if (!id) return
                  const category = categoryById.get(id)
                  if (category) onCategoryClick(category)
                }}
              >
                <RechartsTooltip content={<TreemapTooltip total={safeTotal} />} />
              </Treemap>
            </ResponsiveContainer>
          </div>

          {dominant && (
            <p className="text-[11px] text-ink-3">
              Concentration signal: {dominant.name} contributes {dominant.sharePct}% of this month's category spend.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {visibleEntries.map(([catId, amt]) => {
            const cat = categoryById.get(catId)
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
      )}

      <div className="pt-2 mt-1 flex items-center justify-between gap-2">
        <p className="text-[10px] text-ink-3">
          {budgetedCount > 0
            ? `${budgetedCount} categor${budgetedCount === 1 ? 'y has' : 'ies have'} budget targets.`
            : 'No category budgets set yet.'}
        </p>

        {viewMode === 'list' && hasOverflow && (
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
