import { motion } from 'framer-motion'
import { fmt } from '../../../lib/utils'
import { C } from '../../../lib/colors'
import { MONTH_SHORT } from '../../../lib/constants'
import { transitionEmphasis } from '../../../lib/animations'

function getDelta(current, previous) {
  const prev = Number(previous || 0)
  if (prev <= 0) return { pct: null, label: 'No baseline' }
  const pct = Math.round(((Number(current || 0) - prev) / prev) * 100)
  return { pct, label: `${pct >= 0 ? '+' : ''}${pct}% vs last year` }
}

function compactTick(value) {
  const n = Number(value || 0)
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${Math.round((n / 1_000_000) * 10) / 10}M`
  if (abs >= 1_000) return `${Math.round(n / 1_000)}k`
  return `${Math.round(n)}`
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
      : { key: 'deficit', label: 'Deficit', value: Math.abs(annualBalance), color: C.chartExpense },
  ].map((row) => ({
    ...row,
    pct: Math.round((Math.max(0, Number(row.value || 0)) / flowMixBase) * 100),
  }))

  // Net per month for sparkline
  const netByMonth = monthlyRows.map((m) => {
    const inc = Number(m?.income || 0)
    const exp = Number(m?.expense || 0)
    const inv = Number(m?.investment || 0)
    return inc - exp - inv
  })
  const netMax = Math.max(...netByMonth.map(Math.abs), 1)

  return (
    <div className="card p-4 md:p-5 overflow-hidden">
      {/* Title row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="section-label">Annual command center</p>
          <p className="text-[11px] text-ink-3 mt-0.5">
            {year} balance health, deployment rhythm, and flow structure.
          </p>
        </div>
        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-pill border border-kosha-border bg-kosha-surface-2 text-ink-2">
          {year}
        </span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <div className="mini-panel p-2.5">
          <p className="text-[10px] text-ink-3">Year surplus</p>
          <p className={`text-[14px] font-bold tabular-nums ${annualBalance >= 0 ? 'text-brand' : 'text-warning-text'}`}>
            {annualBalance >= 0 ? '+' : '-'}{fmt(Math.abs(annualBalance))}
          </p>
          {balanceDelta.pct !== null && (
            <p className={`text-[9px] font-semibold mt-0.5 ${balanceDelta.pct >= 0 ? 'text-income-text' : 'text-warning-text'}`}>
              {balanceDelta.label}
            </p>
          )}
        </div>
        <div className="mini-panel p-2.5">
          <p className="text-[10px] text-ink-3">Avg surplus rate</p>
          <p className="text-[14px] font-bold tabular-nums text-ink">{avgSurplusRate}%</p>
        </div>
        <div className="mini-panel p-2.5">
          <p className="text-[10px] text-ink-3">Deploy rate</p>
          <p className={`text-[14px] font-bold tabular-nums ${deploymentRate >= 12 && deploymentRate <= 35 ? 'text-income-text' : 'text-warning-text'}`}>
            {deploymentRate}%
          </p>
        </div>
        <div className="mini-panel p-2.5">
          <p className="text-[10px] text-ink-3">Positive months</p>
          <p className="text-[14px] font-bold tabular-nums text-ink">{positiveMonths}/12</p>
        </div>
      </div>

      {/* Flow structure bar */}
      <div className="mini-panel p-3 mb-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-[11px] font-semibold text-ink-2">Flow structure</p>
          <p className="text-[11px] text-ink-3 tabular-nums">Income {fmt(totalIncome)}</p>
        </div>
        <div className="h-3 rounded-pill bg-kosha-border overflow-hidden border border-kosha-border flex">
          {flowMixRows.map((row, index) => (
            <motion.div
              key={row.key}
              className="h-full"
              style={{ background: row.color }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(4, row.pct)}%` }}
              transition={{ ...transitionEmphasis, delay: index * 0.04 }}
            />
          ))}
        </div>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {flowMixRows.map((row) => (
            <div key={`mix-${row.key}`} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: row.color }} />
              <span className="text-[10px] text-ink-3">{row.label} {row.pct}% · {fmt(row.value)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly net sparkline */}
      <div className="mini-panel p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="text-[11px] font-semibold text-ink-2">Monthly surplus pulse</p>
          <p className="text-[10px] text-ink-3">{positiveMonths} of 12 in surplus</p>
        </div>
        <div className="flex items-end gap-1 h-12">
          {netByMonth.map((net, i) => {
            const isPositive = net >= 0
            const barH = Math.max(6, Math.round((Math.abs(net) / netMax) * 100))
            return (
              <div key={MONTH_SHORT[i]} className="flex-1 h-full flex flex-col items-center justify-end">
                <div
                  className={`w-full rounded-t-sm ${isPositive ? 'bg-brand' : 'bg-expense'}`}
                  style={{ height: `${barH}%`, opacity: isPositive ? 1 : 0.65 }}
                  title={`${MONTH_SHORT[i]}: ${net >= 0 ? '+' : '-'}${fmt(Math.abs(net))}`}
                />
              </div>
            )
          })}
        </div>
        <div className="flex gap-1 mt-1">
          {netByMonth.map((_, i) => (
            <div key={`ml-${i}`} className="flex-1 text-center">
              <span className="text-[8px] text-ink-3">{MONTH_SHORT[i]}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-brand" />
            <span className="text-[10px] text-ink-3">Surplus</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-expense opacity-65" />
            <span className="text-[10px] text-ink-3">Deficit</span>
          </div>
        </div>
      </div>
    </div>
  )
}
