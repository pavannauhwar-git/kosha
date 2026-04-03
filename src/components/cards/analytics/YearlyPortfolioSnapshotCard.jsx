import { C } from '../../../lib/colors'
import { fmt } from '../../../lib/utils'
import { useNavigate } from 'react-router-dom'
import PortfolioMixDonut from '../../common/PortfolioMixDonut'

const BRAND_ALLOCATION_PALETTE = [
  C.brand,
  C.brandMid,
  '#4F97EE',
  C.brandLight,
  '#8EC2F8',
  C.brandBorder,
]

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
    color: BRAND_ALLOCATION_PALETTE[index % BRAND_ALLOCATION_PALETTE.length],
  }))

  if (safeVehicleData.length > 6 && totalPortfolio > visibleTotal) {
    const otherValue = totalPortfolio - visibleTotal
    mixRows.push({
      name: 'Other',
      value: otherValue,
      pct: totalPortfolio > 0 ? Math.round((otherValue / totalPortfolio) * 100) : 0,
      color: C.brandContainer,
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

  const concentrationSignal = totalPortfolio <= 0
    ? 'No allocation yet. Start with one core vehicle and build allocation history.'
    : topHoldingPct >= 55
      ? `${topHolding?.name || 'Top holding'} has ${topHoldingPct}% share. Consider rotating new top-ups.`
      : `Largest position is ${topHoldingPct}%. Concentration is currently controlled.`

  const deploySignal = deploymentRate < 10
    ? `Deployment is ${deploymentRate}% of income. Increase cadence if cash runway allows.`
    : deploymentRate > 35
      ? `Deployment is ${deploymentRate}% of income. Protect runway before increasing investment intensity.`
      : `Deployment at ${deploymentRate}% of income is in a balanced range.`

  const nextAction = (() => {
    if (totalPortfolio <= 0) return 'Log your first investment with a vehicle label to activate allocation intelligence.'
    if (topHoldingPct >= 55 && rebalanceTarget) return `Route the next top-up to ${rebalanceTarget} to reduce concentration.`
    if (safeVehicleData.length < 3) return 'Add one more vehicle category in the next investment to improve diversification.'
    return 'Continue planned monthly top-ups to preserve the current allocation profile.'
  })()

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div>
          <p className="text-label font-semibold text-ink">Yearly portfolio snapshot</p>
          <p className="text-[11px] text-ink-3 mt-0.5">Donut view of allocation, concentration, and deployment quality.</p>
        </div>
        <span className="text-[11px] font-semibold px-2 py-1 rounded-pill bg-brand-container text-brand-on tabular-nums">
          {fmt(totalPortfolio)} · {safeVehicleData.length} v
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="mini-panel p-2.5">
          <p className="text-[10px] text-ink-3">Actual invested</p>
          <p className="text-[13px] font-bold tabular-nums text-invest-text">{fmt(totalInvestment)}</p>
        </div>
        <div className="mini-panel p-2.5">
          <p className="text-[10px] text-ink-3">Tagged allocation</p>
          <p className="text-[13px] font-bold tabular-nums text-invest-text">{fmt(totalPortfolio)}</p>
        </div>
        <div className="mini-panel p-2.5">
          <p className="text-[10px] text-ink-3">Top holding</p>
          <p className={`text-[13px] font-bold tabular-nums ${topHoldingPct >= 55 ? 'text-warning-text' : 'text-brand'}`}>{topHoldingPct}%</p>
        </div>
        <div className="mini-panel p-2.5">
          <p className="text-[10px] text-ink-3">Diversification</p>
          <p className={`text-[13px] font-bold tabular-nums ${diversificationScore >= 70 ? 'text-income-text' : diversificationScore >= 50 ? 'text-brand' : 'text-warning-text'}`}>
            {diversificationScore}/100
          </p>
        </div>
      </div>

      {totalPortfolio > 0 ? (
        <div className="mini-panel p-2.5 mb-3">
          <div className="grid md:grid-cols-[148px_1fr] gap-2.5 items-center">
            <div className="flex justify-center md:justify-start">
              <PortfolioMixDonut
                rows={mixRows}
                centerTop="Yearly"
                centerValue={fmt(totalPortfolio, true)}
                centerBottom={fmt(totalInvestment)}
                ringSize={104}
                innerInset={12}
              />
            </div>

            <div className="space-y-2">
              {mixRows.map((row) => (
                <div key={`yearly-allocation-row-${row.name}`} className="mini-panel px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: row.color }} />
                      <p className="text-[11px] text-ink-2 truncate">{row.name}</p>
                    </div>
                    <p className="text-[11px] tabular-nums text-ink shrink-0" title={fmt(row.value)}>{row.pct}% · {fmt(row.value, true)}</p>
                  </div>
                  <div className="h-1.5 rounded-pill bg-kosha-border overflow-hidden">
                    <div className="h-full rounded-pill" style={{ width: `${Math.max(5, row.pct)}%`, background: row.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
          <div className="mini-panel border-dashed p-3 mb-3">
          <p className="text-[11px] text-ink-3">No yearly vehicle allocation is tagged yet. Add vehicle labels to investment transactions to unlock this view.</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-2 mb-3">
        <div className="mini-panel p-2.5">
          <p className="text-[10px] text-ink-3 mb-1">Concentration signal · {concentrationBand}</p>
          <p className="text-[11px] text-ink-2 leading-relaxed">{concentrationSignal}</p>
        </div>
        <div className="mini-panel p-2.5">
          <p className="text-[10px] text-ink-3 mb-1">Deployment signal</p>
          <p className="text-[11px] text-ink-2 leading-relaxed">{deploySignal}</p>
        </div>
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
