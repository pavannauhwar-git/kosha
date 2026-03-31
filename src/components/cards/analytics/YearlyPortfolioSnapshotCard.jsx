import { C } from '../../../lib/colors'
import { fmt } from '../../../lib/utils'
import { useNavigate } from 'react-router-dom'

const ALLOCATION_PALETTE = ['#0A67D8', '#2F7AD9', '#629CE6', '#8CB7ED', '#B5D0F2', '#D6E6F8']

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

  const totalIncome = Number(data?.totalIncome || 0)
  const totalInvestment = Number(data?.totalInvestment || 0)
  const deploymentRate = totalIncome > 0
    ? Math.round((totalInvestment / totalIncome) * 100)
    : 0

  const visibleRows = safeVehicleData.slice(0, 6)
  const visibleTotal = visibleRows.reduce((sum, row) => sum + row.value, 0)
  const mixRows = visibleRows.map((row, index) => ({
    ...row,
    pct: totalPortfolio > 0 ? Math.round((row.value / totalPortfolio) * 100) : 0,
    color: ALLOCATION_PALETTE[index % ALLOCATION_PALETTE.length],
  }))

  if (safeVehicleData.length > 6 && totalPortfolio > visibleTotal) {
    const otherValue = totalPortfolio - visibleTotal
    mixRows.push({
      name: 'Other',
      value: otherValue,
      pct: totalPortfolio > 0 ? Math.round((otherValue / totalPortfolio) * 100) : 0,
      color: C.brandBorder,
    })
  }

  const diversificationScore = totalPortfolio > 0
    ? Math.max(0, Math.min(100, Math.round((safeVehicleData.length * 18) + (55 - Math.max(0, topHoldingPct - 45)))))
    : 0

  const concentrationBand = topHoldingPct >= 60
    ? 'High concentration'
    : topHoldingPct >= 45
      ? 'Moderate concentration'
      : 'Balanced concentration'

  const rebalanceTarget = safeVehicleData[1]?.name || null

  const actions = []
  if (totalPortfolio <= 0) {
    actions.push('No yearly portfolio allocation is tagged yet. Start with one core vehicle and build from there.')
  } else {
    if (topHoldingPct >= 55) {
      actions.push(`Concentration risk: ${topHolding?.name || 'Top holding'} is ${topHoldingPct}% of your yearly portfolio.`)
    } else {
      actions.push(`Concentration is controlled. Largest holding is ${topHoldingPct}% of yearly allocation.`)
    }

    if (safeVehicleData.length < 3) {
      actions.push('Diversification opportunity: add one more vehicle category in the next planned top-up.')
    } else {
      actions.push('Diversification spread is healthy. Keep contribution cadence aligned with current weights.')
    }

    if (deploymentRate < 10) {
      actions.push(`Deployment is ${deploymentRate}% of income. Increase allocation cadence if runway is stable.`)
    } else if (deploymentRate > 35) {
      actions.push(`Deployment is ${deploymentRate}% of income. Keep emergency runway protected before increasing further.`)
    } else {
      actions.push(`Deployment at ${deploymentRate}% of income is within a balanced range.`)
    }
  }

  const nextAction = (() => {
    if (totalPortfolio <= 0) return 'Log your first investment with a vehicle label to activate allocation intelligence.'
    if (topHoldingPct >= 55 && rebalanceTarget) return `Route the next top-up to ${rebalanceTarget} to reduce concentration.`
    if (safeVehicleData.length < 3) return 'Add a new vehicle category in the next investment to improve diversification.'
    return 'Continue planned monthly top-ups to preserve the current allocation ladder.'
  })()

  return (
    <div className="card p-4 border-0">
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div>
          <p className="text-label font-semibold text-ink">Yearly portfolio snapshot</p>
          <p className="text-[11px] text-ink-3 mt-0.5">Allocation ladder and concentration cues across the selected year.</p>
        </div>
        <span className="text-[11px] font-semibold px-2 py-1 rounded-pill bg-brand-container text-brand-on">
          {totalPortfolio > 0 ? fmt(totalPortfolio, true) : 'No allocation'}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
          <p className="text-[10px] text-ink-3">Top holding</p>
          <p className={`text-[13px] font-bold tabular-nums ${topHoldingPct >= 55 ? 'text-warning-text' : 'text-brand'}`}>{topHoldingPct}%</p>
        </div>
        <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
          <p className="text-[10px] text-ink-3">Concentration</p>
          <p className="text-[13px] font-bold text-ink truncate">{concentrationBand}</p>
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
      </div>

      {totalPortfolio > 0 ? (
        <div className="rounded-card border border-kosha-border bg-kosha-surface-2 p-3 mb-3">
          <p className="text-[10px] text-ink-3 mb-1.5">Allocation ladder</p>
          <div className="h-3 rounded-pill bg-kosha-border overflow-hidden flex mb-2.5">
            {mixRows.map((row) => (
              <div
                key={`yearly-allocation-segment-${row.name}`}
                title={`${row.name}: ${row.pct}%`}
                style={{ width: `${Math.max(4, row.pct)}%`, background: row.color }}
              />
            ))}
          </div>

          <div className="space-y-2">
            {mixRows.map((row) => (
              <div key={`yearly-allocation-row-${row.name}`}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: row.color }} />
                    <p className="text-[11px] text-ink-2 truncate">{row.name}</p>
                  </div>
                  <p className="text-[11px] tabular-nums text-ink shrink-0">{row.pct}% · {fmt(row.value, true)}</p>
                </div>
                <div className="h-1.5 rounded-pill bg-kosha-border overflow-hidden">
                  <div className="h-full rounded-pill" style={{ width: `${Math.max(5, row.pct)}%`, background: row.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-card border border-dashed border-kosha-border bg-kosha-surface-2 p-3 mb-3">
          <p className="text-[11px] text-ink-3">No yearly vehicle allocation is tagged yet. Add a vehicle label to investment transactions to unlock concentration and diversification insights.</p>
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
    </div>
  )
}
