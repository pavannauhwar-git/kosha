import { motion } from 'framer-motion'
import { fmt } from '../../../lib/utils'
import { C } from '../../../lib/colors'

function getDelta(current, previous) {
  const prev = Number(previous || 0)
  if (prev <= 0) {
    return { pct: null, width: 0, label: 'No baseline' }
  }

  const pct = Math.round(((Number(current || 0) - prev) / prev) * 100)
  return {
    pct,
    width: Math.min(100, Math.max(8, Math.abs(pct))),
    label: `${pct >= 0 ? '+' : ''}${pct}% vs last year`,
  }
}

function deltaClass(delta, inverse = false) {
  if (delta?.pct == null || delta?.pct === 0) return 'text-ink-3'
  const isPositive = delta.pct > 0
  const isGood = inverse ? !isPositive : isPositive
  return isGood ? 'text-income-text' : 'text-expense-text'
}

export default function AnnualSummaryCard({ data, prevData, year }) {
  const totalIncome = data?.totalIncome || 0
  const totalExpense = data?.totalExpense || 0
  const totalInvestment = data?.totalInvestment || 0
  const monthlyRows = Array.isArray(data?.monthly) ? data.monthly : []
  const monthsWithIncome = monthlyRows.filter((m) => Number(m?.income || 0) > 0)
  const avgSurplusRate = monthsWithIncome.length
    ? Math.round(
        monthsWithIncome.reduce((sum, row) => {
          const income = Number(row?.income || 0)
          const outflow = Number(row?.expense || 0) + Number(row?.investment || 0)
          return sum + ((income - outflow) / income) * 100
        }, 0) / monthsWithIncome.length
      )
    : 0
  const annualBalance = totalIncome - totalExpense - totalInvestment
  const previousAnnualBalance = (prevData?.totalIncome || 0) - (prevData?.totalExpense || 0) - (prevData?.totalInvestment || 0)
  const annualBalanceDelta = getDelta(annualBalance, previousAnnualBalance)
  const outflow = totalExpense + totalInvestment

  const spendShare = totalIncome > 0 ? Math.round((totalExpense / totalIncome) * 100) : 0
  const investShare = totalIncome > 0 ? Math.round((totalInvestment / totalIncome) * 100) : 0
  const retainedShare = Math.max(0, 100 - spendShare - investShare)

  const metricCards = [
    {
      label: 'Earned',
      value: totalIncome,
      delta: getDelta(totalIncome, prevData?.totalIncome),
      tone: C.chartIncome,
      inverse: false,
    },
    {
      label: 'Spent',
      value: totalExpense,
      delta: getDelta(totalExpense, prevData?.totalExpense),
      tone: C.chartExpense,
      inverse: true,
    },
    {
      label: 'Invested',
      value: totalInvestment,
      delta: getDelta(totalInvestment, prevData?.totalInvestment),
      tone: C.heroAccentSolid,
      inverse: false,
    },
  ]

  const allocationRows = [
    {
      label: 'Spent share',
      pct: Math.max(0, Math.min(100, spendShare)),
      value: totalExpense,
      color: C.chartExpense,
    },
    {
      label: 'Invested share',
      pct: Math.max(0, Math.min(100, investShare)),
      value: totalInvestment,
      color: C.invest,
    },
    {
      label: 'Retained share',
      pct: Math.max(0, Math.min(100, retainedShare)),
      value: Math.max(0, annualBalance),
      color: C.chartIncome,
    },
  ]

  return (
    <div className="card p-4 md:p-5">
      <div className="flex items-start justify-between gap-3 mb-3.5">
        <div>
          <p className="section-label">Annual summary</p>
          <p className="text-[12px] text-ink-3 mt-0.5">Cashflow and allocation snapshot for {year}</p>
        </div>
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-pill border border-kosha-border bg-kosha-surface-2 text-ink-3">
          {year}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3.5">
        <div className="rounded-card bg-kosha-surface-2 p-2.5 border border-kosha-border">
          <p className="text-[10px] text-ink-3">Year surplus</p>
          <p className={`text-[14px] font-bold tabular-nums ${annualBalance >= 0 ? 'text-income-text' : 'text-expense-text'}`}>
            {annualBalance >= 0 ? '+' : '-'}{fmt(Math.abs(annualBalance))}
          </p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 p-2.5 border border-kosha-border">
          <p className="text-[10px] text-ink-3">Avg surplus</p>
          <p className="text-[14px] font-bold tabular-nums text-ink">{avgSurplusRate}%</p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 p-2.5 border border-kosha-border">
          <p className="text-[10px] text-ink-3">Income</p>
          <p className="text-[14px] font-bold tabular-nums text-income-text">{fmt(totalIncome)}</p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 p-2.5 border border-kosha-border">
          <p className="text-[10px] text-ink-3">Outflow</p>
          <p className="text-[14px] font-bold tabular-nums text-expense-text">{fmt(outflow)}</p>
        </div>
      </div>

      <div className="rounded-card border border-kosha-border bg-kosha-surface-2 p-3 mb-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-semibold text-ink-3">Capital allocation</p>
          <span className={`text-[11px] font-semibold ${deltaClass(annualBalanceDelta, false)}`}>{annualBalanceDelta.label}</span>
        </div>

        <div className="space-y-2.5">
          {allocationRows.map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] text-ink-3">{item.label}</span>
                <span className="text-[10px] font-semibold tabular-nums text-ink">{item.pct}% · {fmt(item.value)}</span>
              </div>
              <div className="h-1.5 rounded-full bg-brand-container/45 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: item.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${item.pct}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {metricCards.map((card) => (
          <div key={card.label} className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] text-ink-3">{card.label}</p>
              <p className={`text-[10px] font-semibold whitespace-nowrap ${deltaClass(card.delta, card.inverse)}`}>
                {card.delta.label}
              </p>
            </div>

            <p className="text-[14px] font-bold text-ink tabular-nums mt-1">{fmt(card.value)}</p>

            <div className="mt-2 h-1.5 rounded-full bg-brand-container/45 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: card.tone }}
                initial={{ width: 0 }}
                animate={{ width: `${card.delta.width}%` }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
