import { motion } from 'framer-motion'
import { fmt } from '../../lib/utils'
import { C } from '../../lib/colors'
import { tr } from 'framer-motion/client'

function getDelta(current, previous) {
  const prev = Number(previous || 0)
  if (prev <= 0) {
    return { pct: null, width: 0, label: 'No prior year' }
  }

  const pct = Math.round(((Number(current || 0) - prev) / prev) * 100)
  return {
    pct,
    width: Math.min(100, Math.max(8, Math.abs(pct))),
    label: `${pct >= 0 ? '+' : ''}${pct}%`,
  }
}

export default function AnnualSummaryCard({ data, prevData, year }) {
  const totalIncome = data?.totalIncome || 0
  const totalExpense = data?.totalExpense || 0
  const totalInvestment = data?.totalInvestment || 0
  const leftover = totalIncome - totalExpense - totalInvestment
  const surplusPct = totalIncome > 0 ? Math.round((leftover / totalIncome) * 100) : 0

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
    <div className="card-hero p-5 md:p-6 relative overflow-hidden">
      <div className="flex items-center justify-between gap-3 mb-3.5">
        <p className="text-caption font-bold tracking-widest uppercase" style={{ color: C.heroAccent }}>
          Year snapshot
        </p>
        <p className="text-caption font-bold tracking-widest" style={{ color: C.heroDimmer }}>
          {year}
        </p>
      </div>

      <p className="text-caption font-medium mb-1" style={{ color: C.heroLabel }}>
        Leftover balance
      </p>
      <p
        className={`font-bold tabular-nums leading-[0.95] tracking-tight ${leftover >= 0 ? 'text-white' : 'text-[#FFB3AF]'}`}
        style={{ fontSize: 38 }}
      >
        {fmt(leftover)}
      </p>

      <div className="mt-2 mb-5 inline-flex items-center px-2.5 py-1 rounded-pill" style={{ background: C.heroAccentBg }}>
        <span className="text-caption font-semibold" style={{ color: C.heroAccentSolid }}>
          {surplusPct}% surplus after expenses &amp; investments
        </span>
      </div>

      <div className="border-t mb-4" style={{ borderColor: C.heroDivider }} />

      <div className="grid grid-cols-3 gap-2 mb-3.5">
        {cards.map((card) => (
          <div key={card.label} className="px-2.5 py-2.5 rounded-2xl min-w-0" style={{ background: C.heroStatBg }}>
            <p className="text-[10px] mb-1" style={{ color: C.heroLabel }}>{card.label}</p>
            <p className="text-[13px] sm:text-[14px] font-bold text-white tabular-nums truncate">
              {fmt(card.value, true)}
            </p>
            <p className="text-[10px] mt-0.5" style={{ color: C.heroLabel }}>
               {card.delta.label}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-1">
        <div className="flex justify-between mb-2">
          <span className="text-caption font-medium" style={{ color: C.heroLabel }}>
            Surplus rate
          </span>
          <span className="text-caption font-bold" style={{ color: C.heroAccentSolid }}>
            {surplusPct}%
          </span>
        </div>
        <div className="bar-dark-track">
          <motion.div
            className="bar-dark-fill"
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(0, surplusPct)}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
        </div>
      </div>
    </div>
  )
}
