import { motion } from 'framer-motion'
import { fmt } from '../../../lib/utils'
import { C } from '../../../lib/colors'
import { MONTH_SHORT } from '../../../lib/constants'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
} from 'recharts'

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

function scaledWidth(value, maxValue) {
  if (maxValue <= 0) return 8
  return Math.max(8, Math.round((Math.abs(Number(value || 0)) / maxValue) * 100))
}

function compactTick(value) {
  const n = Number(value || 0)
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${Math.round((n / 1_000_000) * 10) / 10}M`
  if (abs >= 1_000) return `${Math.round(n / 1_000)}k`
  return `${Math.round(n)}`
}

function NetPulseTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload || {}
  const net = Number(row?.net || 0)

  return (
    <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5 shadow-card min-w-[176px]">
      <p className="text-[11px] font-semibold text-ink mb-1">{label}</p>
      <div className="space-y-0.5 text-[11px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-3">Income</span>
          <span className="font-semibold tabular-nums text-income-text">{fmt(Number(row?.income || 0))}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-3">Outflow</span>
          <span className="font-semibold tabular-nums text-expense-text">{fmt(Number(row?.outflow || 0))}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-3">Net</span>
          <span className={`font-semibold tabular-nums ${net >= 0 ? 'text-income-text' : 'text-warning-text'}`}>
            {net >= 0 ? '+' : '-'}{fmt(Math.abs(net))}
          </span>
        </div>
      </div>
    </div>
  )
}

function deltaTone(pct, prefersDecrease = false) {
  if (pct === null || !Number.isFinite(pct)) return 'text-ink-3'
  const healthy = prefersDecrease ? pct <= 0 : pct >= 0
  return healthy ? 'text-income-text' : 'text-warning-text'
}

export default function AnnualSummaryCard({ data, prevData, year }) {
  const totalIncome = data?.totalIncome || 0
  const totalExpense = data?.totalExpense || 0
  const totalInvestment = data?.totalInvestment || 0
  const monthlyRows = Array.isArray(data?.monthly) ? data.monthly : []
  const pulseBaseRows = monthlyRows.map((row, index) => {
    const income = Number(row?.income || 0)
    const expense = Number(row?.expense || 0)
    const investment = Number(row?.investment || 0)
    const outflow = expense + investment
    const net = income - outflow

    return {
      month: MONTH_SHORT[index] || `M${index + 1}`,
      income,
      outflow,
      net,
    }
  })
  const pulseRows = pulseBaseRows.map((row, index) => {
    const windowStart = Math.max(0, index - 2)
    const windowRows = pulseBaseRows.slice(windowStart, index + 1)
    const rolling = windowRows.length
      ? Math.round(windowRows.reduce((sum, item) => sum + item.net, 0) / windowRows.length)
      : row.net

    return {
      ...row,
      rolling,
    }
  })

  const monthsWithIncome = monthlyRows.filter((m) => Number(m?.income || 0) > 0)
  const avgSurplusRate = monthsWithIncome.length
    ? Math.round(
        monthsWithIncome.reduce((sum, row) => {
          const income = Number(row?.income || 0)
          const outflow = Number(row?.expense || 0) + Number(row?.investment || 0)
          return sum + ((income - outflow) / income) * 100
        }, 0) / monthsWithIncome.length
      )
    : 0
  const annualBalance = totalIncome - totalExpense - totalInvestment
  const previousAnnualBalance = (prevData?.totalIncome || 0) - (prevData?.totalExpense || 0) - (prevData?.totalInvestment || 0)
  const annualBalanceDelta = getDelta(annualBalance, previousAnnualBalance)
  const outflow = totalExpense + totalInvestment
  const deploymentRate = totalIncome > 0 ? Math.round((totalInvestment / totalIncome) * 100) : 0

  const flowMixBase = annualBalance >= 0
    ? Math.max(totalIncome, 1)
    : Math.max(outflow, 1)
  const flowMixRows = [
    {
      key: 'expense',
      label: 'Expenses',
      value: totalExpense,
      color: C.chartExpense,
    },
    {
      key: 'investment',
      label: 'Investments',
      value: totalInvestment,
      color: C.invest,
    },
    annualBalance >= 0
      ? {
          key: 'surplus',
          label: 'Surplus',
          value: Math.max(annualBalance, 0),
          color: C.chartIncome,
        }
      : {
          key: 'deficit',
          label: 'Deficit',
          value: Math.abs(annualBalance),
          color: C.bills,
        },
  ].map((row) => ({
    ...row,
    pct: Math.round((Math.max(0, Number(row.value || 0)) / flowMixBase) * 100),
  }))

  const positiveMonths = pulseRows.filter((row) => row.net >= 0).length
  const bestMonth = pulseRows.reduce((best, row) => (!best || row.net > best.net ? row : best), null)
  const worstMonth = pulseRows.reduce((worst, row) => (!worst || row.net < worst.net ? row : worst), null)
  const bestMonthNet = Number(bestMonth?.net || 0)
  const worstMonthNet = Number(worstMonth?.net || 0)

  const comparisonRows = [
    {
      label: 'Income',
      current: totalIncome,
      previous: Number(prevData?.totalIncome || 0),
      color: C.brand,
      delta: getDelta(totalIncome, prevData?.totalIncome),
      prefersDecrease: false,
    },
    {
      label: 'Expenses',
      current: totalExpense,
      previous: Number(prevData?.totalExpense || 0),
      color: C.chartExpense,
      delta: getDelta(totalExpense, prevData?.totalExpense),
      prefersDecrease: true,
    },
    {
      label: 'Investments',
      current: totalInvestment,
      previous: Number(prevData?.totalInvestment || 0),
      color: C.invest,
      delta: getDelta(totalInvestment, prevData?.totalInvestment),
      prefersDecrease: false,
    },
    {
      label: 'Surplus',
      current: annualBalance,
      previous: previousAnnualBalance,
      color: C.brandMid,
      delta: annualBalanceDelta,
      prefersDecrease: false,
    },
  ]

  const maxComparisonValue = comparisonRows.reduce(
    (max, row) => Math.max(max, Math.abs(row.current), Math.abs(row.previous)),
    1
  )

  return (
    <div className="card p-4 md:p-5 overflow-hidden">
      <div className="rounded-card border border-kosha-border bg-kosha-surface-2 p-3.5 mb-3.5">
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div>
            <p className="section-label">Annual command center</p>
            <p className="text-[12px] text-ink-3 mt-0.5">Strategic readout for {year}: balance health, deployment rhythm, and momentum.</p>
          </div>
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-pill border border-kosha-border bg-kosha-surface text-ink-2">
            {year}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-2.5">
          <div className="rounded-card bg-kosha-surface border border-kosha-border p-2.5">
            <p className="text-[10px] text-ink-3">Year surplus</p>
            <p className={`text-[14px] font-bold tabular-nums ${annualBalance >= 0 ? 'text-brand' : 'text-warning-text'}`}>
              {annualBalance >= 0 ? '+' : '-'}{fmt(Math.abs(annualBalance))}
            </p>
          </div>
          <div className="rounded-card bg-kosha-surface border border-kosha-border p-2.5">
            <p className="text-[10px] text-ink-3">Avg surplus</p>
            <p className="text-[14px] font-bold tabular-nums text-ink">{avgSurplusRate}%</p>
          </div>
          <div className="rounded-card bg-kosha-surface border border-kosha-border p-2.5">
            <p className="text-[10px] text-ink-3">Deploy rate</p>
            <p className={`text-[14px] font-bold tabular-nums ${deploymentRate >= 12 && deploymentRate <= 35 ? 'text-income-text' : 'text-warning-text'}`}>
              {deploymentRate}%
            </p>
          </div>
          <div className="rounded-card bg-kosha-surface border border-kosha-border p-2.5">
            <p className="text-[10px] text-ink-3">Positive months</p>
            <p className="text-[14px] font-bold tabular-nums text-ink">{positiveMonths}/12</p>
          </div>
        </div>

        <div className="rounded-card bg-kosha-surface border border-kosha-border p-2.5">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <p className="text-[11px] font-semibold text-ink-2">Flow structure</p>
            <span className={`text-[11px] font-semibold ${annualBalance >= 0 ? 'text-brand' : 'text-warning-text'}`}>
              {annualBalanceDelta.label}
            </span>
          </div>
          <div className="h-2.5 rounded-pill bg-kosha-border overflow-hidden border border-kosha-border flex">
            {flowMixRows.map((row) => (
              <motion.div
                key={row.key}
                className="h-full"
                style={{ background: row.color }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(4, row.pct)}%` }}
                transition={{ duration: 0.55, ease: 'easeOut' }}
              />
            ))}
          </div>
          <div className="mt-1.5 grid grid-cols-2 md:grid-cols-3 gap-1.5">
            {flowMixRows.map((row) => (
              <div key={`mix-${row.key}`} className="flex items-center justify-between gap-2 rounded-card bg-kosha-surface-2 px-2 py-1 border border-kosha-border">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: row.color }} />
                  <span className="text-[10px] text-ink-2 truncate">{row.label}</span>
                </div>
                <span className="text-[10px] font-semibold tabular-nums text-ink shrink-0">{row.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-[1.1fr_0.9fr] gap-3 mb-3">
        <div className="rounded-card border border-kosha-border bg-kosha-surface-2 p-2.5">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <p className="text-[11px] font-semibold text-ink-2">Monthly surplus pulse</p>
            <span className="text-[10px] text-ink-3">Net and rolling trend</span>
          </div>

          {pulseRows.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={176}>
                <AreaChart data={pulseRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="annualNetFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={C.brandMid} stopOpacity={0.36} />
                      <stop offset="100%" stopColor={C.brandMid} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(16,33,63,0.10)" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'rgba(94,109,143,0.95)' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={compactTick} tick={{ fontSize: 10, fill: 'rgba(94,109,143,0.95)' }} axisLine={false} tickLine={false} width={34} />
                  <ReferenceLine y={0} stroke="rgba(16,33,63,0.28)" strokeDasharray="4 4" />
                  <RechartsTooltip content={<NetPulseTooltip />} />
                  <Area type="monotone" dataKey="net" stroke={C.brand} strokeWidth={2.1} fill="url(#annualNetFill)" dot={{ r: 2.2, strokeWidth: 0, fill: C.brand }} />
                  <Line type="monotone" dataKey="rolling" stroke={C.invest} strokeWidth={1.8} dot={false} strokeDasharray="5 4" />
                </AreaChart>
              </ResponsiveContainer>

              <div className="grid grid-cols-2 gap-2 mt-1">
                <div className="rounded-card bg-kosha-surface border border-kosha-border px-2 py-1.5">
                  <p className="text-[10px] text-ink-3">Best month</p>
                  <p className="text-[11px] font-semibold text-income-text tabular-nums">
                    {bestMonth?.month || '—'} · {bestMonthNet >= 0 ? '+' : '-'}{fmt(Math.abs(bestMonthNet))}
                  </p>
                </div>
                <div className="rounded-card bg-kosha-surface border border-kosha-border px-2 py-1.5">
                  <p className="text-[10px] text-ink-3">Worst month</p>
                  <p className="text-[11px] font-semibold text-warning-text tabular-nums">
                    {worstMonth?.month || '—'} · {worstMonthNet >= 0 ? '+' : '-'}{fmt(Math.abs(worstMonthNet))}
                  </p>
                </div>
              </div>
            </>
          ) : (
            <p className="text-[11px] text-ink-3">Monthly trend data is not available yet for this year.</p>
          )}
        </div>

        <div className="rounded-card border border-kosha-border bg-kosha-surface-2 p-2.5">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-[11px] font-semibold text-ink-2">YoY momentum board</p>
            <span className="text-[10px] text-ink-3">This year vs last year</span>
          </div>

          <div className="space-y-2">
            {comparisonRows.map((row) => (
              <div key={row.label} className="rounded-card bg-kosha-surface border border-kosha-border p-2">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <p className="text-[10px] font-semibold text-ink-3">{row.label}</p>
                  <p className={`text-[10px] font-semibold tabular-nums ${deltaTone(row.delta.pct, row.prefersDecrease)}`}>{row.delta.label}</p>
                </div>

                <div className="space-y-1.5">
                  <div>
                    <div className="flex items-center justify-between text-[10px] text-ink-3 mb-0.5">
                      <span>This year</span>
                      <span className="tabular-nums">{fmt(row.current)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-brand-container/40 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: row.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${scaledWidth(row.current, maxComparisonValue)}%` }}
                        transition={{ duration: 0.55, ease: 'easeOut' }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[10px] text-ink-3 mb-0.5">
                      <span>Last year</span>
                      <span className="tabular-nums">{fmt(row.previous)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-brand-container/40 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full opacity-55"
                        style={{ background: row.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${scaledWidth(row.previous, maxComparisonValue)}%` }}
                        transition={{ duration: 0.55, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-[11px] text-ink-3">This hero combines flow structure and monthly pulse so allocation decisions are anchored in momentum, not just totals.</p>
    </div>
  )
}
