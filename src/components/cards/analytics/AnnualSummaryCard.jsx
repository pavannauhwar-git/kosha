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

function clampPercent(value) {
  return Math.max(0, Math.min(100, Number(value || 0)))
}

function deltaTone(delta, inverse = false) {
  if (delta?.pct == null || delta?.pct === 0) return C.heroDimmer
  const isPositive = delta.pct > 0
  const isGood = inverse ? !isPositive : isPositive
  return isGood ? C.chartIncome : C.chartExpense
}

export default function AnnualSummaryCard({ data, prevData, year }) {
  const totalIncome = data?.totalIncome || 0
  const totalExpense = data?.totalExpense || 0
  const totalInvestment = data?.totalInvestment || 0
  const avgSavings = data?.avgSavings || 0
  const annualBalance = totalIncome - totalExpense - totalInvestment
  const previousAnnualBalance = (prevData?.totalIncome || 0) - (prevData?.totalExpense || 0) - (prevData?.totalInvestment || 0)
  const annualBalanceDelta = getDelta(annualBalance, previousAnnualBalance)

  const spendShare = totalIncome > 0 ? Math.round((totalExpense / totalIncome) * 100) : 0
  const investShare = totalIncome > 0 ? Math.round((totalInvestment / totalIncome) * 100) : 0
  const retainedShare = Math.max(0, 100 - spendShare - investShare)

  const cards = [
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

  const allocation = [
    {
      label: 'Spent share',
      pct: clampPercent(spendShare),
      value: totalExpense,
      color: C.chartExpense,
    },
    {
      label: 'Invested share',
      pct: clampPercent(investShare),
      value: totalInvestment,
      color: C.heroAccentSolid,
    },
    {
      label: 'Retained share',
      pct: clampPercent(retainedShare),
      value: Math.max(0, annualBalance),
      color: C.chartIncome,
    },
  ]

  return (
    <div className="card-hero p-5 md:p-6 relative overflow-hidden">
      <div
        className="absolute -top-14 -right-12 h-44 w-44 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(214,242,74,0.24) 0%, rgba(214,242,74,0) 72%)' }}
      />
      <div
        className="absolute -bottom-20 -left-16 h-56 w-56 rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(78,99,240,0.20) 0%, rgba(78,99,240,0) 74%)' }}
      />

      <div className="relative">
        <div className="flex items-start justify-between gap-3 mb-3.5">
          <div>
            <p className="text-caption font-bold tracking-widest uppercase" style={{ color: C.heroAccent }}>
              Year command deck
            </p>
            <p className="text-[12px] mt-0.5" style={{ color: C.heroLabel }}>
              Cash flow, deployment, and momentum in one frame
            </p>
          </div>
          <span className="text-[11px] font-bold tracking-widest px-2.5 py-1 rounded-pill border border-white/12" style={{ color: C.heroDimmer }}>
            {year}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-4">
          <div className="rounded-2xl border border-white/10 p-3.5" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <p className="text-[11px] font-medium" style={{ color: C.heroLabel }}>
              Annual balance
            </p>
            <p
              className={`font-bold tabular-nums leading-[0.95] tracking-tight mt-1 ${annualBalance >= 0 ? 'text-white' : 'text-[#FFB3AF]'}`}
              style={{ fontSize: 34 }}
            >
              {fmt(annualBalance)}
            </p>

            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-pill border border-white/12" style={{ background: C.heroAccentBg, color: C.heroAccentSolid }}>
                {avgSavings}% avg savings rate
              </span>
              <span className="text-[11px] font-semibold" style={{ color: deltaTone(annualBalanceDelta, false) }}>
                {annualBalanceDelta.label}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 p-3.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <p className="text-[11px] font-semibold mb-2" style={{ color: C.heroLabel }}>
              Capital allocation
            </p>

            <div className="space-y-2.5">
              {allocation.map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px]" style={{ color: C.heroLabel }}>{item.label}</span>
                    <span className="text-[10px] font-semibold tabular-nums text-white">{item.pct}% · {fmt(item.value)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/12 overflow-hidden">
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
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {cards.map((card) => (
            <div key={card.label} className="px-3 py-2.5 rounded-2xl border border-white/10" style={{ background: C.heroStatBg }}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px]" style={{ color: C.heroLabel }}>{card.label}</p>
                <p className="text-[10px] font-semibold whitespace-nowrap" style={{ color: deltaTone(card.delta, card.inverse) }}>
                  {card.delta.label}
                </p>
              </div>

              <p className="text-[14px] font-bold text-white tabular-nums mt-1">{fmt(card.value)}</p>

              <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
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
    </div>
  )
}
