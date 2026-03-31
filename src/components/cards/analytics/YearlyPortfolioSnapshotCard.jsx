import { C } from '../../../lib/colors'
import { fmt } from '../../../lib/utils'
import { useNavigate } from 'react-router-dom'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts'

function PortfolioMixTooltip({ active, payload, total }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload || {}
  const value = Number(row?.value || 0)
  const pct = total > 0 ? Math.round((value / total) * 100) : 0

  return (
    <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5 shadow-card min-w-[170px]">
      <p className="text-[11px] font-semibold text-ink mb-1">{row?.name || 'Vehicle'}</p>
      <div className="space-y-0.5 text-[11px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-3">Allocated</span>
          <span className="font-semibold tabular-nums text-invest-text">{fmt(value)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-3">Share</span>
          <span className="font-semibold tabular-nums text-ink">{pct}%</span>
        </div>
      </div>
    </div>
  )
}

function HoldingBarTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload || {}

  return (
    <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5 shadow-card min-w-[168px]">
      <p className="text-[11px] font-semibold text-ink mb-1">{row?.name || 'Vehicle'}</p>
      <div className="space-y-0.5 text-[11px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-3">Portfolio share</span>
          <span className="font-semibold tabular-nums text-brand">{Math.round(Number(row?.pct || 0))}%</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-3">Allocated</span>
          <span className="font-semibold tabular-nums text-ink">{fmt(Number(row?.value || 0))}</span>
        </div>
      </div>
    </div>
  )
}

