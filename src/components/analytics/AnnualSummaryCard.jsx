import { motion } from 'framer-motion'
import { fmt } from '../../lib/utils'
import { C } from '../../lib/colors'

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

export default function AnnualSummaryCard({ data, prevData, year }) {
  const totalIncome = data?.totalIncome || 0
  const totalExpense = data?.totalExpense || 0
  const totalInvestment = data?.totalInvestment || 0
  const avgSavings = data?.avgSavings || 0
  const annualBalance = totalIncome - totalExpense - totalInvestment

  const cards = [
    {
      label: 'Earned',
      value: totalIncome,
      delta: getDelta(totalIncome, prevData?.totalIncome),
    },
    {
      label: 'Spent',
      value: totalExpense,
      delta: getDelta(totalExpense, prevData?.totalExpense),
    },
    {
      label: 'Invested',
      value: totalInvestment,
      delta: getDelta(totalInvestment, prevData?.totalInvestment),
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 mb-2">
      <div className="col-span-2 card p-5 flex flex-col items-center justify-center text-center bg-brand-container border border-transparent shadow-none">
        <p className="text-[11px] font-bold tracking-widest uppercase text-brand mb-1">
          {year} Net Growth
        </p>
        <p
          className={`font-bold tabular-nums tracking-tight ${annualBalance >= 0 ? 'text-brand-dark' : 'text-expense-text'}`}
          style={{ fontSize: 36, lineHeight: 1 }}
        >
          {fmt(annualBalance)}
        </p>
        <div className="mt-3 inline-flex items-center px-3 py-1 rounded-pill bg-white/60 text-brand-dark">
          <span className="text-[11px] font-semibold">
            {avgSavings}% average savings rate
          </span>
        </div>
      </div>

      {cards.map((card) => (
        <div key={card.label} className="card p-4">
          <p className="text-[11px] text-ink-3 mb-1">{card.label}</p>
          <p className="text-[18px] font-bold text-ink tabular-nums">{fmt(card.value)}</p>
          <p className={`text-[10px] whitespace-nowrap mt-1 ${card.delta.pct >= 0 ? 'text-income-text' : 'text-expense-text'}`}>
            {card.delta.label}
          </p>
        </div>
      ))}

      <div className="card p-4 flex flex-col justify-center">
        <div className="flex justify-between mb-1.5">
          <span className="text-[11px] font-medium text-ink-3">
            Avg Savings
          </span>
          <span className="text-[11px] font-bold text-brand">
            {avgSavings}%
          </span>
        </div>
        <div className="h-1.5 w-full bg-kosha-surface-2 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-brand"
            initial={{ width: 0 }}
            animate={{ width: `${avgSavings}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
        </div>
      </div>
    </div>
  )
}
