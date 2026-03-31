import { fmt } from '../../../lib/utils'
import {
  ResponsiveContainer,
  Sankey,
  Tooltip as RechartsTooltip,
} from 'recharts'

function MoneyRoutingTooltip({ active, payload }) {
  if (!active || !payload?.length) return null

  const row = payload[0]?.payload || payload[0] || {}
  const sourceName = row?.source?.name || row?.source?.payload?.name || ''
  const targetName = row?.target?.name || row?.target?.payload?.name || ''
  const flowLabel = sourceName && targetName
    ? `${sourceName} -> ${targetName}`
    : (row?.name || 'Flow node')
  const amount = Number(row?.value || row?.payload?.value || 0)

  return (
    <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5 shadow-card min-w-[186px]">
      <p className="text-[11px] font-semibold text-ink mb-1">{flowLabel}</p>
      <div className="flex items-center justify-between gap-3 text-[11px]">
        <span className="text-ink-3">Amount</span>
        <span className="font-semibold tabular-nums text-ink">{fmt(amount)}</span>
      </div>
    </div>
  )
}

function SankeyNode(props) {
  const {
    x,
    y,
    width,
    height,
    payload,
    containerWidth,
  } = props

  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) return null

  const label = String(payload?.name || '')
  const fill = payload?.color || '#0A67D8'
  const safeContainerWidth = Number(containerWidth || 560)
  const rightSide = x > safeContainerWidth * 0.58
  const textX = rightSide ? x - 6 : (x + width + 6)

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={3}
        ry={3}
        fill={fill}
        fillOpacity={0.88}
      />
      <text
        x={textX}
        y={y + (height / 2)}
        dy="0.35em"
        textAnchor={rightSide ? 'end' : 'start'}
        fontSize={10}
        fontWeight={600}
        fill="#10213F"
      >
        {label}
      </text>
    </g>
  )
}

