import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react'
import { Sparkle, Star } from '@phosphor-icons/react'
import {
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis, Tooltip, ReferenceLine,
  ResponsiveContainer, Cell,
} from 'recharts'
import { useYearSummary } from '../hooks/useTransactions'
import { supabase } from '../lib/supabase'
import CategoryIcon from '../components/CategoryIcon'
import CategorySpendingChart from '../components/CategorySpendingChart'
import { CATEGORIES } from '../lib/categories'
import { fmt, fmtDate } from '../lib/utils'
import { C } from '../lib/colors'

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const YEARS = Array.from({ length: new Date().getFullYear() - 2022 + 1 }, (_, i) => 2023 + i)

// Portfolio colours — green family, darkest to lightest
const PORTFOLIO_COLORS = C.portfolio

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

// ── Light tooltip (KPI cards, net savings) ───────────────────────────────
// ── Dark tooltip (on dark chart card) ────────────────────────────────────
const DarkTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'rgba(31,31,31,0.96)', // MD3 On-Surface (Dark tooltip)
      borderRadius: 12,
      padding: '10px 14px',
      boxShadow: '0px 4px 8px 3px rgba(0,0,0,0.15)', // MD3 elevation 2
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

// ── Section heading with left-accent ─────────────────────────────────────
function SectionHeading({ children, right }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className="w-[3px] h-[18px] rounded-full bg-brand opacity-50" />
        <p className="section-label">{children}</p>
      </div>
      {right && <div>{right}</div>}
    </div>
  )
}

// ── Annual summary card (replaces 4 KPI cards) ────────────────────────────
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

  // Savings-rate arc
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
      {/* ── Total Earned ── */}
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

      {/* ── Spent + Invested ── */}
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

      {/* ── Savings rate ── */}
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

// ── Trend pill ────────────────────────────────────────────────────────────
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

