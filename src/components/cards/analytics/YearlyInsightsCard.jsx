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

  const totalIncome = Number(data?.totalIncome || 0)
  const totalExpense = Number(data?.totalExpense || 0)
  const totalInvestment = Number(data?.totalInvestment || 0)
  const annualNet = totalIncome - totalExpense - totalInvestment
  const deployRate = totalIncome > 0 ? Math.round((totalInvestment / totalIncome) * 100) : 0

  const topCategory = (() => {
    if (!catEntries?.length) return null
    const [id, amount] = catEntries[0]
    const label = CATEGORIES.find((cat) => cat.id === id)?.label || id
    const share = totalExpense > 0 ? Math.round((Number(amount || 0) / totalExpense) * 100) : 0
    return { label, amount: Number(amount || 0), share }
  })()

  const bestMonth = (() => {
    const monthlyRows = Array.isArray(data?.monthly) ? data.monthly : []
    if (!monthlyRows.length) return null
    let best = { idx: 0, net: -Infinity }
    monthlyRows.forEach((m, i) => {
      const net = Number(m?.income || 0) - Number(m?.expense || 0) - Number(m?.investment || 0)
      if (net > best.net) best = { idx: i, net }
    })
    return best
  })()

  const plainWords = (() => {
    const parts = []
    const totalOutflow = totalExpense + totalInvestment
    const rate = totalIncome > 0 ? Math.round((annualNet / totalIncome) * 100) : 0

    if (rate > 20) parts.push(`You converted ${rate}% of earnings into surplus.`)
    else if (rate > 0) parts.push(`Year closed with a ${rate}% surplus margin after spending and investments.`)
    else parts.push('Outflow was higher than income this year after including investments.')

    parts.push(
      annualNet >= 0
        ? `Net annual surplus is +${fmt(Math.abs(annualNet))}.`
        : `Net annual deficit is -${fmt(Math.abs(annualNet))}.`
    )

    if (bestMonth && Number.isFinite(bestMonth.net)) {
      parts.push(`${MONTH_SHORT[bestMonth.idx]} delivered the strongest net month at ${bestMonth.net >= 0 ? '+' : '-'}${fmt(Math.abs(bestMonth.net))}.`)
    }

    if (topCategory) {
      parts.push(`Top expense category was ${topCategory.label} at ${fmt(topCategory.amount)} (${topCategory.share}% of spend).`)
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
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div>
          <p className="text-label font-semibold text-ink">Strategic insights</p>
          <p className="text-[11px] text-ink-3 mt-0.5">Actionable yearly readout for {year}: impact, signals, and concrete next moves.</p>
        </div>
        <span className="text-[10px] px-2 py-1 rounded-pill font-semibold bg-kosha-surface-2 text-ink-2">
          {insightCount} insight{insightCount === 1 ? '' : 's'}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2.5">
        <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
          <p className="text-[10px] text-ink-3">Annual net</p>
          <p className={`text-[12px] font-bold tabular-nums ${annualNet >= 0 ? 'text-income-text' : 'text-expense-text'}`}>
            {annualNet >= 0 ? '+' : '-'}{fmt(Math.abs(annualNet), true)}
          </p>
        </div>
        <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
          <p className="text-[10px] text-ink-3">Invested</p>
          <p className="text-[12px] font-bold tabular-nums text-invest-text">{fmt(totalInvestment, true)}</p>
        </div>
        <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
          <p className="text-[10px] text-ink-3">Deploy rate</p>
          <p className={`text-[12px] font-bold tabular-nums ${deployRate >= 12 && deployRate <= 35 ? 'text-income-text' : 'text-warning-text'}`}>{deployRate}%</p>
        </div>
        <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
          <p className="text-[10px] text-ink-3">Top category</p>
          <p className="text-[11px] font-bold text-brand truncate" title={topCategory?.label || '—'}>{topCategory?.label || '—'}</p>
          <p className="text-[10px] tabular-nums text-ink-3 mt-0.5">{topCategory ? `${fmt(topCategory.amount, true)} · ${topCategory.share}%` : '—'}</p>
        </div>
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