export default function BreakdownCard({ earned, spent, invested, totalLabel = 'Total income' }) {
  const inflow = Number(earned || 0)
  const expense = Number(spent || 0)
  const investment = Number(invested || 0)
  const outflow = expense + investment
  const net = inflow - outflow
  const saved = Math.max(0, net)
  const deficit = Math.max(0, -net)

  const spentPct = inflow > 0 ? Math.round((expense / inflow) * 100) : 0
  const investedPct = inflow > 0 ? Math.round((investment / inflow) * 100) : 0
  const savedPct = inflow > 0 ? Math.round((saved / inflow) * 100) : 0
  const deficitPct = inflow > 0 ? Math.round((deficit / inflow) * 100) : 0

  const primaryRows = [
    {
      key: 'spent',
      label: 'Spent',
      amount: expense,
      pct: Math.max(0, spentPct),
      tone: 'text-expense-text',
      bar: '#E11D48',
      hint: 'Operations and lifestyle outflow',
    },
    {
      key: 'invested',
      label: 'Invested',
      amount: investment,
      pct: Math.max(0, investedPct),
      tone: 'text-invest-text',
      bar: '#7C3AED',
      hint: 'Future allocation and wealth build',
    },
    {
      key: saved > 0 ? 'leftover' : 'deficit',
      label: saved > 0 ? 'Leftover' : 'Deficit',
      amount: saved > 0 ? saved : deficit,
      pct: Math.max(0, saved > 0 ? savedPct : deficitPct),
      tone: saved > 0 ? 'text-income-text' : 'text-warning-text',
      bar: saved > 0 ? '#0E9F6E' : '#9A7200',
      hint: saved > 0 ? 'Available month-end buffer' : 'Outflow exceeded inflow',
    },
  ]

  const allocationSegments = primaryRows.filter((row) => row.pct > 0)

  const sankeyNodes = [
    { name: 'Inflow', color: '#0E9F6E' },
    ...(deficit > 0 ? [{ name: 'Deficit cover', color: '#9A7200' }] : []),
    { name: 'Outflow', color: '#10213F' },
    { name: 'Spent', color: '#E11D48' },
    { name: 'Invested', color: '#7C3AED' },
    ...(saved > 0 ? [{ name: 'Leftover', color: '#0E9F6E' }] : []),
  ]

  const nodeIndexByName = new Map(sankeyNodes.map((node, index) => [node.name, index]))
  const nodeAt = (name) => nodeIndexByName.get(name)

  const sankeyLinks = [
    {
      source: nodeAt('Inflow'),
      target: nodeAt('Outflow'),
      value: Math.max(0, Math.min(inflow, outflow)),
    },
    ...(deficit > 0
      ? [{ source: nodeAt('Deficit cover'), target: nodeAt('Outflow'), value: deficit }]
      : []),
    { source: nodeAt('Outflow'), target: nodeAt('Spent'), value: expense },
    { source: nodeAt('Outflow'), target: nodeAt('Invested'), value: investment },
    ...(saved > 0
      ? [{ source: nodeAt('Inflow'), target: nodeAt('Leftover'), value: saved }]
      : []),
  ].filter((link) => Number.isFinite(link.source) && Number.isFinite(link.target) && Number(link.value || 0) > 0)

  const sankeyData = {
    nodes: sankeyNodes,
    links: sankeyLinks,
  }

  const actionNote = (() => {
    if (net < 0) {
      return `Deficit warning: outflow exceeded inflow by ${fmt(deficit)} this month. Prioritize discretionary cuts and defer optional deployments.`
    }
    if (savedPct < 10) {
      return `Only ${savedPct}% of inflow is left after spending and investments. Aim for at least a 10-15% monthly buffer.`
    }
    if (investedPct < 8) {
      return `Investment share is ${investedPct}% of inflow. A small planned top-up can improve long-horizon consistency.`
    }
    return 'Allocation looks balanced for this month. Continue current pacing and keep the leftover buffer protected.'
  })()

  if (earned === 0) return null

  return (
    <div className="card p-4 border-0">
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div>
          <p className="section-label">Cashflow breakdown</p>
          <p className="text-[11px] text-ink-3 mt-0.5">Sankey routing from inflow into spending, investing, and month-end balance</p>
        </div>
        <span className={`text-[10px] px-2 py-1 rounded-pill font-semibold ${net >= 0 ? 'bg-income-bg text-income-text' : 'bg-warning-bg text-warning-text'}`}>
          {net >= 0 ? 'Net positive' : 'Net deficit'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-2.5">
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">{totalLabel}</p>
          <p className="text-[12px] font-bold tabular-nums text-income-text">{fmt(inflow)}</p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">Outflow</p>
          <p className="text-[12px] font-bold tabular-nums text-expense-text">{fmt(outflow)}</p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">Net</p>
          <p className={`text-[12px] font-bold tabular-nums ${net >= 0 ? 'text-income-text' : 'text-warning-text'}`}>
            {net >= 0 ? '+' : '-'}{fmt(Math.abs(net))}
          </p>
        </div>
      </div>

      <div className="rounded-card border border-kosha-border bg-kosha-surface-2 p-2.5 mb-2.5">
        <div className="h-2.5 rounded-pill bg-kosha-border overflow-hidden flex">
          {allocationSegments.map((segment) => (
            <div
              key={`allocation-segment-${segment.key}`}
              className="h-full"
              style={{ width: `${Math.max(4, segment.pct)}%`, background: segment.bar }}
            />
          ))}
        </div>

        <div className="mt-2 rounded-card border border-kosha-border bg-kosha-surface p-2">
          <ResponsiveContainer width="100%" height={208}>
            <Sankey
              data={sankeyData}
              node={<SankeyNode />}
              nodePadding={18}
              nodeWidth={14}
              margin={{ top: 8, right: 30, bottom: 8, left: 30 }}
              link={{ stroke: 'rgba(16,33,63,0.18)', strokeOpacity: 0.45 }}
              linkCurvature={0.42}
            >
              <RechartsTooltip content={<MoneyRoutingTooltip />} />
            </Sankey>
          </ResponsiveContainer>
        </div>

        <div className="mt-2 space-y-1.5">
          {primaryRows.map((row) => (
            <div key={row.key} className="rounded-card border border-kosha-border bg-kosha-surface px-2.5 py-2">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div>
                  <p className="text-[11px] font-semibold text-ink">{row.label}</p>
                  <p className="text-[10px] text-ink-3">{row.hint}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-[11px] font-semibold tabular-nums ${row.tone}`}>{fmt(row.amount)}</p>
                  <p className="text-[10px] text-ink-3 tabular-nums">{row.pct}% of inflow</p>
                </div>
              </div>

              <div className="h-1.5 rounded-pill bg-kosha-border overflow-hidden">
                <div className="h-full rounded-pill" style={{ width: `${Math.max(5, row.pct)}%`, background: row.bar }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-2 border-t border-kosha-border">
        <p className="text-[11px] text-ink-3 leading-relaxed">{actionNote}</p>
      </div>
    </div>
  )
}
