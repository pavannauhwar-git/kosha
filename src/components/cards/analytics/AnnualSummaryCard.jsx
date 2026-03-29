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

function scaledWidth(value, maxValue) {
  if (maxValue <= 0) return 8
  return Math.max(8, Math.round((Math.abs(Number(value || 0)) / maxValue) * 100))
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

  const comparisonRows = [
    {
      label: 'Income',
      current: totalIncome,
      previous: Number(prevData?.totalIncome || 0),
      color: C.brand,
      delta: getDelta(totalIncome, prevData?.totalIncome),
      deltaTone: 'text-brand',
    },
    {
      label: 'Expenses',
      current: totalExpense,
      previous: Number(prevData?.totalExpense || 0),
      color: C.chartExpense,
      delta: getDelta(totalExpense, prevData?.totalExpense),
      deltaTone: 'text-expense-text',
    },
    {
      label: 'Investments',
      current: totalInvestment,
      previous: Number(prevData?.totalInvestment || 0),
      color: C.invest,
      delta: getDelta(totalInvestment, prevData?.totalInvestment),
      deltaTone: 'text-invest-text',
    },
    {
      label: 'Surplus',
      current: annualBalance,
      previous: previousAnnualBalance,
      color: C.brandMid,
      delta: annualBalanceDelta,
      deltaTone: annualBalance >= 0 ? 'text-brand' : 'text-warning-text',
    },
  ]

  const maxComparisonValue = comparisonRows.reduce(
    (max, row) => Math.max(max, Math.abs(row.current), Math.abs(row.previous)),
    1
  )

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
          <p className={`text-[14px] font-bold tabular-nums ${annualBalance >= 0 ? 'text-brand' : 'text-warning-text'}`}>
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
          <p className="text-[11px] font-semibold text-ink-3">Year over year comparison</p>
          <span className={`text-[11px] font-semibold ${annualBalance >= 0 ? 'text-brand' : 'text-warning-text'}`}>{annualBalanceDelta.label}</span>
        </div>

        <div className="space-y-2.5">
          {comparisonRows.map((row) => (
            <div key={row.label} className="rounded-card bg-kosha-surface p-2.5 border border-kosha-border">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[10px] text-ink-3 font-semibold">{row.label}</span>
                <span className={`text-[10px] font-semibold tabular-nums ${row.deltaTone}`}>{row.delta.label}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-ink-3 mb-1">This year · {fmt(row.current)}</p>
                  <div className="h-1.5 rounded-full bg-brand-container/40 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: row.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${scaledWidth(row.current, maxComparisonValue)}%` }}
                      transition={{ duration: 0.55, ease: 'easeOut' }}
                    />
                  </div>
                </div>

                <div>
                  <p className="text-[10px] text-ink-3 mb-1">Last year · {fmt(row.previous)}</p>
                  <div className="h-1.5 rounded-full bg-brand-container/40 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full opacity-55"
                      style={{ background: row.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${scaledWidth(row.previous, maxComparisonValue)}%` }}
                      transition={{ duration: 0.55, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-ink-3">Surplus and allocation are shown as comparisons so trend shifts are easier to decide on than raw totals alone.</p>
    </div>
  )
}
