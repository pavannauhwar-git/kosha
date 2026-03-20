import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react'
import { Sparkle } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis, Tooltip, ReferenceLine,
  ResponsiveContainer, Cell,
} from 'recharts'
import { useYearSummary } from '../hooks/useTransactions'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import CategoryIcon from '../components/CategoryIcon'
import CategorySpendingChart from '../components/CategorySpendingChart'
import { CATEGORIES } from '../lib/categories'
import { fmt, fmtDate } from '../lib/utils'
import { C } from '../lib/colors'

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const YEARS = Array.from({ length: new Date().getFullYear() - 2022 + 1 }, (_, i) => 2023 + i)

const PORTFOLIO_COLORS = C.portfolio

const CASH_CHART_BG =
  'radial-gradient(circle at 82% 12%, rgba(91,81,224,0.22) 0%, rgba(91,81,224,0) 58%), linear-gradient(180deg, #272163 0%, #1E1B4B 100%)'

const NET_CHART_BG =
  'radial-gradient(circle at 18% 18%, rgba(52,211,153,0.14) 0%, rgba(52,211,153,0) 52%), linear-gradient(180deg, #241F5D 0%, #1A1746 100%)'

function AnalyticsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="skeleton shimmer h-[110px]" />
        <div className="skeleton shimmer h-[110px]" />
        <div className="skeleton shimmer h-[110px]" />
        <div className="skeleton shimmer h-[110px]" />
      </div>
      <div className="skeleton shimmer h-[220px]" />
      <div className="skeleton shimmer h-[170px]" />
      <div className="skeleton shimmer h-[180px]" />
    </div>
  )
}

const DarkTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'rgba(31,31,31,0.96)',
      borderRadius: 12,
      padding: '10px 14px',
      boxShadow: '0px 4px 8px 3px rgba(0,0,0,0.15)',
      minWidth: 140,
      border: '0.5px solid rgba(255,255,255,0.10)',
    }}>
      <p style={{
        fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)',
        letterSpacing: '0.04em', marginBottom: 6, textTransform: 'uppercase'
      }}>
        {label}
      </p>
      {payload.map(p => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: 3 }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>{p.name}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: p.stroke || p.fill || p.color }}>
            {fmt(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

const NetTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  const val = Number(payload[0]?.value || 0)
  const valueColor = val >= 0 ? C.chartIncome : C.chartExpense

  return (
    <div style={{
      background: 'rgba(31,31,31,0.96)',
      borderRadius: 12,
      padding: '10px 14px',
      boxShadow: '0px 4px 8px 3px rgba(0,0,0,0.15)',
      minWidth: 140,
      border: '0.5px solid rgba(255,255,255,0.10)',
    }}>
      <p style={{
        fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.5)',
        letterSpacing: '0.04em', marginBottom: 6, textTransform: 'uppercase'
      }}>
        {label}
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
        <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)' }}>Net</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: valueColor }}>
          {fmt(val)}
        </span>
      </div>
    </div>
  )
}

function SectionHeading({ children, right }) {
  return (
    <div className="flex items-center justify-between">
      <p className="section-label">{children}</p>
      {right && <div>{right}</div>}
    </div>
  )
}