export default function YearlyPortfolioSnapshotCard({ data, vehicleData = [] }) {
  const navigate = useNavigate()
  const safeVehicleData = (Array.isArray(vehicleData) ? vehicleData : [])
    .map(([name, value]) => ({
      name,
      value: Number(value || 0),
    }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value)

  const totalPortfolio = safeVehicleData.reduce((sum, row) => sum + row.value, 0)
  const topHolding = safeVehicleData[0] || null
  const topHoldingPct = topHolding && totalPortfolio > 0
    ? Math.round((topHolding.value / totalPortfolio) * 100)
    : 0

  const palette = (Array.isArray(C.portfolio) && C.portfolio.length > 0)
    ? C.portfolio
    : [C.brand, C.brandMid, C.brandLight, C.ink, C.invest, C.brandBorder]
  const maxSlices = 5
  const visibleRows = safeVehicleData.slice(0, maxSlices)
  const visibleTotal = visibleRows.reduce((sum, row) => sum + row.value, 0)

  const mixRows = visibleRows.map((row, index) => ({
    ...row,
    pct: totalPortfolio > 0 ? Math.round((row.value / totalPortfolio) * 100) : 0,
    color: palette[index % palette.length],
  }))

  if (safeVehicleData.length > maxSlices && totalPortfolio > visibleTotal) {
    const otherValue = totalPortfolio - visibleTotal
    mixRows.push({
      name: 'Other',
      value: otherValue,
      pct: totalPortfolio > 0 ? Math.round((otherValue / totalPortfolio) * 100) : 0,
      color: C.brandBorder,
    })
  }

  const totalIncome = Number(data?.totalIncome || 0)
  const totalInvestment = Number(data?.totalInvestment || 0)
  const deploymentRate = totalIncome > 0
    ? Math.round((totalInvestment / totalIncome) * 100)
    : 0

  const rows = safeVehicleData.slice(0, 4).map((row, index) => ({
    ...row,
    pct: totalPortfolio > 0 ? Math.round((row.value / totalPortfolio) * 100) : 0,
    color: mixRows.find((slice) => slice.name === row.name)?.color || palette[index % palette.length],
  }))
  const rebalanceTarget = safeVehicleData[1]?.name || null

  const diversificationScore = totalPortfolio > 0
    ? Math.max(0, Math.min(100, Math.round((safeVehicleData.length * 18) + (55 - Math.max(0, topHoldingPct - 45)))))
    : 0
  const concentrationBand = topHoldingPct >= 60
    ? 'High concentration'
    : topHoldingPct >= 45
      ? 'Moderate concentration'
      : 'Balanced concentration'

  const actions = []
  if (totalPortfolio <= 0) {
    actions.push('No yearly investment deployment tracked yet. Start with one core vehicle to build a baseline.')
  } else {
    if (topHoldingPct >= 55) {
      actions.push(`Concentration alert: ${topHolding?.name || 'Top holding'} is ${topHoldingPct}% of portfolio. Consider rebalancing into one additional vehicle.`)
    } else {
      actions.push(`Concentration is manageable. Largest holding is ${topHoldingPct}% of portfolio.`)
    }

    if (safeVehicleData.length < 3) {
      actions.push('Diversification opportunity: add at least one more vehicle category for resilience.')
    } else {
      actions.push('Diversification base is healthy. Focus on planned allocation drift checks each quarter.')
    }

    if (deploymentRate < 10) {
      actions.push(`Deployment is ${deploymentRate}% of income this year. Increasing disciplined deployment could improve long-term growth.`)
    } else if (deploymentRate > 35) {
      actions.push(`Deployment is ${deploymentRate}% of income. Ensure emergency runway is protected before increasing further.`)
    } else {
      actions.push(`Deployment sits at ${deploymentRate}% of yearly income, within a balanced range for most plans.`)
    }
  }

  const nextAction = (() => {
    if (totalPortfolio <= 0) {
      return 'Log your first investment entry to activate allocation tracking and concentration alerts.'
    }
    if (topHoldingPct >= 55 && rebalanceTarget) {
      return `Log the next investment in ${rebalanceTarget} to reduce concentration risk.`
    }
    if (safeVehicleData.length < 3) {
      return 'Log the next investment in a new vehicle category to improve diversification.'
    }
    if (deploymentRate < 10) {
      return 'Log a small top-up this week to keep yearly deployment momentum.'
    }
    return 'Log your next planned monthly top-up to stay aligned with this allocation mix.'
  })()

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div>
          <p className="text-label font-semibold text-ink">Yearly portfolio snapshot</p>
          <p className="text-[11px] text-ink-3 mt-0.5">Allocation mix, concentration, and action cues for this year.</p>
        </div>
        <span className="text-[11px] font-semibold px-2 py-1 rounded-pill bg-brand-container text-brand-on">
          {totalPortfolio > 0 ? fmt(totalPortfolio, true) : 'No portfolio yet'}
        </span>
      </div>

      {totalPortfolio > 0 ? (
        <>
          <div className="rounded-card border border-kosha-border bg-kosha-surface-2 p-3 mb-3">
            <div className="grid md:grid-cols-[1.02fr_0.98fr] gap-3">
              <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
                <div className="relative h-[212px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={mixRows}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={58}
                        outerRadius={90}
                        paddingAngle={2}
                        stroke="#FFFFFF"
                        strokeWidth={2}
                      >
                        {mixRows.map((row) => (
                          <Cell key={`yearly-mix-slice-${row.name}`} fill={row.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip content={<PortfolioMixTooltip total={totalPortfolio} />} />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-[10px] text-ink-3">Yearly allocation</p>
                    <p className="text-[16px] font-bold tabular-nums text-ink">{fmt(totalPortfolio, true)}</p>
                    <p className="text-[10px] text-ink-3">{safeVehicleData.length} vehicle{safeVehicleData.length === 1 ? '' : 's'}</p>
                  </div>
                </div>

                <p className="text-[11px] text-ink-3 mt-1">
                  Top holding is <span className="font-semibold text-ink">{topHolding?.name || '—'}</span> at <span className="font-semibold text-ink">{topHoldingPct}%</span>.
                </p>
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
                    <p className="text-[10px] text-ink-3">Concentration</p>
                    <p className={`text-[13px] font-bold tabular-nums ${topHoldingPct >= 55 ? 'text-warning-text' : 'text-brand'}`}>{topHoldingPct}%</p>
                    <p className="text-[10px] text-ink-3 mt-0.5">{concentrationBand}</p>
                  </div>
                  <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
                    <p className="text-[10px] text-ink-3">Deploy rate</p>
                    <p className={`text-[13px] font-bold tabular-nums ${deploymentRate >= 12 && deploymentRate <= 35 ? 'text-income-text' : 'text-warning-text'}`}>{deploymentRate}%</p>
                  </div>
                  <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
                    <p className="text-[10px] text-ink-3">Diversification</p>
                    <p className={`text-[13px] font-bold tabular-nums ${diversificationScore >= 70 ? 'text-income-text' : diversificationScore >= 50 ? 'text-brand' : 'text-warning-text'}`}>
                      {diversificationScore}/100
                    </p>
                  </div>
                  <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
                    <p className="text-[10px] text-ink-3">Rebalance target</p>
                    <p className="text-[12px] font-bold text-ink truncate">{rebalanceTarget || 'None'}</p>
                  </div>
                </div>

                <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-[10px] font-semibold text-ink-3">Top holdings runway</p>
                    <span className="text-[10px] text-ink-3">Share %</span>
                  </div>
                  <ResponsiveContainer width="100%" height={156}>
                    <BarChart data={rows} layout="vertical" margin={{ top: 6, right: 8, left: 8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(16,33,63,0.10)" />
                      <XAxis
                        type="number"
                        domain={[0, 'dataMax + 8']}
                        tickFormatter={(value) => `${Math.round(value)}%`}
                        tick={{ fontSize: 10, fill: 'rgba(94,109,143,0.95)' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={74}
                        tick={{ fontSize: 10, fill: 'rgba(94,109,143,0.95)' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <RechartsTooltip content={<HoldingBarTooltip />} />
                      <Bar dataKey="pct" radius={[6, 6, 6, 6]}>
                        {rows.map((row) => (
                          <Cell key={`yearly-holding-bar-${row.name}`} fill={row.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-card border border-kosha-border bg-kosha-surface-2 p-3 mb-3">
          <p className="text-[11px] text-ink-3">No yearly vehicle allocation is tagged yet. Add a vehicle label to investment transactions to unlock concentration and diversification intelligence.</p>
        </div>
      )}

      <div className="rounded-card border border-kosha-border bg-kosha-surface-2 p-2.5 space-y-1.5 mb-3">
        {actions.slice(0, 3).map((line, index) => (
          <div key={`portfolio-action-${index}`} className="flex items-start gap-2">
            <span className="w-4 text-right text-[11px] font-bold text-brand shrink-0">{index + 1}</span>
            <p className="text-[11px] text-ink-3 leading-relaxed">{line}</p>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-kosha-border flex items-center justify-between gap-2">
        <p className="text-[11px] text-ink-3 flex-1 leading-relaxed">{nextAction}</p>
        <button
          type="button"
          onClick={() => navigate('/transactions', { state: { openAddInvestment: true } })}
          className="btn-secondary-sm shrink-0"
        >
          Log investment
        </button>
      </div>

      <div className="mt-2 h-px" style={{ background: C.brandBorder }} />
    </div>
  )
}
