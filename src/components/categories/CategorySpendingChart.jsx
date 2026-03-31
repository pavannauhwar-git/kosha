import { memo, useMemo } from 'react'
import { ResponsiveContainer, Treemap, Tooltip as RechartsTooltip } from 'recharts'
import { fmt } from '../../lib/utils'
import { C } from '../../lib/colors'
import { CATEGORIES } from '../../lib/categories'
import useCompactViewport from '../../hooks/useCompactViewport'

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
  const {
    x,
    y,
    width,
    height,
    children,
    name,
    sharePct,
    amountShort,
    tileColor,
    accentColor,
    isTiny = false,
  } = props

  // Recharts Treemap passes node fields directly to custom `content`.
  // Skip only internal nodes; leaf nodes must always paint.
  if (Array.isArray(children) && children.length > 0) return null
  if (!Number.isFinite(x) || !Number.isFinite(y) || width <= 0 || height <= 0) return null

  const showLabel = width > (isTiny ? 66 : 74) && height > (isTiny ? 28 : 32)
  const showMeta = width > (isTiny ? 128 : 112) && height > (isTiny ? 60 : 52)
  const labelPanelWidth = Math.max(0, Math.min(width - 12, isTiny ? 136 : 150))
  const labelFontFamily = "'Plus Jakarta Sans', system-ui, sans-serif"

  return (
    <g shapeRendering="geometricPrecision">
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={8}
        ry={8}
        fill={tileColor || '#E7F2FF'}
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
        fill={accentColor || C.brand}
        fillOpacity={0.92}
      />

      {showLabel && (
        <>
          <rect
            x={x + 6}
            y={y + 8}
            width={labelPanelWidth}
            height={showMeta ? (isTiny ? 30 : 34) : (isTiny ? 16 : 18)}
            rx={6}
            ry={6}
            fill="rgba(255,255,255,0.72)"
          />
          <text
            x={x + 11}
            y={y + (isTiny ? 19 : 21)}
            fill="#10213F"
            fontSize={isTiny ? 10 : 11}
            fontWeight={700}
            fontFamily={labelFontFamily}
            style={{ paintOrder: 'stroke', stroke: 'rgba(255,255,255,0.92)', strokeWidth: 0.6, strokeLinejoin: 'round' }}
          >
            {name}
          </text>
        </>
      )}
      {showMeta && (
        <text
          x={x + 11}
          y={y + (isTiny ? 33 : 37)}
          fill="rgba(16,33,63,0.85)"
          fontSize={isTiny ? 9 : 10}
          fontWeight={600}
          fontFamily={labelFontFamily}
        >
          {sharePct}% · {amountShort}
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
}) {
  const isCompact = useCompactViewport()
  const isTiny = useCompactViewport(360)

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
          <ResponsiveContainer width="100%" height={isTiny ? 272 : isCompact ? 256 : 232}>
            <Treemap
              data={treemapRows}
              dataKey="value"
              nameKey="name"
              stroke="rgba(255,255,255,0.9)"
              content={<TreemapCell isTiny={isTiny} />}
              isAnimationActive={false}
            >
              <RechartsTooltip content={<TreemapTooltip total={safeTotal} />} />
            </Treemap>
          </ResponsiveContainer>
        </div>

        {dominant && (
          <p className={isTiny ? 'text-[10px] text-ink-3' : 'text-[11px] text-ink-3'}>
            Dominant bucket: {dominant.name} at {dominant.sharePct}% ({dominant.amountLabel}).
          </p>
        )}
      </div>
    </div>
  )
})

export default CategorySpendingChart
