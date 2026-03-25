import { TrendingUp, TrendingDown } from 'lucide-react'
import { fmt } from '../../lib/utils'
import { C } from '../../lib/colors'

function TrendPill({ current, previous, label }) {
  if (!previous || previous === 0) return null
  const pct = Math.round(((current - previous) / previous) * 100)
  const up = pct > 0
  if (Math.abs(pct) < 3) return <span className="chip-neutral">~ Stable {label}</span>
  return (
    <span
      className={`text-caption font-semibold px-2.5 py-1 rounded-full
      ${up ? 'bg-expense-bg text-expense-text' : 'bg-income-bg text-income-text'}`}
    >
      {up ? '↑' : '↓'} {Math.abs(pct)}% {label}
    </span>
  )
}

export default function AnnualSummaryCard({ data, prevData, spendTrend, year }) {
  const totalIncome = data?.totalIncome || 0
  const totalExpense = data?.totalExpense || 0
  const totalInvestment = data?.totalInvestment || 0
  const avgSavings = data?.avgSavings || 0
  const annualBalance = totalIncome - totalExpense - totalInvestment

  const incomePct = prevData?.totalIncome > 0
    ? Math.round(((totalIncome - prevData.totalIncome) / prevData.totalIncome) * 100)
    : null

  const expensePct = prevData?.totalExpense > 0
    ? Math.round(((totalExpense - prevData.totalExpense) / prevData.totalExpense) * 100)
    : null

  const investPct = prevData?.totalInvestment > 0
    ? Math.round(((totalInvestment - prevData.totalInvestment) / prevData.totalInvestment) * 100)
    : null

  function YoyBadge({ pct, invertGood = false }) {
    if (pct === null || Math.abs(pct) < 2) return null
    const isGood = invertGood ? pct < 0 : pct > 0
    return (
      <span
        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full
        ${isGood ? 'bg-income-bg text-income-text' : 'bg-expense-bg text-expense-text'}`}
      >
        {pct > 0 ? '↑' : '↓'}{Math.abs(pct)}%
      </span>
    )
  }

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
        Annual balance
      </p>
      <p
        className={`font-bold tabular-nums leading-[0.95] tracking-tight ${annualBalance >= 0 ? 'text-white' : 'text-[#FFB3AF]'}`}
        style={{ fontSize: 38 }}
      >
        {fmt(annualBalance)}
      </p>

      <div className="mt-2 mb-4 flex flex-wrap items-center gap-2">
        {incomePct !== null && Math.abs(incomePct) >= 2 && (
          <div
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-pill text-[10px] font-semibold
            ${incomePct >= 0 ? 'bg-income-bg text-income-text' : 'bg-expense-bg text-expense-text'}`}
          >
            {incomePct >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(incomePct)}% earned vs {year - 1}
          </div>
        )}
        <div className="inline-flex items-center px-2.5 py-1 rounded-pill" style={{ background: C.heroAccentBg }}>
          <span className="text-caption font-semibold" style={{ color: C.heroAccentSolid }}>
            {avgSavings}% avg savings rate
          </span>
        </div>
      </div>

      <div className="border-t mb-4" style={{ borderColor: C.heroDivider }} />

      <div className="grid grid-cols-3 gap-2 mb-3.5">
        <div className="px-2.5 py-2 rounded-2xl" style={{ background: C.heroStatBg }}>
          <p className="text-[10px] mb-0.5" style={{ color: C.heroLabel }}>Earned</p>
          <p className="text-[12px] font-bold text-white tabular-nums truncate">{fmt(totalIncome)}</p>
        </div>
        <div className="px-2.5 py-2 rounded-2xl" style={{ background: C.heroStatBg }}>
          <p className="text-[10px] mb-0.5" style={{ color: C.heroLabel }}>Spent</p>
          <p className="text-[12px] font-bold text-white tabular-nums truncate">{fmt(totalExpense)}</p>
        </div>
        <div className="px-2.5 py-2 rounded-2xl" style={{ background: C.heroStatBg }}>
          <p className="text-[10px] mb-0.5" style={{ color: C.heroLabel }}>Invested</p>
          <p className="text-[12px] font-bold text-white tabular-nums truncate">{fmt(totalInvestment)}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <YoyBadge pct={expensePct} invertGood={true} />
          <YoyBadge pct={investPct} invertGood={false} />
        </div>
        <div className="min-w-0">
          {spendTrend && <TrendPill current={spendTrend.current} previous={spendTrend.previous} label="spend" />}
        </div>
      </div>
    </div>
  )
}
