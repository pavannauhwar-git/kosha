import { C } from '../../../lib/colors'
import { fmt } from '../../../lib/utils'

export default function YearlyPortfolioSnapshotCard({ data, vehicleData = [] }) {
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

  const totalIncome = Number(data?.totalIncome || 0)
  const totalInvestment = Number(data?.totalInvestment || 0)
  const deploymentRate = totalIncome > 0
    ? Math.round((totalInvestment / totalIncome) * 100)
    : 0

  const rows = safeVehicleData.slice(0, 4).map((row) => ({
    ...row,
    pct: totalPortfolio > 0 ? Math.round((row.value / totalPortfolio) * 100) : 0,
  }))

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
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="rounded-card bg-kosha-surface-2 p-2.5">
              <p className="text-[10px] text-ink-3">Top holding</p>
              <p className="text-[12px] font-bold text-ink truncate">{topHolding?.name || '—'}</p>
            </div>
            <div className="rounded-card bg-kosha-surface-2 p-2.5">
              <p className="text-[10px] text-ink-3">Concentration</p>
              <p className={`text-[12px] font-bold tabular-nums ${topHoldingPct >= 55 ? 'text-warning-text' : 'text-brand'}`}>{topHoldingPct}%</p>
            </div>
            <div className="rounded-card bg-kosha-surface-2 p-2.5">
              <p className="text-[10px] text-ink-3">Deploy rate</p>
              <p className="text-[12px] font-bold tabular-nums text-invest-text">{deploymentRate}%</p>
            </div>
          </div>

          <div className="space-y-2 mb-3">
            {rows.map((row) => (
              <div key={row.name}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-[11px] text-ink-2 truncate">{row.name}</span>
                  <span className="text-[11px] text-ink-3 tabular-nums">{row.pct}%</span>
                </div>
                <div className="h-1.5 rounded-pill bg-brand-container/55 overflow-hidden">
                  <div className="h-full rounded-pill bg-brand" style={{ width: `${Math.max(8, row.pct)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <div className="space-y-1.5">
        {actions.slice(0, 3).map((line, index) => (
          <p key={`portfolio-action-${index}`} className="text-[11px] text-ink-3">
            {index + 1}. {line}
          </p>
        ))}
      </div>

      <div className="mt-2 h-px" style={{ background: C.brandBorder }} />
    </div>
  )
}
