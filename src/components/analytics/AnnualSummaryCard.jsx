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

  const metrics = [
    {
      label: 'Earned',
      value: totalIncome,
      delta: getDelta(totalIncome, prevData?.totalIncome),
      color: C.income,
      bg: 'rgba(16,185,129,0.08)',
      borderColor: 'rgba(16,185,129,0.18)',
    },
    {
      label: 'Spent',
      value: totalExpense,
      delta: getDelta(totalExpense, prevData?.totalExpense),
      color: C.expense,
      bg: 'rgba(244,63,94,0.08)',
      borderColor: 'rgba(244,63,94,0.18)',
    },
    {
      label: 'Invested',
      value: totalInvestment,
      delta: getDelta(totalInvestment, prevData?.totalInvestment),
      color: C.invest,
      bg: 'rgba(139,92,246,0.08)',
      borderColor: 'rgba(139,92,246,0.18)',
    },
  ]

  return (
    <div className="space-y-3">
      {/* Main balance card — dark indigo with lime accent */}
      <div
        className="relative overflow-hidden rounded-hero p-5"
        style={{
          background: 'linear-gradient(135deg, #1E1B4B 0%, #312E81 50%, #3730A3 100%)',
          boxShadow: '0 20px 40px -10px rgba(15,23,42,0.25), 0 0 0 1px rgba(99,102,241,0.1)',
        }}
      >
        <div
          className="absolute top-0 right-0 w-40 h-40 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(202,255,4,0.08) 0%, transparent 70%)' }}
        />

        <div className="flex items-center justify-between gap-3 mb-4">
          <p className="text-[11px] font-bold tracking-[0.12em] uppercase" style={{ color: C.lime }}>
            {year} Analytics
          </p>
          <div
            className="px-2.5 py-1 rounded-pill text-[11px] font-semibold"
            style={{ background: 'rgba(202,255,4,0.12)', color: C.lime }}
          >
            {avgSavings}% saved
          </div>
        </div>

        <p className="text-[11px] font-medium mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
          Annual balance
        </p>
        <p
          className="font-bold tabular-nums leading-none tracking-tight"
          style={{ fontSize: 36, color: annualBalance >= 0 ? '#fff' : '#FFB3AF' }}
        >
          {fmt(annualBalance)}
        </p>

        <div className="mt-4">
          <div className="flex justify-between mb-1.5">
            <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Savings rate
            </span>
            <span className="text-[11px] font-bold" style={{ color: C.lime }}>
              {avgSavings}%
            </span>
          </div>
          <div className="h-1.5 rounded-pill w-full relative overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
            <motion.div
              className="h-full rounded-pill absolute inset-y-0 left-0"
              style={{ background: `linear-gradient(90deg, ${C.lime} 0%, ${C.limeMuted} 100%)` }}
              initial={{ width: 0 }}
              animate={{ width: `${avgSavings}%` }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>

      {/* Bento metric cards */}
      <div className="grid grid-cols-3 gap-2.5">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-card p-3 border"
            style={{ background: m.bg, borderColor: m.borderColor }}
          >
            <p className="text-[10px] font-semibold text-ink-3 uppercase tracking-wide mb-1">{m.label}</p>
            <p className="text-[14px] font-bold tabular-nums text-ink leading-tight">{fmt(m.value, true)}</p>
            <p className="text-[10px] mt-1 font-medium" style={{ color: m.color }}>
              {m.delta.label}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
