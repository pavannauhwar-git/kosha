import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { C } from '../../../lib/colors'
import { fmt } from '../../../lib/utils'
import { transitionEmphasis } from '../../../lib/animations'

const AXES = [
  { key: 'savings', label: 'Savings rate' },
  { key: 'investment', label: 'Invest rate' },
  { key: 'expenseControl', label: 'Expense ctrl' },
  { key: 'incomeGrowth', label: 'Income growth' },
  { key: 'consistency', label: 'Consistency' },
  { key: 'positiveMonths', label: 'Positive mths' },
]

const CX = 140
const CY = 142
const R = 90
const RINGS = [0.25, 0.5, 0.75, 1.0]
const ANGLE_OFFSET = -Math.PI / 2

function polarX(fraction, axisIndex, total) {
  const angle = ANGLE_OFFSET + (2 * Math.PI * axisIndex) / total
  return CX + fraction * R * Math.cos(angle)
}
function polarY(fraction, axisIndex, total) {
  const angle = ANGLE_OFFSET + (2 * Math.PI * axisIndex) / total
  return CY + fraction * R * Math.sin(angle)
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v))
}

function axisColor(axisKey) {
  if (axisKey === 'investment') return C.invest
  if (axisKey === 'expenseControl') return C.expense
  if (axisKey === 'savings' || axisKey === 'positiveMonths') return C.income
  return C.brand
}

