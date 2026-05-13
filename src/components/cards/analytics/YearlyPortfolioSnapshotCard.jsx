import { C } from '../../../lib/colors'
import { fmt } from '../../../lib/utils'
import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import PortfolioMixDonut from '../../common/PortfolioMixDonut'
import Button from '../../ui/Button'

/**
 * Reads the .dark class on <html> to pick the right palette variant.
 * Updates reactively when the class changes (e.g. user toggles theme).
 */
function useDarkPalette() {
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  )
  useEffect(() => {
    const el  = document.documentElement
    const obs = new MutationObserver(() =>
      setIsDark(el.classList.contains('dark'))
    )
    obs.observe(el, { attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return isDark ? C.portfolioDark : C.portfolio
}

export default function YearlyPortfolioSnapshotCard({ data, vehicleData = [], isViewingPartner }) {
  const navigate = useNavigate()
  const PALETTE  = useDarkPalette()

  /* ── Derived data ──────────────────────────────────────────────────── */
  const safeVehicleData = (Array.isArray(vehicleData) ? vehicleData : [])
    .map(([name, value]) => ({ name, value: Number(value || 0) }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value)

  const totalPortfolio  = safeVehicleData.reduce((sum, row) => sum + row.value, 0)
  const topHolding      = safeVehicleData[0] || null
  const topHoldingPct   = topHolding && totalPortfolio > 0
    ? Math.round((topHolding.value / totalPortfolio) * 100)
    : 0
  const topThreePct     = totalPortfolio > 0
    ? Math.round(safeVehicleData.slice(0, 3).reduce((s, r) => s + r.value, 0) / totalPortfolio * 100)
    : 0

  const totalIncome     = Number(data?.totalIncome   || 0)
  const totalInvestment = Number(data?.totalInvestment || 0)
  const deploymentRate  = totalIncome > 0 ? Math.round((totalInvestment / totalIncome) * 100) : 0

  const diversificationScore = totalPortfolio > 0
    ? Math.max(0, Math.min(100, Math.round((safeVehicleData.length * 16) + (58 - Math.max(0, topHoldingPct - 45)))))
    : 0

  /* ── Donut rows ────────────────────────────────────────────────────── */
  const visibleRows = safeVehicleData.slice(0, 5)
  const visibleTotal = visibleRows.reduce((s, r) => s + r.value, 0)
  const mixRows = visibleRows.map((row, i) => ({
    ...row,
    pct: totalPortfolio > 0 ? Math.round((row.value / totalPortfolio) * 100) : 0,
    color: PALETTE[i % PALETTE.length],
  }))

  if (safeVehicleData.length > 5 && totalPortfolio > visibleTotal) {
    const otherValue = totalPortfolio - visibleTotal
    mixRows.push({
      name: 'Other',
      value: otherValue,
      pct: totalPortfolio > 0 ? Math.round((otherValue / totalPortfolio) * 100) : 0,
      color: PALETTE[PALETTE.length - 1],
    })
  }

  /* ── Signal text ───────────────────────────────────────────────────── */
  const concentrationBand = topHoldingPct >= 60 ? 'high' : topHoldingPct >= 45 ? 'watch' : 'ok'
  const concentrationLabel = concentrationBand === 'high'
    ? 'High concentration'
    : concentrationBand === 'watch'
      ? 'Moderate concentration'
      : 'Well balanced'

  const deployBand = deploymentRate < 10 ? 'low' : deploymentRate > 35 ? 'high' : 'ok'
  const deployLabel = deployBand === 'low'
    ? 'Conservative deployment'
    : deployBand === 'high'
      ? 'Aggressive deployment'
      : 'Healthy deployment'

  const nextAction = (() => {
    if (totalPortfolio <= 0)          return 'Log your first investment with a vehicle label.'
    if (safeVehicleData.length < 3)   return 'Add one more vehicle type for better diversification.'
    if (topHoldingPct >= 55 && safeVehicleData[1]) return `Route the next top-up to ${safeVehicleData[1].name}.`
    return 'Continue planned top-ups to preserve allocation discipline.'
  })()

  /* ── Colour helpers ────────────────────────────────────────────────── */
  const divScore = diversificationScore >= 70 ? 'text-income-text'
    : diversificationScore >= 50 ? 'text-ink-2'
      : 'text-warning-text'
  const concColor  = concentrationBand === 'ok'   ? 'text-income-text' : 'text-warning-text'
  const deployColor = deployBand === 'ok'          ? 'text-income-text' : 'text-warning-text'

  return (
    <div className="card p-4 border-0">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="section-label">Portfolio snapshot</p>
          <p className="text-[11px] text-ink-3 mt-0.5">
            Yearly allocation mix, concentration &amp; deployment.
          </p>
        </div>
        <span className="text-[10px] px-2.5 py-1 rounded-pill font-semibold bg-kosha-surface-2 text-ink-2 border border-kosha-border tabular-nums shrink-0">
          {safeVehicleData.length} vehicle{safeVehicleData.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── 2×2 Metric grid ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="mini-panel px-3 py-2.5">
          <p className="text-[10px] text-ink-3 uppercase tracking-wide">Invested</p>
          <p className="text-[13px] font-semibold tabular-nums text-invest-text mt-1">{fmt(totalPortfolio)}</p>
        </div>
        <div className="mini-panel px-3 py-2.5">
          <p className="text-[10px] text-ink-3 uppercase tracking-wide">Deployment</p>
          <p className={`text-[13px] font-semibold tabular-nums mt-1 ${deployColor}`}>{deploymentRate}%</p>
        </div>
        <div className="mini-panel px-3 py-2.5">
          <p className="text-[10px] text-ink-3 uppercase tracking-wide">Top holding</p>
          <p className={`text-[13px] font-semibold tabular-nums mt-1 ${topHoldingPct >= 55 ? 'text-warning-text' : 'text-ink'}`}>
            {topHoldingPct}%
          </p>
        </div>
        <div className="mini-panel px-3 py-2.5">
          <p className="text-[10px] text-ink-3 uppercase tracking-wide">Diversify</p>
          <p className={`text-[13px] font-semibold tabular-nums mt-1 ${divScore}`}>{diversificationScore}/100</p>
        </div>
      </div>

      {/* ── Donut + insight panel ───────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-[140px,1fr] gap-3 mb-3 items-center">
        <div className="flex justify-center sm:justify-start">
          <PortfolioMixDonut
            rows={mixRows}
            centerTop="Yearly"
            centerValue={fmt(totalPortfolio)}
            centerBottom={`${safeVehicleData.length} vehicle${safeVehicleData.length !== 1 ? 's' : ''}`}
            ringSize={120}
            innerInset={10}
          />
        </div>

        <div className="mini-panel p-3 flex flex-col gap-2">
          {/* Concentration signal */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] text-ink-3">Allocation health</p>
              <p className={`text-[10px] font-semibold ${concColor}`}>{concentrationLabel}</p>
            </div>
            <p className="text-[11px] text-ink-2 mt-0.5 leading-relaxed">
              {totalPortfolio <= 0
                ? 'Add labeled investments to start tracking.'
                : topHoldingPct >= 55
                  ? `${topHolding?.name || 'Top holding'} is ${topHoldingPct}% of your yearly allocation.`
                  : `Largest holding is ${topHoldingPct}%. Concentration is under control.`}
            </p>
          </div>
          {/* Divider */}
          <div className="border-t border-kosha-border" />
          {/* Deployment signal */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] text-ink-3">Deployment</p>
              <p className={`text-[10px] font-semibold ${deployColor}`}>{deployLabel}</p>
            </div>
            <p className="text-[11px] text-ink-2 mt-0.5 leading-relaxed">
              {deploymentRate}% of income directed to investments this year.
            </p>
          </div>
        </div>
      </div>

      {/* ── Allocation breakdown ────────────────────────────────────── */}
      <div className="rounded-card border border-kosha-border bg-kosha-surface-2 overflow-hidden mb-3">
        {totalPortfolio > 0 ? (
          <>
            {mixRows.map((row, index) => (
              <div
                key={`yearly-row-${row.name}`}
                className={`px-3 py-2.5 ${index !== mixRows.length - 1 ? 'border-b border-kosha-border' : ''}`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ background: row.color }}
                    />
                    <p className="text-[11px] font-medium text-ink-2 truncate">{row.name}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className="text-[10px] text-ink-3 tabular-nums">{fmt(row.value)}</p>
                    <p
                      className="text-[11px] font-semibold tabular-nums text-ink"
                      style={{ minWidth: '3ch', textAlign: 'right' }}
                    >
                      {row.pct}%
                    </p>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="h-2 rounded-pill overflow-hidden" style={{ background: 'var(--ds-border)' }}>
                  <div
                    className="h-full rounded-pill"
                    style={{
                      width: `${Math.max(3, row.pct)}%`,
                      background: row.color,
                      transition: 'width 600ms cubic-bezier(0.05,0.7,0.1,1)',
                    }}
                  />
                </div>
              </div>
            ))}
          </>
        ) : (
          <div className="p-3 m-2 border border-dashed border-kosha-border bg-kosha-surface rounded-card">
            <p className="text-[11px] text-ink-3">
              No vehicle tags yet. Add vehicle labels to investment entries to unlock allocation tracking.
            </p>
          </div>
        )}
      </div>

      {/* ── Next action signal ──────────────────────────────────────── */}
      <div className="mini-panel p-3 mb-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] text-ink-3">Next move</p>
          <p className={`text-[10px] font-semibold tabular-nums ${topHoldingPct >= 55 ? 'text-warning-text' : 'text-income-text'}`}>
            Top 3 · {topThreePct}%
          </p>
        </div>
        <p className="text-[11px] text-ink-2 mt-1.5 leading-relaxed">{nextAction}</p>
      </div>

      {/* ── Footer action ───────────────────────────────────────────── */}
      {!isViewingPartner && (
        <div className="pt-2 border-t border-kosha-border flex items-center justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => navigate('/transactions', { state: { openAddInvestment: true } })}
            className="shrink-0"
          >
            Log investment
          </Button>
        </div>
      )}
    </div>
  )
}
