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
    <div className="card-hero oneui-sheet-radius p-5 md:p-6 relative overflow-hidden shadow-glass">
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
        <div className="inline-flex items-center px-2.5 py-1 rounded-pill" style={{ background: C.heroAccentBg }}>
          <span className="text-caption font-semibold" style={{ color: C.heroAccentSolid }}>
            {avgSavings}% avg savings rate
          </span>
        </div>
      </div>

      <div className="border-t mb-4" style={{ borderColor: C.heroDivider }} />

      <div className="mb-3.5 space-y-2">
        {cards.map((card) => (
          <div key={card.label} className="px-3 py-2.5 rounded-[20px] border border-white/15" style={{ background: C.heroStatBg }}>
            <p className="text-[10px] mb-0.5" style={{ color: C.heroLabel }}>{card.label}</p>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12px] font-bold text-white tabular-nums">{fmt(card.value)}</p>
              <p className="text-[10px] whitespace-nowrap" style={{ color: C.heroLabel }}>
                {card.delta.label}
              </p>
            </div>

            <div className="mt-2 h-1.5 rounded-full bg-white/20 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${card.delta.width}%`,
                  background: C.heroAccentSolid,
                  transition: 'width 280ms ease-out',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
