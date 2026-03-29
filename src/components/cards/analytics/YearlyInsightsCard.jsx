import { Sparkle } from '@phosphor-icons/react'
import { CATEGORIES } from '../../../lib/categories'
import { MONTH_SHORT } from '../../../lib/constants'
import { C } from '../../../lib/colors'
import { fmt } from '../../../lib/utils'

export default function YearlyInsightsCard({ data, catEntries, vehicleData = [] }) {
  if (!data?.monthly?.length && !(data?.totalIncome || data?.totalExpense)) return null

  const safeVehicleData = (Array.isArray(vehicleData) ? vehicleData : [])
    .map(([name, value]) => [name, Number(value || 0)])
    .filter(([, value]) => value > 0)
  const totalPortfolio = safeVehicleData.reduce((sum, [, value]) => sum + value, 0)
  const topVehicle = safeVehicleData[0] || null
  const portfolioRows = safeVehicleData.slice(0, 3).map(([name, value]) => ({
    name,
    value,
    pct: totalPortfolio > 0 ? Math.round((value / totalPortfolio) * 100) : 0,
  }))

  const text = (() => {
    const parts = []
    const inc = data?.totalIncome || 0
    const totalOutflow = (data?.totalExpense || 0) + (data?.totalInvestment || 0)
    const rate = inc > 0 ? Math.round(((inc - totalOutflow) / inc) * 100) : 0

    if (rate > 20) parts.push(`You converted ${rate}% of earnings into yearly surplus after spending and investments.`)
    else if (rate > 0) parts.push(`Your yearly surplus was ${rate}% of income after spending and investments.`)
    else parts.push('Outflow was higher than income this year after including investments.')

    if (data?.monthly) {
      let maxExp = 0
      let maxIdx = -1
      data.monthly.forEach((m, i) => {
        if (m.expense > maxExp) {
          maxExp = m.expense
          maxIdx = i
        }
      })
      if (maxIdx >= 0 && maxExp > 0) parts.push(`${MONTH_SHORT[maxIdx]} was your highest spending month.`)
    }

    if (catEntries?.length > 0) {
      const c = CATEGORIES.find(cat => cat.id === catEntries[0][0])
      const pct = Math.round((catEntries[0][1] / Math.max(data?.totalExpense || 1, 1)) * 100)
      parts.push(`Your biggest expense was ${c ? c.label : catEntries[0][0]}, making up ${pct}% of all spending.`)
    }

    return parts.join(' ')
  })()

  return (
    <div
      className="card p-4 overflow-hidden relative"
      style={{
        background: C.brandContainer,
        border: `1px solid ${C.brandBorder}`,
      }}
    >
      <div className="flex items-center gap-2 mb-2 relative">
        <div className="w-6 h-6 rounded-lg bg-brand flex items-center justify-center shrink-0">
          <Sparkle size={12} className="text-white" weight="fill" />
        </div>
        <h3 className="text-[13px] font-bold text-ink">Year in plain words</h3>
      </div>
      <p className="text-[13px] text-ink-2 leading-relaxed relative">{text}</p>

      <div className="mt-3 rounded-card border border-kosha-border bg-kosha-surface p-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-semibold tracking-wide uppercase text-ink-3">Portfolio snapshot</p>
          <span className="text-[11px] font-semibold tabular-nums text-invest-text">
            {totalPortfolio > 0 ? fmt(totalPortfolio, true) : 'No investments'}
          </span>
        </div>

        {totalPortfolio > 0 ? (
          <>
            {topVehicle && (
              <p className="text-[11px] text-ink-3 mb-2">
                Largest holding: <span className="font-semibold text-ink-2">{topVehicle[0]}</span>
              </p>
            )}

            <div className="space-y-2">
              {portfolioRows.map((row) => (
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
        ) : (
          <p className="text-[11px] text-ink-3">Add investment entries to unlock portfolio concentration and mix insights.</p>
        )}
      </div>
    </div>
  )
}
