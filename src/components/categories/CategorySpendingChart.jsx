import { memo, useMemo } from 'react'
import { ResponsiveContainer, Treemap, Tooltip as RechartsTooltip } from 'recharts'
import CategoryIcon from './CategoryIcon'
import { fmt } from '../../lib/utils'
import { C } from '../../lib/colors'
import { CATEGORIES } from '../../lib/categories'

function compactAmount(value) {
  const n = Number(value || 0)
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${Math.round((n / 1_000_000) * 10) / 10}M`
  if (abs >= 1_000) return `${Math.round((n / 1_000) * 10) / 10}k`
  return `${Math.round(n)}`
}

function TreemapTooltip({ active, payload, total }) {
  if (!active || !payload?.length) return null

  const row = payload[0]?.payload || payload[0] || {}
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
  const { depth, x, y, width, height, payload } = props
  if (depth !== 1) return null
  if (!Number.isFinite(x) || !Number.isFinite(y) || width <= 0 || height <= 0 || !payload) return null

  const showLabel = width > 74 && height > 32
  const showMeta = width > 110 && height > 52

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
        fillOpacity={0.92}
      />

      {showLabel && (
        <text x={x + 7} y={y + 18} fill="#1F2B5D" fontSize={11} fontWeight={700}>
          {payload.name}
        </text>
      )}
      {showMeta && (
        <text x={x + 7} y={y + 34} fill="rgba(31,43,93,0.72)" fontSize={10} fontWeight={600}>
          {payload.sharePct}% · {payload.amountShort}
        </text>
      )}
    </g>
  )
}

const CategorySpendingChart = memo(function CategorySpendingChart({
  entries,
  total,
  title = 'Spent by Category',
  subtitle,
  maxRows = 8,
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

  const treemapRows = useMemo(() => safeEntries.map(([catId, amt]) => {
    const cat = categoryById.get(catId)
    const amount = Number(amt || 0)

    return {
      id: catId,
      name: cat?.label || catId,
      value: amount,
      amount,
      amountShort: compactAmount(amount),
      amountLabel: fmt(amount),
      sharePct: Math.round((amount / safeTotal) * 100),
      tileColor: cat?.bg || '#E7F2FF',
      accentColor: cat?.color || C.brand,
    }
  }), [safeEntries, safeTotal, categoryById])

  const dominant = treemapRows[0] || null
  const shownRows = treemapRows.slice(0, maxRows)
  const shownShare = shownRows.reduce((sum, row) => sum + row.sharePct, 0)
  const hiddenCount = Math.max(0, treemapRows.length - shownRows.length)
  const peakAmount = Math.max(...treemapRows.map((row) => row.amount), 1)

  if (!treemapRows.length) return null

  return (
    <div className="card p-4 border-0">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="section-label">{title}</p>
          {subtitle ? (
            <p className="text-[10px] text-ink-3 mt-0.5">{subtitle}</p>
          ) : (
            <p className="text-[10px] text-ink-3 mt-0.5">Treemap view of this month&apos;s spend hierarchy</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-[10px] text-ink-3">Total</p>
          <p className="text-[13px] font-bold text-expense-text tabular-nums">{fmt(safeTotal)}</p>
        </div>
      </div>

      <div className="space-y-2.5">
        <div className="rounded-card border border-kosha-border bg-kosha-surface-2 p-2.5">
          <ResponsiveContainer width="100%" height={232}>
            <Treemap
              data={treemapRows}
              dataKey="value"
              nameKey="name"
              stroke="rgba(255,255,255,0.9)"
              content={<TreemapCell />}
              isAnimationActive={false}
            >
              <RechartsTooltip content={<TreemapTooltip total={safeTotal} />} />
            </Treemap>
          </ResponsiveContainer>
        </div>

        <div className="space-y-1.5">
          {shownRows.map((row) => (
            <div key={row.id} className="rounded-card bg-kosha-surface-2 px-2.5 py-2">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-6 h-6 rounded-full border border-kosha-border flex items-center justify-center" style={{ background: row.tileColor }}>
                    <CategoryIcon categoryId={row.id} size={12} />
                  </div>
                  <p className="text-[11px] font-semibold text-ink truncate">{row.name}</p>
                </div>
                <p className="text-[11px] font-semibold tabular-nums text-expense-text shrink-0">{row.amountLabel}</p>
              </div>
              <div className="h-1.5 rounded-pill bg-kosha-border overflow-hidden">
                <div
                  className="h-full rounded-pill"
                  style={{ width: `${Math.max(8, Math.round((row.amount / peakAmount) * 100))}%`, background: row.accentColor }}
                />
              </div>
              <p className="text-[10px] text-ink-3 mt-1 tabular-nums">{row.sharePct}% of total</p>
            </div>
          ))}

          {hiddenCount > 0 && (
            <p className="text-[10px] text-ink-3">+ {hiddenCount} more category branch{hiddenCount === 1 ? '' : 'es'} not listed ({Math.max(0, 100 - shownShare)}% of total).</p>
          )}
        </div>

        {dominant && (
          <p className="text-[11px] text-ink-3">
            Dominant bucket: {dominant.name} at {dominant.sharePct}% ({dominant.amountLabel}).
          </p>
        )}
      </div>
    </div>
  )
})

export default CategorySpendingChart