export default function FinancialHealthRadar({ data, prevData, year }) {
  const scores = useMemo(() => {
    const totalIncome = Number(data?.totalIncome || 0)
    const totalExpense = Number(data?.totalExpense || 0)
    const totalInvestment = Number(data?.totalInvestment || 0)
    const monthly = Array.isArray(data?.monthly) ? data.monthly : []
    const prevIncome = Number(prevData?.totalIncome || 0)

    // 1. Savings rate (0-100 → 0-1, capped at 50% = perfect)
    const savingsRate = totalIncome > 0
      ? (totalIncome - totalExpense - totalInvestment) / totalIncome
      : 0
    const savingsScore = clamp01(savingsRate / 0.5)

    // 2. Investment rate (0-30%=perfect range)
    const investRate = totalIncome > 0 ? totalInvestment / totalIncome : 0
    const investScore = clamp01(investRate / 0.3)

    // 3. Expense control — lower expense-to-income is better
    const expenseRatio = totalIncome > 0 ? totalExpense / totalIncome : 1
    const expenseScore = clamp01(1 - expenseRatio)

    // 4. Income growth YoY
    let incomeGrowthScore = 0.5 // baseline if no prev data
    if (prevIncome > 0) {
      const growth = (totalIncome - prevIncome) / prevIncome
      incomeGrowthScore = clamp01(0.5 + growth) // 0% growth = 0.5, +50% = 1.0
    }

    // 5. Surplus consistency — coefficient of variation of monthly net
    const nets = monthly.map((m) => {
      const inc = Number(m?.income || 0)
      const exp = Number(m?.expense || 0)
      const inv = Number(m?.investment || 0)
      return inc - exp - inv
    }).filter((_, i) => i < 12)
    let consistencyScore = 0.5
    if (nets.length >= 3) {
      const mean = nets.reduce((s, v) => s + v, 0) / nets.length
      const variance = nets.reduce((s, v) => s + (v - mean) ** 2, 0) / nets.length
      const sd = Math.sqrt(variance)
      const cv = Math.abs(mean) > 0 ? sd / Math.abs(mean) : 2
      consistencyScore = clamp01(1 - cv / 2)
    }

    // 6. Positive months ratio
    const positiveMonths = nets.filter((n) => n >= 0).length
    const positiveScore = nets.length > 0 ? positiveMonths / Math.min(nets.length, 12) : 0

    const values = [savingsScore, investScore, expenseScore, incomeGrowthScore, consistencyScore, positiveScore]
    const overall = Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100)

    const annualNet = totalIncome - totalExpense - totalInvestment
    const savingsPct = totalIncome > 0 ? Math.round(savingsRate * 100) : 0
    const investPct = totalIncome > 0 ? Math.round(investRate * 100) : 0

    return {
      values,
      overall,
      metrics: {
        income: totalIncome,
        outflow: totalExpense + totalInvestment,
        investment: totalInvestment,
        annualNet,
        savingsPct,
        investPct,
        positiveMonths,
      },
    }
  }, [data, prevData])

  const n = AXES.length
  const polygonPoints = scores.values
    .map((v, i) => `${polarX(v, i, n)},${polarY(v, i, n)}`)
    .join(' ')

  const healthLabel = scores.overall >= 75 ? 'Strong' : scores.overall >= 50 ? 'Moderate' : 'Needs work'
  const healthColor = scores.overall >= 75 ? 'text-income-text' : scores.overall >= 50 ? 'text-brand' : 'text-warning-text'

  return (
    <div className="card p-4 md:p-5 overflow-hidden">
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <p className="section-label">Financial health radar</p>
          <p className="text-[11px] text-ink-3 mt-0.5">
            6-axis profile scoring your financial posture for {year}.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[18px] font-bold tabular-nums text-ink">{scores.overall}</p>
          <p className={`text-[10px] font-semibold ${healthColor}`}>{healthLabel}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
        <div className="mini-panel p-2">
          <p className="text-[9px] text-ink-3">Income</p>
          <p className="text-[11px] font-bold tabular-nums text-ink">{fmt(scores.metrics.income, true)}</p>
        </div>
        <div className="mini-panel p-2">
          <p className="text-[9px] text-ink-3">Outflow</p>
          <p className="text-[11px] font-bold tabular-nums text-expense-text">{fmt(scores.metrics.outflow, true)}</p>
        </div>
        <div className="mini-panel p-2">
          <p className="text-[9px] text-ink-3">Invested</p>
          <p className="text-[11px] font-bold tabular-nums text-invest-text">{fmt(scores.metrics.investment, true)}</p>
        </div>
        <div className="mini-panel p-2">
          <p className="text-[9px] text-ink-3">Annual net</p>
          <p className={`text-[11px] font-bold tabular-nums ${scores.metrics.annualNet >= 0 ? 'text-income-text' : 'text-expense-text'}`}>
            {scores.metrics.annualNet >= 0 ? '+' : '-'}{fmt(Math.abs(scores.metrics.annualNet), true)}
          </p>
        </div>
      </div>

      <div className="flex justify-center">
        <svg viewBox="0 0 280 296" className="w-full max-w-[300px]">
          {/* Concentric rings */}
          {RINGS.map((ring) => (
            <polygon
              key={`ring-${ring}`}
              points={Array.from({ length: n }, (_, i) =>
                `${polarX(ring, i, n)},${polarY(ring, i, n)}`
              ).join(' ')}
              fill="none"
              stroke="rgba(16,33,63,0.10)"
              strokeWidth="1"
            />
          ))}

          {/* Axis lines */}
          {AXES.map((_, i) => (
            <line
              key={`axis-${i}`}
              x1={CX}
              y1={CY}
              x2={polarX(1, i, n)}
              y2={polarY(1, i, n)}
              stroke="rgba(16,33,63,0.08)"
              strokeWidth="1"
            />
          ))}

          {/* Data polygon — animated */}
          <motion.polygon
            points={polygonPoints}
            fill={C.brand}
            fillOpacity={0.15}
            stroke={C.brand}
            strokeWidth="2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={transitionEmphasis}
          />

          {/* Data points */}
          {scores.values.map((v, i) => (
            <circle
              key={`dot-${i}`}
              cx={polarX(v, i, n)}
              cy={polarY(v, i, n)}
              r="3.5"
              fill={C.brand}
              stroke="#fff"
              strokeWidth="1.5"
            />
          ))}

          {/* Axis labels */}
          {AXES.map((axis, i) => {
            const lx = polarX(1.18, i, n)
            const ly = polarY(1.18, i, n)
            const pct = Math.round(scores.values[i] * 100)
            return (
              <text
                key={`label-${i}`}
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-ink-3"
                style={{ fontSize: '9px', fontWeight: 600 }}
              >
                <tspan x={lx} dy="-0.4em">{axis.label}</tspan>
                <tspan x={lx} dy="1.2em" style={{ fontSize: '8px', fontWeight: 700 }} className="fill-ink-2">{pct}%</tspan>
              </text>
            )
          })}
        </svg>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-1">
        {AXES.map((axis, i) => {
          const pct = Math.round(scores.values[i] * 100)
          return (
            <div key={axis.key} className="mini-panel p-2">
              <p className="text-[9px] text-ink-3 truncate">{axis.label}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="flex-1 h-1.5 rounded-pill bg-kosha-border overflow-hidden">
                  <motion.div
                    className="h-full rounded-pill"
                    style={{ background: axisColor(axis.key) }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ ...transitionEmphasis, delay: i * 0.04 }}
                  />
                </div>
                <span className="text-[10px] font-bold tabular-nums text-ink shrink-0">{pct}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