// ── Year-over-year CARDS (replaces scrollable table) ─────────────────────
function YoYCards({ years, currentYear }) {
  const [allData, setAllData] = useState({})
  const yearsKey = useMemo(
    () => years.slice().sort((a, b) => a - b).join(','),
    [years]
  )

  useEffect(() => {
    let cancelled = false

    async function loadYoY() {
      if (!years.length) {
        if (!cancelled) setAllData({})
        return
      }

      const startYear = Math.min(...years)
      const endYear = Math.max(...years)
      const yearsSet = new Set(years)

      const { data: rows } = await supabase
        .from('transactions')
        .select('type, amount, date, is_repayment')
        .gte('date', `${startYear}-01-01`)
        .lte('date', `${endYear}-12-31`)

      if (cancelled) return

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
        entry.rate = entry.income > 0 ? Math.round(((entry.income - entry.spent) / entry.income) * 100) : 0
      })

      if (cancelled) return
      setAllData(totals)
    }

    loadYoY()
    return () => { cancelled = true }
  }, [yearsKey])

  const yearsWithData = years.filter(y => allData[y]?.income > 0 || allData[y]?.spent > 0)
  if (yearsWithData.length < 2) return null

  return (
    <div className="space-y-3">
      <SectionHeading>Year over Year</SectionHeading>
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
            className={`card p-4 ${isCurrent ? 'border-brand' : ''}`}
            style={isCurrent ? { borderWidth: '1.5px' } : {}}
          >
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-label font-bold ${isCurrent ? 'text-ink' : 'text-ink-3'}`}>
                {y}
              </span>
              {isCurrent && (
                <span className="text-[10px] font-semibold bg-brand-container text-brand-on
                                 px-2 py-0.5 rounded-pill">
                  This year
                </span>
              )}
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Earned', key: 'income', cls: isCurrent ? 'text-income-text' : 'text-ink-3' },
                { label: 'Spent', key: 'spent', cls: isCurrent ? 'text-expense-text' : 'text-ink-3' },
                { label: 'Invested', key: 'invest', cls: isCurrent ? 'text-invest-text' : 'text-ink-3' },
                { label: 'Saved', key: 'rate', cls: isCurrent ? 'text-brand' : 'text-ink-3', suffix: '%' },
              ].map(row => {
                const val = d?.[row.key] ?? 0
                const prevV = prev?.[row.key]
                const d2 = delta(val, prevV)
                return (
                  <div key={row.key}>
                    <p className="text-[10px] text-ink-3 mb-1">{row.label}</p>
                    <p className={`text-[13px] font-bold tabular-nums ${row.cls}`}>
                      {row.suffix ? `${val}%` : fmt(val, true)}
                    </p>
                    {isCurrent && d2 !== null && (
                      <p className={`text-[10px] font-semibold mt-0.5 ${d2 > 0 ? 'text-income-text' : 'text-expense-text'}`}>
                        {d2 > 0 ? '↑' : '↓'} {Math.abs(d2)}%
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Portfolio donut ───────────────────────────────────────────────────────
function PortfolioDonut({ vehicleData }) {
  const total = vehicleData.reduce((s, [, v]) => s + (Number(v) || 0), 0)

  const SIZE = 130
  const SW = 9
  const R = (SIZE / 2) - SW
  const CX = SIZE / 2
  const CY = SIZE / 2
  const CIRC = 2 * Math.PI * R
  const GAP_DEG = 12

  const segs = vehicleData
    .map(([name, value], i) => {
      const safeValue = Number(value) || 0
      return {
        name,
        value: safeValue,
        ratio: total > 0 ? safeValue / total : 0,
        pct: total > 0 ? Math.round((safeValue / total) * 100) : 0,
        color: PORTFOLIO_COLORS[i % PORTFOLIO_COLORS.length],
      }
    })
    .filter(s => s.value > 0)

  let offsetRatio = 0

  return (
    <div className="card p-5">
      <SectionHeading>Portfolio Allocation</SectionHeading>
      <div className="flex items-center gap-4 mt-4">
        <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            <circle cx={CX} cy={CY} r={R} fill="none" stroke={C.brandBorder} strokeWidth={SW} />
            {segs.map((seg) => {
              const gapLen = segs.length > 1 ? (GAP_DEG / 360) * CIRC : 0
              const dashLen = Math.max(0, seg.ratio * CIRC - gapLen)
              const currentOffset = offsetRatio
              offsetRatio += seg.ratio
              return (
                <circle
                  key={seg.name}
                  cx={CX}
                  cy={CY}
                  r={R}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={SW}
                  strokeLinecap="round"
                  strokeDasharray={`${dashLen} ${CIRC}`}
                  strokeDashoffset={-currentOffset * CIRC}
                  transform={`rotate(-90 ${CX} ${CY})`}
                />
              )
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[12px] font-bold text-ink tabular-nums">{fmt(total, true)}</span>
            <span className="text-[10px] text-ink-3">total</span>
          </div>
        </div>

        <div className="flex-1 space-y-0 min-w-0">
          {segs.map((seg, i) => {
            return (
              <div key={seg.name}
                className={`flex items-center gap-2 py-2
                  ${i < segs.length - 1 ? 'border-b border-kosha-border' : ''}`}
              >
                <div className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ background: seg.color }} />
                <span className="text-caption text-ink font-medium flex-1 truncate">{seg.name}</span>
                <span className="text-caption text-ink-3 w-7 text-right">{seg.pct}%</span>
                <span className="text-caption font-semibold text-ink tabular-nums w-16 text-right">
                  {fmt(seg.value, true)}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function Analytics() {
  const now = new Date()
  const currentYear = now.getFullYear()
  const [year, setYear] = useState(currentYear)

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
      <div className="flex items-center justify-between mb-6 pr-14">
        <button onClick={() => setYear(y => y - 1)}
          className="w-10 h-10 rounded-full bg-kosha-surface-2 border border-kosha-border
                     flex items-center justify-center active:scale-95 transition-transform">
          <ChevronLeft size={20} className="text-ink-2" />
        </button>
        <div className="text-center">
          <h1 className="text-display font-bold text-ink tracking-tight leading-none">{year}</h1>
          {year === currentYear && (
            <span className="text-[10px] font-bold text-brand bg-brand-container
                             px-2.5 py-0.5 rounded-full mt-1.5 inline-block tracking-wide">
              CURRENT
            </span>
          )}
        </div>
        <button onClick={() => setYear(y => Math.min(y + 1, currentYear))}
          disabled={year >= currentYear}
          className={`w-10 h-10 rounded-full border flex items-center justify-center transition-transform
            ${year >= currentYear
              ? 'bg-kosha-surface-2/50 border-kosha-border/40 opacity-30 cursor-default'
              : 'bg-kosha-surface-2 border-kosha-border active:scale-95'}`}>
          <ChevronRight size={20} className="text-ink-2" />
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
            <div className="card p-5 overflow-hidden relative"
              style={{ background: 'linear-gradient(135deg, #EDE9FF 0%, #F5F3FF 100%)' }}>
              {/* decorative radial glow */}
              <div className="absolute top-0 right-0 w-32 h-32 pointer-events-none"
                style={{
                  background: 'radial-gradient(circle at 70% 30%, rgba(55,48,163,0.10) 0%, transparent 70%)',
                  borderRadius: '50%',
                  transform: 'translate(20%, -20%)',
                }} />
              <div className="flex items-center gap-2.5 mb-3 relative">
                <div className="w-7 h-7 rounded-xl bg-brand flex items-center justify-center shrink-0">
                  <Sparkle size={14} className="text-white" weight="fill" />
                </div>
                <h3 className="text-[15px] font-bold text-ink">Yearly Insights</h3>
              </div>
              <p className="text-[14px] text-ink-2 leading-relaxed relative">
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

          {/* ── 1. Annual Summary card ───────────────────────────────── */}
          <AnnualSummaryCard
            data={data}
            prevData={prevData}
            spendTrend={spendTrend}
            year={year}
          />

          {/* ── 2. Cash Flow chart ──────────────────────────────────── */}
          {chartData.length > 0 && (
            <div className="rounded-card overflow-hidden shadow-card-lg" style={{ background: C.chartDark }}>
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

          {/* ── 3. Net Savings ──────────────────────────────────────── */}
          {netData.length > 0 && (
            <div className="rounded-card overflow-hidden shadow-card-lg" style={{ background: C.chartDark }}>
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
                    tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.40)', fontWeight: 500 }}
                    axisLine={false} tickLine={false} interval={0}
                  />
                  <YAxis hide />
                  <Tooltip content={<DarkTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
                  <Bar dataKey="Net" radius={[8, 8, 8, 8]} maxBarSize={32}>
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

          {/* ── 4. Year-over-year stacked cards ─────────────────────── */}
          <YoYCards years={yoyYears} currentYear={year} />

          {/* ── 5. Top 5 expenses ────────────────────────────────────── */}
          {top5.length > 0 && (
            <div>
              <SectionHeading>Top Expenses {year}</SectionHeading>
              <div className="card p-0 overflow-hidden mt-3">
                {top5.map((t, i) => {
                  // Medal style for top 3
                  const MEDAL = [
                    { ringCls: 'ring-yellow-300/60', bg: 'bg-yellow-50', textCls: 'text-yellow-600' },
                    { ringCls: 'ring-slate-300/60',  bg: 'bg-slate-50',  textCls: 'text-slate-500'  },
                    { ringCls: 'ring-orange-300/60', bg: 'bg-orange-50', textCls: 'text-orange-500' },
                  ]
                  const medal = i < 3 ? MEDAL[i] : null

                  return (
                    <div key={t.id}
                      className={`flex items-center gap-3 py-3.5 px-4
                        ${i < top5.length - 1 ? 'border-b border-kosha-border' : ''}`}
                    >
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0
                        ${medal ? `${medal.bg} ring-1 ${medal.ringCls}` : 'bg-kosha-surface-2'}`}>
                        {i === 0
                          ? <Star size={12} weight="fill" className={medal.textCls} />
                          : <span className={`text-[10px] font-bold ${medal ? medal.textCls : 'text-ink-3'}`}>{i + 1}</span>
                        }
                      </div>
                      <CategoryIcon categoryId={t.category} size={14} />
                      <div className="flex-1 min-w-0">
                        <p className="text-label font-medium text-ink truncate">{t.description}</p>
                        <p className="text-caption text-ink-3">{fmtDate(t.date)}</p>
                      </div>
                      <span className="text-label font-bold text-expense-text tabular-nums shrink-0">
                        {fmt(t.amount)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── 6. Spending by Category ──────────────────────────────── */}
          {catEntries.length > 0 && (
            <CategorySpendingChart
              entries={catEntries}
              total={categoryTotal}
            />
          )}

          {/* ── 7. Portfolio donut ───────────────────────────────────── */}
          {vehicleData.length > 0 && (
            <PortfolioDonut vehicleData={vehicleData} />
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
