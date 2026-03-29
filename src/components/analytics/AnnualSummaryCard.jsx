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

const STAT_COLORS = {
  Earned:   { accent: C.income,  bg: 'rgba(14,159,110,0.08)', border: 'rgba(14,159,110,0.14)' },
  Spent:    { accent: C.expense, bg: 'rgba(232,54,78,0.06)',  border: 'rgba(232,54,78,0.12)' },
  Invested: { accent: C.invest,  bg: 'rgba(124,58,237,0.06)', border: 'rgba(124,58,237,0.12)' },
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
    <div className="card p-4 md:p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-caption font-bold tracking-widest uppercase text-ink-3">
          Year snapshot
        </p>
        <p className="text-caption font-bold tracking-widest text-ink-4">
          {year}
        </p>
      </div>

      <p className="text-caption font-medium mb-1 text-ink-3">
        Annual balance
      </p>
      <p
        className="font-bold tabular-nums leading-[0.95] tracking-tight"
        style={{ fontSize: 38, color: annualBalance >= 0 ? C.accent : C.expense }}
      >
        {fmt(annualBalance)}
      </p>

      <div className="mt-2 mb-4 inline-flex items-center px-2.5 py-1 rounded-pill"
        style={{ background: 'rgba(99,91,255,0.08)' }}
      >
        <span className="text-caption font-semibold" style={{ color: C.brand }}>
          {avgSavings}% avg savings rate
        </span>
      </div>

      <div className="border-t border-kosha-border mb-3" />

      <div className="grid grid-cols-3 gap-2 mb-3">
        {cards.map((card) => {
          const sc = STAT_COLORS[card.label]
          return (
            <div key={card.label}
              className="px-3 py-3 rounded-2xl"
              style={{ background: sc.bg, border: `1px solid ${sc.border}` }}
            >
              <p className="text-[10px] mb-1 text-ink-3 font-medium">{card.label}</p>
              <p className="text-[12px] sm:text-[13px] font-bold tabular-nums truncate"
                style={{ color: sc.accent }}
              >
                {fmt(card.value)}
              </p>
              <p className="text-[10px] mt-1 text-ink-4 truncate">
                {card.delta.label}
              </p>
            </div>
          )
        })}
      </div>

      <div>
        <div className="flex justify-between mb-2">
          <span className="text-caption font-medium text-ink-3">
            Savings rate
          </span>
          <span className="text-caption font-bold" style={{ color: C.brand }}>
            {avgSavings}%
          </span>
        </div>
        <div className="h-2 rounded-pill overflow-hidden" style={{ background: 'rgba(0,0,0,0.06)' }}>
          <motion.div
            className="h-full rounded-pill"
            style={{ background: `linear-gradient(90deg, ${C.brand}, ${C.brandMid})` }}
            initial={{ width: 0 }}
            animate={{ width: `${avgSavings}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
        </div>
      </div>
    </div>
  )
}
