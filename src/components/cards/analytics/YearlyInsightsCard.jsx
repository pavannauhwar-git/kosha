import { CATEGORIES } from '../../../lib/categories'
import { MONTH_SHORT } from '../../../lib/constants'
import { fmt } from '../../../lib/utils'

export default function YearlyInsightsCard({
  data,
  catEntries,
  year,
  strategicRecommendations = [],
  decisionSignals = [],
}) {
  if (!data?.monthly?.length && !(data?.totalIncome || data?.totalExpense)) return null

  const plainWords = (() => {
    const parts = []
    const inc = Number(data?.totalIncome || 0)
    const totalOutflow = Number(data?.totalExpense || 0) + Number(data?.totalInvestment || 0)
    const annualSurplus = inc - totalOutflow
    const rate = inc > 0 ? Math.round(((inc - totalOutflow) / inc) * 100) : 0

    if (rate > 20) parts.push(`You converted ${rate}% of earnings into annual surplus.`)
    else if (rate > 0) parts.push(`Year closed with a ${rate}% surplus margin after spending and investments.`)
    else parts.push('Outflow was higher than income this year after including investments.')

    parts.push(
      annualSurplus >= 0
        ? `Net annual surplus is +${fmt(Math.abs(annualSurplus))}.`
        : `Net annual deficit is -${fmt(Math.abs(annualSurplus))}.`
    )

    if (data?.monthly) {
      let maxExp = 0
      let maxIdx = -1
      data.monthly.forEach((m, i) => {
        if (m.expense > maxExp) {
          maxExp = m.expense
          maxIdx = i
        }
      })
      if (maxIdx >= 0 && maxExp > 0) parts.push(`${MONTH_SHORT[maxIdx]} was the highest burn month.`)
    }

    if (catEntries?.length > 0) {
      const c = CATEGORIES.find(cat => cat.id === catEntries[0][0])
      const pct = Math.round((catEntries[0][1] / Math.max(data?.totalExpense || 1, 1)) * 100)
      parts.push(`Top expense branch was ${c ? c.label : catEntries[0][0]} (${pct}% of yearly spend).`)
    }

    return parts.join(' ')
  })()

  const signalRows = decisionSignals.length > 0
    ? decisionSignals.slice(0, 4)
    : ['Not enough trend data for structured decision signals yet.']

  const actionRows = strategicRecommendations.length > 0
    ? strategicRecommendations.slice(0, 3)
    : ['Keep a weekly review cadence and route any surplus intentionally.']

  const insightCount = signalRows.length + actionRows.length

  return (
    <div className="card p-4 border-0">
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div>
          <p className="text-label font-semibold text-ink">Strategic insights</p>
          <p className="text-[11px] text-ink-3 mt-0.5">Year in plain words, decision signals, and next actions for {year}.</p>
        </div>
        <span className="text-[10px] px-2 py-1 rounded-pill font-semibold bg-kosha-surface-2 text-ink-2">
          {insightCount} insight{insightCount === 1 ? '' : 's'}
        </span>
      </div>

      <div className="rounded-card border border-kosha-border bg-kosha-surface-2 p-2.5 mb-2.5">
        <p className="text-[11px] font-semibold text-ink-2 mb-1">Year in plain words</p>
        <p className="text-[12px] text-ink-2 leading-relaxed">{plainWords}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-2.5">
        <div className="rounded-card border border-kosha-border bg-kosha-surface-2 p-2.5">
          <p className="text-[11px] font-semibold text-ink-2 mb-1.5">Decision signals</p>
          <div className="space-y-1.5">
            {signalRows.map((line, index) => (
              <div key={`insight-signal-${index}`} className="flex items-start gap-2">
                <span className="w-4 text-right text-[11px] font-bold text-brand shrink-0">{index + 1}</span>
                <p className="text-[11px] text-ink-3 leading-relaxed">{line}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-card border border-kosha-border bg-kosha-surface-2 p-2.5">
          <p className="text-[11px] font-semibold text-ink-2 mb-1.5">So what now</p>
          <div className="space-y-1.5">
            {actionRows.map((line, index) => (
              <div key={`insight-action-${index}`} className="flex items-start gap-2">
                <span className="w-4 text-right text-[11px] font-bold text-brand shrink-0">{index + 1}</span>
                <p className="text-[11px] text-ink-3 leading-relaxed">{line}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
