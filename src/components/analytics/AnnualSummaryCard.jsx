import { fmt } from '../../lib/utils'
import { C } from '../../lib/colors'
export default function AnnualSummaryCard({ data, year }) {
  const totalIncome = data?.totalIncome || 0
  const totalExpense = data?.totalExpense || 0
  const totalInvestment = data?.totalInvestment || 0
  const avgSavings = data?.avgSavings || 0
  const annualBalance = totalIncome - totalExpense - totalInvestment

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
        <div className="inline-flex items-center px-2.5 py-1 rounded-pill" style={{ background: C.heroAccentBg }}>
          <span className="text-caption font-semibold" style={{ color: C.heroAccentSolid }}>
            {avgSavings}% avg savings rate
          </span>
        </div>
      </div>

      <div className="border-t mb-4" style={{ borderColor: C.heroDivider }} />

      <div className="mb-3.5 overflow-x-auto no-scrollbar">
        <div className="flex gap-2 min-w-max">
          <div className="min-w-[146px] px-2.5 py-2 rounded-2xl" style={{ background: C.heroStatBg }}>
          <p className="text-[10px] mb-0.5" style={{ color: C.heroLabel }}>Earned</p>
          <p className="text-[12px] font-bold text-white tabular-nums truncate">{fmt(totalIncome)}</p>
          </div>
          <div className="min-w-[146px] px-2.5 py-2 rounded-2xl" style={{ background: C.heroStatBg }}>
          <p className="text-[10px] mb-0.5" style={{ color: C.heroLabel }}>Spent</p>
          <p className="text-[12px] font-bold text-white tabular-nums truncate">{fmt(totalExpense)}</p>
          </div>
          <div className="min-w-[146px] px-2.5 py-2 rounded-2xl" style={{ background: C.heroStatBg }}>
          <p className="text-[10px] mb-0.5" style={{ color: C.heroLabel }}>Invested</p>
          <p className="text-[12px] font-bold text-white tabular-nums truncate">{fmt(totalInvestment)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