function AnnualSummaryCard({ data, prevData, spendTrend, year }) {
  const totalIncome     = data?.totalIncome     || 0
  const totalExpense    = data?.totalExpense    || 0
  const totalInvestment = data?.totalInvestment || 0
  const avgSavings      = data?.avgSavings      || 0

  const incomePct = prevData?.totalIncome > 0
    ? Math.round(((totalIncome - prevData.totalIncome) / prevData.totalIncome) * 100)
    : null

  const expensePct = prevData?.totalExpense > 0
    ? Math.round(((totalExpense - prevData.totalExpense) / prevData.totalExpense) * 100)
    : null

  const investPct = prevData?.totalInvestment > 0
    ? Math.round(((totalInvestment - prevData.totalInvestment) / prevData.totalInvestment) * 100)
    : null

  const ARC = 52, SW = 5, R = ARC / 2 - SW
  const CIRC = 2 * Math.PI * R
  const arcFill = Math.max(0, Math.min(avgSavings, 100)) / 100 * CIRC

  function YoyBadge({ pct, invertGood = false }) {
    if (pct === null || Math.abs(pct) < 2) return null
    const isGood = invertGood ? pct < 0 : pct > 0
    return (
      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full
        ${isGood ? 'bg-income-bg text-income-text' : 'bg-expense-bg text-expense-text'}`}>
        {pct > 0 ? '↑' : '↓'}{Math.abs(pct)}%
      </span>
    )
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-5 pt-5 pb-4 border-b border-kosha-border">
        <p className="text-caption text-ink-3 font-medium mb-1.5">Total Earned</p>
        <div className="flex items-center justify-between gap-3">
          <p className="font-bold tabular-nums text-income-text"
            style={{ fontSize: 28, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            {fmt(totalIncome)}
          </p>
          {incomePct !== null && Math.abs(incomePct) >= 2 && (
            <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-caption font-semibold shrink-0
              ${incomePct >= 0 ? 'bg-income-bg text-income-text' : 'bg-expense-bg text-expense-text'}`}>
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
            <circle cx={ARC / 2} cy={ARC / 2} r={R}
              fill="none" stroke={C.brandBorder} strokeWidth={SW} />
            {avgSavings > 0 && (
              <circle cx={ARC / 2} cy={ARC / 2} r={R}
                fill="none" stroke={C.brand} strokeWidth={SW}
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
          {spendTrend && (
            <TrendPill current={spendTrend.current} previous={spendTrend.previous} label="spend" />
          )}
        </div>
      </div>
    </div>
  )
}

function TrendPill({ current, previous, label }) {
  if (!previous || previous === 0) return null
  const pct = Math.round(((current - previous) / previous) * 100)
  const up = pct > 0
  if (Math.abs(pct) < 3) return <span className="chip-neutral">≈ Stable {label}</span>
  return (
    <span className={`text-caption font-semibold px-2.5 py-1 rounded-full
      ${up ? 'bg-expense-bg text-expense-text' : 'bg-income-bg text-income-text'}`}>
      {up ? '↑' : '↓'} {Math.abs(pct)}% {label}
    </span>
  )
}

function YoYCards({ years, currentYear, userId }) {
  const yearsKey = useMemo(
    () => years.slice().sort((a, b) => a - b).join(','),
    [years]
  )

  const { data: allData = {} } = useQuery({
    queryKey: ['yoy', userId, yearsKey],
    enabled: Boolean(userId) && years.length > 0,
    queryFn: async () => {
      try {
        const startYear = Math.min(...years)
        const endYear = Math.max(...years)
        const yearsSet = new Set(years)

        const { data: rows, error } = await supabase
          .from('transactions')
          .select('type, amount, date, is_repayment')
          .eq('user_id', userId)
          .gte('date', `${startYear}-01-01`)
          .lte('date', `${endYear}-12-31`)

        if (error) throw error

        const totals = {}
        years.forEach((y) => {
          totals[y] = { income: 0, spent: 0, invest: 0 }
        })

        ;(rows || []).forEach((r) => {
          const y = Number(String(r.date).slice(0, 4))
          if (!yearsSet.has(y)) return
          if (r.type === 'income' && !r.is_repayment) totals[y].income += +r.amount
          if (r.type === 'expense') totals[y].spent += +r.amount
          if (r.type === 'investment') totals[y].invest += +r.amount
        })

        years.forEach((y) => {
          const entry = totals[y]
          entry.rate = entry.income > 0
            ? Math.round(((entry.income - entry.spent) / entry.income) * 100)
            : 0
        })

        return totals
      } catch (err) {
        console.error('[Kosha] YoY query failed', err)
        throw err
      }
    },
  })

  const yearsWithData = years.filter(y => allData[y]?.income > 0 || allData[y]?.spent > 0)
  if (yearsWithData.length < 2) return null

  return (
    <div>
      <SectionHeading>Year over Year</SectionHeading>
      <div className="overflow-x-auto no-scrollbar -mx-4 px-4 mt-3">
        <div className="flex gap-3 pb-1 pr-4" style={{ minWidth: 'max-content' }}>
          {yearsWithData.map((y, idx) => {
            const d = allData[y]
            const prev = allData[yearsWithData[idx - 1]]
            const isCurrent = y === currentYear

            function delta(curr, prv) {
              if (!prv || prv === 0) return null
              return Math.round(((curr - prv) / prv) * 100)
            }

            return (
              <div key={y}
                className={`card p-4 w-[155px] shrink-0 ${isCurrent ? 'border-brand' : ''}`}
                style={isCurrent ? { borderWidth: '1.5px' } : {}}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-label font-bold ${isCurrent ? 'text-ink' : 'text-ink-3'}`}>{y}</span>
                  {isCurrent && (
                    <span className="text-[9px] font-bold bg-brand-container text-brand-on px-1.5 py-0.5 rounded-full">
                      Now
                    </span>
                  )}
                </div>

                <div className="space-y-2.5">
                  {[
                    { label: 'Earned',   key: 'income', cls: isCurrent ? 'text-income-text'  : 'text-ink-2' },
                    { label: 'Spent',    key: 'spent',  cls: isCurrent ? 'text-expense-text' : 'text-ink-2' },
                    { label: 'Invested', key: 'invest', cls: isCurrent ? 'text-invest-text'  : 'text-ink-2' },
                    { label: 'Leftover', key: 'rate',   cls: isCurrent ? 'text-repay-text'   : 'text-ink-2', suffix: '%' },
                  ].map(row => {
                    const val = d?.[row.key] ?? 0
                    const d2  = delta(val, prev?.[row.key])
                    return (
                      <div key={row.key}>
                        <p className="text-[10px] text-ink-3 mb-0.5">{row.label}</p>
                        <div className="flex items-baseline gap-1">
                          <p className={`text-[12px] font-bold tabular-nums ${row.cls}`}>
                            {row.suffix ? `${val}%` : fmt(val, true)}
                          </p>
                          {d2 !== null && Math.abs(d2) >= 3 && (
                            <span className={`text-[9px] font-bold ${d2 > 0 ? 'text-income-text' : 'text-expense-text'}`}>
                              {d2 > 0 ? '↑' : '↓'}{Math.abs(d2)}%
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function PortfolioAllocation({ vehicleData }) {
  const total = vehicleData.reduce((s, [, v]) => s + (Number(v) || 0), 0)
  if (!vehicleData.length || total === 0) return null

  const SIZE = 120
  const SW   = 8
  const R    = SIZE / 2 - SW
  const CX   = SIZE / 2
  const CY   = SIZE / 2
  const CIRC = 2 * Math.PI * R

  const segs = vehicleData
    .map(([name, value], i) => ({
      name,
      value: Number(value) || 0,
      pct: total > 0 ? Math.round(((Number(value) || 0) / total) * 100) : 0,
      color: PORTFOLIO_COLORS[i % PORTFOLIO_COLORS.length],
    }))
    .filter(s => s.value > 0)

  let offset = 0

  return (
    <div className="card p-5">
      <p className="section-label mb-4">Portfolio Allocation</p>
      <div className="flex gap-4 items-center">
        <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            <circle cx={CX} cy={CY} r={R} fill="none" stroke={C.brandBorder} strokeWidth={SW} />
            {segs.map((seg, i) => {
              const dashLen       = Math.max(0, (seg.pct / 100) * CIRC)
              const currentOffset = offset
              offset += seg.pct
              return (
                <circle key={i} cx={CX} cy={CY} r={R}
                  fill="none" stroke={seg.color} strokeWidth={SW} strokeLinecap="butt"
                  strokeDasharray={`${dashLen} ${CIRC}`}
                  strokeDashoffset={-currentOffset * CIRC / 100}
                  transform={`rotate(-90 ${CX} ${CY})`}
                />
              )
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span style={{ fontSize: 12, fontWeight: 700, color: C.ink, lineHeight: 1.1 }}>
              {fmt(total, true)}
            </span>
            <span style={{ fontSize: 9, color: C.inkMuted }}>total</span>
          </div>
        </div>

        <div className="flex-1 space-y-3 pt-1 min-w-0">
          {segs.map(seg => (
            <div key={seg.name}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: seg.color }} />
                <span className="text-caption text-ink-3 flex-1 truncate">{seg.name}</span>
                <span className="text-caption font-bold tabular-nums text-ink">{seg.pct}%</span>
              </div>
              <p className="text-caption text-ink-3 tabular-nums pl-4">{fmt(seg.value)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function Analytics() {
  const now = new Date()
  const currentYear = now.getFullYear()
  const [year,       setYear]       = useState(currentYear)
  const [showPicker, setShowPicker] = useState(false)
  const { user } = useAuth()

  const { data, loading } = useYearSummary(year)
  const { data: prevData } = useYearSummary(year - 1)

  const top5 = data?.top5 || []

  const chartData = useMemo(() => (data?.monthly || [])
    .map((m, i) => ({
      name: MONTH_SHORT[i],
      Income: Math.round(m.income),
      Spent: Math.round(m.expense),
    }))
    .filter(m => m.Income > 0 || m.Spent > 0), [data?.monthly])

  const chartH = chartData.length <= 4 ? 140 : 180

  const netData = useMemo(() => (data?.monthly || [])
    .map((m, i) => ({
      name: MONTH_SHORT[i],
      Net: Math.round(m.income - m.expense - m.investment),
    }))
    .filter(m => m.Net !== 0), [data?.monthly])

  const netAxisMax = useMemo(() => {
    const maxAbs = netData.reduce((m, row) => Math.max(m, Math.abs(row.Net)), 0)
    return Math.max(1000, Math.ceil(maxAbs * 1.15))
  }, [netData])

  const yoyYears = useMemo(() => YEARS.filter(y => y <= currentYear), [currentYear])

  const catEntries = useMemo(() => Object.entries(data?.byCategory || {})
    .sort((a, b) => b[1] - a[1]).slice(0, 8), [data?.byCategory])
  const categoryTotal = useMemo(() => catEntries.reduce((s, [, v]) => s + v, 0) || 1, [catEntries])

  const vehicleData = useMemo(
    () => Object.entries(data?.byVehicle || {}).sort((a, b) => b[1] - a[1]),
    [data?.byVehicle]
  )

  const spendTrend = useMemo(() => {
    const recentMonths = (data?.monthly || []).filter(m => m.expense > 0)
    const lastTwo = recentMonths.slice(-2)
    return lastTwo.length === 2
      ? { current: lastTwo[1].expense, previous: lastTwo[0].expense }
      : null
  }, [data?.monthly])

  return (
    <div className="page">

      {/* ── Year navigator ────────────────────────────────────────────── */}
      <div className="relative flex items-center justify-between mb-6 pr-14">
        <button onClick={() => setYear(y => y - 1)}
          className="w-9 h-9 rounded-full bg-kosha-surface border border-kosha-border
                     flex items-center justify-center active:bg-kosha-surface-2">
          <ChevronLeft size={18} className="text-ink-2" />
        </button>

        <div className="relative">
          <button type="button" onClick={() => setShowPicker(v => !v)}>
            <h1 className="text-display font-bold text-ink tracking-tight">{year}</h1>
          </button>
          <AnimatePresence>
            {showPicker && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowPicker(false)} />
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-10 left-1/2 -translate-x-1/2 z-50 card p-4 shadow-card-lg"
                  style={{ minWidth: 200 }}
                >
                  <div className="grid grid-cols-3 gap-2">
                    {YEARS.map(y => (
                      <button
                        key={y}
                        onClick={() => { setYear(y); setShowPicker(false) }}
                        className={`py-1.5 rounded-card text-[12px] font-semibold transition-colors
                          ${year === y ? 'bg-brand text-white' : 'bg-kosha-surface-2 text-ink-2'}`}
                      >
                        {y}
                      </button>
                    ))}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>

        <button onClick={() => setYear(y => y + 1)}
          className="w-9 h-9 rounded-full bg-kosha-surface border border-kosha-border
                     flex items-center justify-center active:bg-kosha-surface-2">
          <ChevronRight size={18} className="text-ink-2" />
        </button>
      </div>

      {loading ? (
        <AnalyticsSkeleton />
      ) : (
        <motion.div key={year}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >

          {/* ── Yearly Insights ──────────────────────────────────────── */}
          {chartData.length > 0 && (
            <div className="card p-4 overflow-hidden relative"
              style={{ background: 'linear-gradient(135deg, #EDE9FF 0%, #F5F3FF 100%)' }}>
              <div className="absolute top-0 right-0 w-28 h-28 pointer-events-none"
                style={{
                  background: 'radial-gradient(circle at 70% 30%, rgba(55,48,163,0.10) 0%, transparent 70%)',
                  borderRadius: '50%',
                  transform: 'translate(20%, -20%)',
                }} />
              <div className="flex items-center gap-2 mb-2 relative">
                <div className="w-6 h-6 rounded-lg bg-brand flex items-center justify-center shrink-0">
                  <Sparkle size={12} className="text-white" weight="fill" />
                </div>
                <h3 className="text-[13px] font-bold text-ink">Yearly Insights</h3>
              </div>
              <p className="text-[13px] text-ink-2 leading-relaxed relative">
                {(() => {
                  let parts = []
                  const inc = data?.totalIncome || 0
                  const rate = inc > 0 ? Math.round(((inc - (data?.totalExpense || 0)) / inc) * 100) : 0

                  if (rate > 20) parts.push(`You've had a strong year, saving ${rate}% of your earnings.`)
                  else if (rate > 0) parts.push(`You saved ${rate}% of your income.`)
                  else parts.push(`You spent more than you earned this year.`)

                  if (data?.monthly) {
                    let maxExp = 0, maxIdx = -1
                    data.monthly.forEach((m, i) => { if (m.expense > maxExp) { maxExp = m.expense; maxIdx = i } })
                    if (maxIdx >= 0 && maxExp > 0) parts.push(`${MONTH_SHORT[maxIdx]} was your highest spending month.`)
                  }

                  if (catEntries?.length > 0) {
                    const c = CATEGORIES.find(c => c.id === catEntries[0][0])
                    const pct = Math.round((catEntries[0][1] / Math.max(data?.totalExpense || 1, 1)) * 100)
                    parts.push(`Your biggest expense was ${c ? c.label : catEntries[0][0]}, making up ${pct}% of all spending.`)
                  }
                  return parts.join(' ')
                })()}
              </p>
            </div>
          )}

          {/* ── Annual Summary card ───────────────────────────────────── */}
          <AnnualSummaryCard
            data={data}
            prevData={prevData}
            spendTrend={spendTrend}
            year={year}
          />

          {/* ── Cash Flow chart ──────────────────────────────────────── */}
          {chartData.length > 0 && (
            <div
              className="rounded-card overflow-hidden shadow-card-lg"
              style={{
                background: CASH_CHART_BG,
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div className="px-5 pt-5 pb-2 flex items-start justify-between">
                <div>
                  <p className="text-label font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>Cash Flow</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                    Income vs spending by month
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold tabular-nums" style={{ fontSize: 15, color: C.chartIncome, letterSpacing: '-0.01em' }}>
                    {fmt(data?.totalIncome || 0, true)}
                  </p>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>earned</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={chartH}>
                <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.chartIncome} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={C.chartIncome} stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.chartExpense} stopOpacity={0.20} />
                      <stop offset="95%" stopColor={C.chartExpense} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name"
                    tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.40)', fontWeight: 500 }}
                    axisLine={false} tickLine={false} interval={0}
                  />
                  <YAxis hide />
                  <Tooltip content={<DarkTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }} />
                  <Area dataKey="Income" type="monotone"
                    stroke={C.chartIncome} strokeWidth={3}
                    fill="url(#gIncome)" dot={false}
                    activeDot={{ r: 5, fill: C.chartIncome, stroke: '#fff', strokeWidth: 2 }}
                  />
                  <Area dataKey="Spent" type="monotone"
                    stroke={C.chartExpense} strokeWidth={3}
                    fill="url(#gExpense)" dot={false}
                    activeDot={{ r: 5, fill: C.chartExpense, stroke: '#fff', strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6 pb-4 pt-1">
                {[['Income', C.chartIncome], ['Spent', C.chartExpense]].map(([l, c]) => (
                  <div key={l} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background: c }} />
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.50)', fontWeight: 500 }}>{l}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Net Savings ──────────────────────────────────────────── */}
          {netData.length > 0 && (
            <div
              className="rounded-card overflow-hidden shadow-card-lg"
              style={{
                background: NET_CHART_BG,
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div className="px-5 pt-5 pb-2 flex items-start justify-between">
                <div>
                  <p className="text-label font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>Net Savings</p>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                    After expenses &amp; investments
                  </p>
                </div>
                {(() => {
                  const totalNet = netData.reduce((s, m) => s + m.Net, 0)
                  return (
                    <div className="text-right">
                      <p className="font-bold tabular-nums" style={{
                        fontSize: 15,
                        color: totalNet >= 0 ? C.chartIncome : C.chartExpense,
                        letterSpacing: '-0.01em',
                      }}>
                        {fmt(Math.abs(totalNet), true)}
                      </p>
                      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
                        {totalNet >= 0 ? 'net saved' : 'net deficit'}
                      </p>
                    </div>
                  )
                })()}
              </div>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={netData} margin={{ top: 4, right: 16, left: 16, bottom: 0 }}>
                  <XAxis dataKey="name"
                    tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.50)', fontWeight: 500 }}
                    axisLine={false} tickLine={false} interval={0}
                  />
                  <YAxis hide domain={[-netAxisMax, netAxisMax]} />
                  <Tooltip content={<NetTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.16)" strokeWidth={1} />
                  <Bar dataKey="Net" radius={[8, 8, 8, 8]} maxBarSize={32} minPointSize={4}>
                    {netData.map((entry, i) => (
                      <Cell key={i}
                        fill={entry.Net >= 0 ? C.chartIncome : C.chartExpense}
                        fillOpacity={0.90} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="h-4" />
            </div>
          )}

          {/* ── Year-over-year cards ─────────────────────────────────── */}
          <YoYCards years={yoyYears} currentYear={year} userId={user?.id} />

          {/* ── Top 3 expenses ───────────────────────────────────────── */}
          {top5.length > 0 && (() => {
            const top3 = top5.slice(0, 3)
            const PODIUM = [
              { rank: 2, platformH: 56, grad: `linear-gradient(170deg,${C.brandContainer},${C.brandLight})`, rankColor: C.brand },
              { rank: 1, platformH: 80, grad: `linear-gradient(170deg,${C.brandLight},${C.brand})`, rankColor: '#FFFFFF' },
              { rank: 3, platformH: 40, grad: `linear-gradient(170deg,#F7F5FF,${C.brandBorder})`, rankColor: C.brandMid },
            ]
            const slots = PODIUM.map(p => ({ ...p, item: top3[p.rank - 1] })).filter(p => p.item)

            return (
              <div>
                <SectionHeading>Top Expenses {year}</SectionHeading>
                <div className="card mt-3 overflow-hidden">
                  <div className="flex items-end gap-1.5 px-3 pt-5">
                    {slots.map(({ rank, platformH, grad, rankColor, item }) => (
                      <div key={rank} className="flex flex-col flex-1 items-center min-w-0">
                        <div className="w-full flex flex-col items-center pb-3 px-0.5">
                          <CategoryIcon categoryId={item.category} size={14} />
                          <p className="text-[11px] font-medium text-ink text-center mt-1.5 leading-tight line-clamp-2">
                            {item.description}
                          </p>
                          <p className="text-[13px] font-bold text-expense-text tabular-nums mt-1">
                            {fmt(item.amount)}
                          </p>
                          <p className="text-[10px] text-ink-3 mt-0.5">{fmtDate(item.date)}</p>
                        </div>
                        <div className="w-full rounded-t-xl flex items-center justify-center"
                          style={{ height: platformH, background: grad }}>
                          <span className="text-[13px] font-extrabold" style={{ color: rankColor }}>
                            #{rank}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })()}

          {/* ── Portfolio allocation ──────────────────────────────────── */}
          {vehicleData.length > 0 && (
            <PortfolioAllocation vehicleData={vehicleData} />
          )}

          {/* ── Spending by Category ──────────────────────────────────── */}
          {catEntries.length > 0 && (
            <CategorySpendingChart
              entries={catEntries}
              total={categoryTotal}
            />
          )}

          {!data?.totalIncome && !data?.totalExpense && (
            <div className="card p-8 text-center">
              <p className="text-body text-ink-3">No data for {year}.</p>
            </div>
          )}

        </motion.div>
      )}
    </div>
  )
}
