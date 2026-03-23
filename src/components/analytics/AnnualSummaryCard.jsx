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

  const incomePct = prevData?.totalIncome > 0
    ? Math.round(((totalIncome - prevData.totalIncome) / prevData.totalIncome) * 100)
    : null

  const expensePct = prevData?.totalExpense > 0
    ? Math.round(((totalExpense - prevData.totalExpense) / prevData.totalExpense) * 100)
    : null

  const investPct = prevData?.totalInvestment > 0
    ? Math.round(((totalInvestment - prevData.totalInvestment) / prevData.totalInvestment) * 100)
    : null

  const ARC = 52
  const SW = 5
  const R = ARC / 2 - SW
  const CIRC = 2 * Math.PI * R
  const arcFill = Math.max(0, Math.min(avgSavings, 100)) / 100 * CIRC

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
    <div className="card overflow-hidden">
      <div className="px-5 pt-5 pb-4 border-b border-kosha-border">
        <p className="text-caption text-ink-3 font-medium mb-1.5">Total Earned</p>
        <div className="flex items-center justify-between gap-3">
          <p className="font-bold tabular-nums text-income-text" style={{ fontSize: 28, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            {fmt(totalIncome)}
          </p>
          {incomePct !== null && Math.abs(incomePct) >= 2 && (
            <div
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-caption font-semibold shrink-0
              ${incomePct >= 0 ? 'bg-income-bg text-income-text' : 'bg-expense-bg text-expense-text'}`}
            >
              {incomePct >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
              {Math.abs(incomePct)}% vs {year - 1}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 border-b border-kosha-border">
        <div className="px-5 py-4 border-r border-kosha-border">
          <p className="text-caption text-ink-3 mb-1.5">Spent</p>
          <p className="text-value font-bold text-expense-text tabular-nums">{fmt(totalExpense)}</p>
          <div className="mt-1.5">
            <YoyBadge pct={expensePct} invertGood={true} />
          </div>
        </div>
        <div className="px-5 py-4">
          <p className="text-caption text-ink-3 mb-1.5">Invested</p>
          <p className="text-value font-bold text-invest-text tabular-nums">{fmt(totalInvestment)}</p>
          <div className="mt-1.5">
            <YoyBadge pct={investPct} invertGood={false} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 px-5 py-4">
        <div className="relative shrink-0" style={{ width: ARC, height: ARC }}>
          <svg width={ARC} height={ARC} viewBox={`0 0 ${ARC} ${ARC}`}>
            <circle cx={ARC / 2} cy={ARC / 2} r={R} fill="none" stroke={C.brandBorder} strokeWidth={SW} />
            {avgSavings > 0 && (
              <circle
                cx={ARC / 2}
                cy={ARC / 2}
                r={R}
                fill="none"
                stroke={C.brand}
                strokeWidth={SW}
                strokeLinecap="round"
                strokeDasharray={`${arcFill} ${CIRC}`}
                strokeDashoffset={0}
                transform={`rotate(-90 ${ARC / 2} ${ARC / 2})`}
              />
            )}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-bold text-brand" style={{ fontSize: 11 }}>{avgSavings}%</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-label font-semibold text-ink mb-1">Avg Savings Rate</p>
          {spendTrend && <TrendPill current={spendTrend.current} previous={spendTrend.previous} label="spend" />}
        </div>
      </div>
    </div>
  )
}
