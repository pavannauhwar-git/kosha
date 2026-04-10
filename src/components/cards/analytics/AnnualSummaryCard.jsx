import { useState } from 'react'
import { motion } from 'framer-motion'
import { fmt } from '../../../lib/utils'
import { C } from '../../../lib/colors'
import { MONTH_SHORT } from '../../../lib/constants'

function getDelta(current, previous) {
  const prev = Number(previous || 0)
  if (prev <= 0) return { pct: null, label: 'No baseline' }
  const pct = Math.round(((Number(current || 0) - prev) / prev) * 100)
  return { pct, label: `${pct >= 0 ? '+' : ''}${pct}% vs last year` }
}

export default function AnnualSummaryCard({ data, prevData, year }) {
  const totalIncome = data?.totalIncome || 0
  const totalExpense = data?.totalExpense || 0
  const totalInvestment = data?.totalInvestment || 0
  const monthlyRows = Array.isArray(data?.monthly) ? data.monthly : []

  const annualBalance = totalIncome - totalExpense - totalInvestment
  const previousAnnualBalance = (prevData?.totalIncome || 0) - (prevData?.totalExpense || 0) - (prevData?.totalInvestment || 0)
  const balanceDelta = getDelta(annualBalance, previousAnnualBalance)
  const outflow = totalExpense + totalInvestment
  const deploymentRate = totalIncome > 0 ? Math.round((totalInvestment / totalIncome) * 100) : 0

  const monthsWithIncome = monthlyRows.filter((m) => Number(m?.income || 0) > 0)
  const avgSurplusRate = monthsWithIncome.length
    ? Math.round(
        monthsWithIncome.reduce((sum, row) => {
          const income = Number(row?.income || 0)
          const mo = Number(row?.expense || 0) + Number(row?.investment || 0)
          return sum + ((income - mo) / income) * 100
        }, 0) / monthsWithIncome.length
      )
    : 0

  const positiveMonths = monthlyRows.filter((m) => {
    const inc = Number(m?.income || 0)
    const out = Number(m?.expense || 0) + Number(m?.investment || 0)
    return inc - out >= 0
  }).length

  const flowMixBase = annualBalance >= 0 ? Math.max(totalIncome, 1) : Math.max(outflow, 1)
  const flowMixRows = [
    { key: 'expense', label: 'Expenses', value: totalExpense, color: C.chartExpense },
    { key: 'investment', label: 'Investments', value: totalInvestment, color: C.invest },
    annualBalance >= 0
      ? { key: 'surplus', label: 'Surplus', value: Math.max(annualBalance, 0), color: C.chartIncome }
      : { key: 'deficit', label: 'Deficit', value: Math.abs(annualBalance), color: C.bills },
  ].map((row) => ({
    ...row,
    pct: Math.round((Math.max(0, Number(row.value || 0)) / flowMixBase) * 100),
  }))

  // Net per month for sparkline
  const netByMonth = Array.from({ length: 12 }, (_, i) => {
    const m = monthlyRows[i]
    if (!m) return { net: 0, hasData: false }
    const inc = Number(m?.income || 0)
    const exp = Number(m?.expense || 0)
    const inv = Number(m?.investment || 0)
    const hasData = inc > 0 || exp > 0 || inv > 0
    return { net: inc - exp - inv, hasData }
  })
  const netMax = Math.max(...netByMonth.map((m) => Math.abs(m.net)), 1)

  const [hoveredMonth, setHoveredMonth] = useState(null)

  return (
    <div className="card overflow-hidden">
      {/* ── Dark hero header ──────────────────────────────────── */}
      <div className="p-4 pb-5" style={{ background: C.brand }}>
        <div className="flex items-start justify-between gap-3 mb-4">
          <p className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: C.heroLabel }}>Annual command center</p>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-pill tabular-nums" style={{ background: C.heroStatBg, color: C.heroAccent }}>
            {year}
          </span>
        </div>

        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="text-[10px] mb-1" style={{ color: C.heroDimmer }}>Year net surplus</p>
            <p className="text-[22px] font-bold tabular-nums tracking-tight leading-none text-white">
              {annualBalance >= 0 ? '+' : '−'}{fmt(Math.abs(annualBalance))}
            </p>
          </div>
          {balanceDelta.pct !== null && (
            <span
              className="text-[10px] font-semibold px-2 py-1 rounded-pill"
              style={{
                background: balanceDelta.pct >= 0 ? 'rgba(74,170,138,0.18)' : 'rgba(216,74,92,0.18)',
                color: balanceDelta.pct >= 0 ? '#6EDBA7' : '#F59BAA',
              }}
            >
              {balanceDelta.label}
            </span>
          )}
        </div>
      </div>

      <div className="p-4 pt-3">
      {/* ── Supporting KPIs ───────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3 mb-0.5">Avg surplus rate</p>
          <p className="text-[15px] font-semibold tabular-nums text-ink leading-none">{avgSurplusRate}%</p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3 mb-0.5">Deploy rate</p>
          <p className={`text-[15px] font-semibold tabular-nums leading-none ${deploymentRate >= 12 && deploymentRate <= 35 ? 'text-income-text' : 'text-warning-text'}`}>
            {deploymentRate}%
          </p>
        </div>
        <div className="rounded-card bg-kosha-surface-2 p-2.5">
          <p className="text-[10px] text-ink-3 mb-0.5">Positive months</p>
          <p className="text-[15px] font-semibold tabular-nums text-ink leading-none">{positiveMonths}/12</p>
        </div>
      </div>

      {/* ── Flow structure ────────────────────────────────────── */}
      <div className="rounded-card bg-kosha-surface-2 p-3 mb-3">
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <p className="text-[11px] font-semibold text-ink">Flow structure</p>
          <p className="text-[10px] text-ink-3 tabular-nums">Income {fmt(totalIncome)}</p>
        </div>
        <div className="h-2.5 rounded-pill overflow-hidden flex" style={{ background: 'var(--ds-border)' }}>
          {flowMixRows.map((row) => (
            <motion.div
              key={row.key}
              className="h-full first:rounded-l-pill last:rounded-r-pill"
              style={{ background: row.color }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(3, row.pct)}%` }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            />
          ))}
        </div>
        <div className="flex items-center gap-4 mt-2.5 flex-wrap">
          {flowMixRows.map((row) => (
            <div key={`mix-${row.key}`} className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: row.color }} />
              <span className="text-[10px] text-ink-3 tabular-nums">{row.label} {row.pct}%<span className="text-ink-4 ml-1">·</span> {fmt(row.value)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Monthly pulse ─────────────────────────────────────── */}
      <div className="rounded-card bg-kosha-surface-2 p-3">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-[11px] font-semibold text-ink">Monthly surplus pulse</p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.brand }} />
              <span className="text-[9px] text-ink-3">Surplus</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.expense, opacity: 0.65 }} />
              <span className="text-[9px] text-ink-3">Deficit</span>
            </div>
          </div>
        </div>
        <div className="h-5 mb-1">
          {hoveredMonth !== null && netByMonth[hoveredMonth]?.hasData ? (
            <p className="text-[11px] text-ink-2 font-semibold">
              {MONTH_SHORT[hoveredMonth]}:{' '}
              <span className={`tabular-nums ${netByMonth[hoveredMonth].net >= 0 ? 'text-income-text' : 'text-expense-text'}`}>
                {netByMonth[hoveredMonth].net >= 0 ? '+' : '−'}{fmt(Math.abs(netByMonth[hoveredMonth].net))}
              </span>
            </p>
          ) : (
            <p className="text-[10px] text-ink-3">Hover a bar to see monthly net.</p>
          )}
        </div>
        <div className="flex items-end gap-[3px] h-14" onMouseLeave={() => setHoveredMonth(null)}>
          {netByMonth.map((m, i) => {
            if (!m.hasData) {
              return (
                <div key={MONTH_SHORT[i]} className="flex-1 h-full flex flex-col items-center justify-end">
                  <div className="w-full h-[2px] rounded-sm bg-kosha-border" />
                </div>
              )
            }
            const isPositive = m.net >= 0
            const barH = Math.max(8, Math.round((Math.abs(m.net) / netMax) * 100))
            return (
              <div
                key={MONTH_SHORT[i]}
                className="flex-1 h-full flex flex-col items-center justify-end cursor-pointer"
                onMouseEnter={() => setHoveredMonth(i)}
              >
                <motion.div
                  className="w-full rounded-t-sm"
                  style={{
                    background: isPositive ? C.brand : C.expense,
                    opacity: isPositive ? 1 : 0.55,
                  }}
                  initial={{ height: 0 }}
                  animate={{ height: `${barH}%` }}
                  transition={{ duration: 0.4, delay: i * 0.03, ease: [0.22, 1, 0.36, 1] }}
                />
              </div>
            )
          })}
        </div>
        <div className="flex gap-[3px] mt-1.5">
          {netByMonth.map((_, i) => (
            <div key={`ml-${i}`} className="flex-1 text-center">
              <span className="text-[8px] text-ink-4">{MONTH_SHORT[i]}</span>
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  )
}
