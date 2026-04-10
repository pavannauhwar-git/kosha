import { C } from '../../../lib/colors'
import { fmt } from '../../../lib/utils'
import { useNavigate } from 'react-router-dom'
import PortfolioMixDonut from '../../common/PortfolioMixDonut'
import Button from '../../ui/Button'

const ALLOCATION_PALETTE = C.portfolio

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

  const visibleRows = safeVehicleData.slice(0, 5)
  const visibleTotal = visibleRows.reduce((sum, row) => sum + row.value, 0)
  const mixRows = visibleRows.map((row, index) => ({
    ...row,
    pct: totalPortfolio > 0 ? Math.round((row.value / totalPortfolio) * 100) : 0,
    color: ALLOCATION_PALETTE[index % ALLOCATION_PALETTE.length],
  }))

  if (safeVehicleData.length > 5 && totalPortfolio > visibleTotal) {
    const otherValue = totalPortfolio - visibleTotal
    mixRows.push({
      name: 'Other',
      value: otherValue,
      pct: totalPortfolio > 0 ? Math.round((otherValue / totalPortfolio) * 100) : 0,
      color: C.brandBorder,
    })
  }

  const diversificationScore = totalPortfolio > 0
    ? Math.max(0, Math.min(100, Math.round((safeVehicleData.length * 16) + (58 - Math.max(0, topHoldingPct - 45)))))
    : 0

  const concentrationLabel = topHoldingPct >= 60
    ? 'High concentration'
    : topHoldingPct >= 45
      ? 'Moderate concentration'
      : 'Balanced concentration'

  const concentrationHint = totalPortfolio <= 0
    ? 'Add your first labeled investment to start allocation tracking.'
    : topHoldingPct >= 55
      ? `${topHolding?.name || 'Top holding'} is ${topHoldingPct}% of your yearly allocation.`
      : `Largest holding is ${topHoldingPct}%. Concentration is under control.`

  const deploymentHint = deploymentRate < 10
    ? `Deployment at ${deploymentRate}% is conservative.`
    : deploymentRate > 35
      ? `Deployment at ${deploymentRate}% is aggressive.`
      : `Deployment at ${deploymentRate}% is balanced.`

  const nextAction = (() => {
    if (totalPortfolio <= 0) return 'Log your first investment with a vehicle label.'
    if (safeVehicleData.length < 3) return 'Add one more vehicle type for better diversification.'
    if (topHoldingPct >= 55 && safeVehicleData[1]) return `Route the next top-up to ${safeVehicleData[1].name}.`
    return 'Continue planned top-ups to preserve allocation discipline.'
  })()

  return (
    <div className="card p-4 border-0">
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div>
          <p className="text-label font-semibold text-ink">Portfolio snapshot</p>
          <p className="text-[11px] text-ink-3 mt-0.5">Allocation mix and concentration for this year.</p>
        </div>
        <span className="text-[10px] px-2 py-1 rounded-pill font-semibold bg-ink/[0.06] text-ink tabular-nums">
          {safeVehicleData.length} vehicles
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">Total invested</p>
          <p className="text-[13px] font-semibold tabular-nums text-invest-text">{fmt(totalPortfolio)}</p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">Top holding</p>
          <p className={`text-[13px] font-semibold tabular-nums ${topHoldingPct >= 55 ? 'text-warning-text' : 'text-ink'}`}>
            {topHoldingPct}%
          </p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">Deploy rate</p>
          <p className={`text-[13px] font-semibold tabular-nums ${deploymentRate >= 12 && deploymentRate <= 35 ? 'text-income-text' : 'text-warning-text'}`}>
            {deploymentRate}%
          </p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3">Diversification</p>
          <p className={`text-[13px] font-semibold tabular-nums ${diversificationScore >= 70 ? 'text-income-text' : diversificationScore >= 50 ? 'text-ink' : 'text-warning-text'}`}>
            {diversificationScore}/100
          </p>
        </div>
      </div>

      <div className="rounded-card bg-kosha-surface-2 p-3 mb-3">
        {totalPortfolio > 0 ? (
          <div className="space-y-3">
            <div className="flex justify-center">
              <PortfolioMixDonut
                rows={mixRows}
                centerTop="Yearly"
                centerValue={fmt(totalPortfolio)}
                centerBottom={`${safeVehicleData.length} vehicles`}
                ringSize={112}
                innerInset={9}
              />
            </div>

            <div className="space-y-2">
              {mixRows.map((row) => (
                <div key={`yearly-allocation-row-${row.name}`} className="rounded-card border border-kosha-border bg-kosha-surface px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: row.color }} />
                      <p className="text-[11px] text-ink-2 truncate">{row.name}</p>
                    </div>
                    <p className="text-[11px] tabular-nums text-ink shrink-0" title={fmt(row.value)}>
                      {row.pct}% · {fmt(row.value)}
                    </p>
                  </div>
                  <div className="h-1.5 rounded-pill bg-kosha-border overflow-hidden">
                    <div className="h-full rounded-pill" style={{ width: `${Math.max(6, row.pct)}%`, background: row.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-card border border-dashed border-kosha-border bg-kosha-surface p-3">
            <p className="text-[11px] text-ink-3">
              No yearly vehicle allocation is tagged yet. Add vehicle labels to investment entries to unlock this view.
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 mb-3">
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3 mb-1">{concentrationLabel}</p>
          <p className="text-[11px] text-ink-2 leading-relaxed">{concentrationHint}</p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3 mb-1">Deployment signal</p>
          <p className="text-[11px] text-ink-2 leading-relaxed">{deploymentHint}</p>
        </div>
      </div>

      <div className="pt-2 border-t border-kosha-border flex items-center justify-between gap-2">
        <p className="text-[11px] text-ink-3 flex-1 leading-relaxed">{nextAction}</p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate('/transactions', { state: { openAddInvestment: true } })}
          className="shrink-0"
        >
          Log investment
        </Button>
      </div>
    </div>
  )
}
