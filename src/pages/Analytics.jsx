import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useYearSummary } from '../hooks/useTransactions'
import { fmt, savingsRate } from '../lib/utils'
import { CATEGORIES } from '../lib/categories'
import CategoryIcon from '../components/CategoryIcon'

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ── Compact top-level KPI card ─────────────────────────────────────────────
function KpiCard({ label, value, cls, bg, diff, diffLabel }) {
  const up      = diff > 0
  const neutral = diff === 0 || diff === null || diff === undefined
  return (
    <div className="card p-4">
      <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-2`}>
        <span className={`text-xs font-bold ${cls}`}>₹</span>
      </div>
      <p className="text-[11px] text-ink-3 font-medium">{label}</p>
      <p className={`text-[17px] font-bold ${cls} mt-0.5 tabular-nums`}>{fmt(value)}</p>
      {diff !== null && diff !== undefined && (
        <div className="flex items-center gap-1 mt-1">
          {neutral
            ? <Minus size={11} className="text-ink-4" />
            : up
              ? <TrendingUp size={11} className="text-income-text" />
              : <TrendingDown size={11} className="text-expense-text" />
          }
          <span className={`text-[10px] font-medium ${
            neutral ? 'text-ink-4' : up ? 'text-income-text' : 'text-expense-text'
          }`}>{diffLabel}</span>
        </div>
      )}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-kosha-surface border border-kosha-border rounded-card px-3 py-2 shadow-card text-xs">
      <p className="font-semibold text-ink mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.fill }}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  )
}

// ── Pill badge for MoM change ──────────────────────────────────────────────
function DiffBadge({ diff }) {
  if (diff === null || diff === undefined || diff === 0) return null
  const up = diff > 0
  const pct = Math.round(Math.abs(diff) / 100) // approximate, for display
  return (
    <span className={`inline-flex items-center gap-0.5 text-[9px] font-semibold px-1.5 py-0.5 rounded-full
      ${up ? 'bg-income-bg text-income-text' : 'bg-expense-bg text-expense-text'}`}>
      {up ? <ArrowUpRight size={8} /> : <ArrowDownRight size={8} />}
      {fmt(Math.abs(diff))}
    </span>
  )
}

// ── Beautiful monthly card ─────────────────────────────────────────────────
function MonthCard({ m, prev, isFirst }) {
  const incDiff = prev ? m.income     - prev.income     : null
  const expDiff = prev ? m.expense    - prev.expense    : null
  const invDiff = prev ? m.investment - prev.investment : null

  const savings = m.income - m.expense - m.investment
  const savRate = m.income > 0 ? Math.round((savings / m.income) * 100) : 0
  const savPositive = savings >= 0

  const total = m.income + m.expense + m.investment
  const incPct = total > 0 ? (m.income / total) * 100 : 0
  const expPct = total > 0 ? (m.expense / total) * 100 : 0
  const invPct = total > 0 ? (m.investment / total) * 100 : 0

  return (
    <motion.div
      className="card overflow-hidden"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: isFirst ? 0 : 0.05 }}
    >
      {/* Month header row */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-kosha-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-chip bg-brand-container flex items-center justify-center">
            <span className="text-[11px] font-bold text-brand">{MONTH_SHORT[m.month-1]}</span>
          </div>
          <div>
            <p className="text-[14px] font-bold text-ink leading-tight">
              {MONTH_SHORT[m.month-1]}
            </p>
            <p className="text-[10px] text-ink-4 leading-none">
              {m.income > 0 || m.expense > 0 ? 'Active' : 'No data'}
            </p>
          </div>
        </div>

        {/* Savings rate pill */}
        <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold
          ${savPositive ? 'bg-income-bg text-income-text' : 'bg-expense-bg text-expense-text'}`}>
          {savPositive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {savRate}% saved
        </div>
      </div>

      {/* Three stat rows */}
      <div className="px-4 py-3 space-y-2.5">

        {/* Income row */}
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-income-text shrink-0" />
          <span className="text-[12px] text-ink-3 w-14 shrink-0">Income</span>
          {/* Progress bar */}
          <div className="flex-1 h-1.5 bg-kosha-surface-2 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-income-text rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${incPct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
          <span className="text-[13px] font-semibold text-income-text tabular-nums w-20 text-right shrink-0">
            {fmt(m.income)}
          </span>
          <div className="w-16 flex justify-end shrink-0">
            <DiffBadge diff={incDiff} />
          </div>
        </div>

        {/* Expense row */}
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-expense-text shrink-0" />
          <span className="text-[12px] text-ink-3 w-14 shrink-0">Spent</span>
          <div className="flex-1 h-1.5 bg-kosha-surface-2 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-expense-text rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${expPct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.05 }}
            />
          </div>
          <span className="text-[13px] font-semibold text-expense-text tabular-nums w-20 text-right shrink-0">
            {fmt(m.expense)}
          </span>
          <div className="w-16 flex justify-end shrink-0">
            <DiffBadge diff={expDiff} />
          </div>
        </div>

        {/* Investment row */}
        {m.investment > 0 && (
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-invest-text shrink-0" />
            <span className="text-[12px] text-ink-3 w-14 shrink-0">Invested</span>
            <div className="flex-1 h-1.5 bg-kosha-surface-2 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-invest-text rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${invPct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
              />
            </div>
            <span className="text-[13px] font-semibold text-invest-text tabular-nums w-20 text-right shrink-0">
              {fmt(m.investment)}
            </span>
            <div className="w-16 flex justify-end shrink-0">
              <DiffBadge diff={invDiff} />
            </div>
          </div>
        )}
      </div>

      {/* Net savings footer */}
      <div className={`mx-4 mb-4 px-3 py-2 rounded-card flex items-center justify-between
        ${savPositive ? 'bg-income-bg' : 'bg-expense-bg'}`}>
        <span className="text-[11px] font-medium text-ink-3">Net savings</span>
        <span className={`text-[13px] font-bold tabular-nums ${savPositive ? 'text-income-text' : 'text-expense-text'}`}>
          {savings >= 0 ? '+' : ''}{fmt(savings)}
        </span>
      </div>
    </motion.div>
  )
}

// ── Monthly breakdown section ──────────────────────────────────────────────
function MonthlySummaryCards({ monthly }) {
  const active = monthly.filter(m => m.income > 0 || m.expense > 0 || m.investment > 0)
  if (active.length === 0) return (
    <p className="text-ink-4 text-[13px] text-center py-4">No monthly data</p>
  )
  return (
    <div className="space-y-3">
      {active.map((m, i) => (
        <MonthCard
          key={m.month}
          m={m}
          prev={i > 0 ? active[i-1] : null}
          isFirst={i === 0}
        />
      ))}
    </div>
  )
}

// ── Main Analytics page ────────────────────────────────────────────────────
export default function Analytics() {
  const now  = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const { data, loading } = useYearSummary(year)

  const catData = Object.entries(data?.byCategory || {})
    .sort((a,b) => b[1]-a[1]).slice(0,6)
    .map(([id, val]) => ({
      id, val,
      name:  CATEGORIES.find(c=>c.id===id)?.label || id,
      color: CATEGORIES.find(c=>c.id===id)?.color || '#007AFF',
    }))

  const vehicleData  = Object.entries(data?.byVehicle || {}).sort((a,b) => b[1]-a[1])
  const maxVehicle   = vehicleData[0]?.[1] || 1
  const totalExpense = data?.totalExpense || 0

  const fadeUp = {
    hidden: { opacity:0, y:10 },
    show:   { opacity:1, y:0, transition:{ duration:0.25 } },
  }

  return (
    <div className="page">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 pt-1">
        <h1 className="font-display text-display text-ink">Insights</h1>
        {/* Year stepper */}
        <div className="flex items-center gap-1 bg-kosha-surface-2 rounded-pill px-1 py-1">
          <button
            onClick={() => setYear(y => y - 1)}
            className="w-7 h-7 flex items-center justify-center rounded-full active:bg-kosha-border transition-colors"
          >
            <ChevronLeft size={16} className="text-ink-2" />
          </button>
          <span className="text-[14px] font-semibold text-ink tabular-nums px-1">{year}</span>
          <button
            onClick={() => setYear(y => Math.min(y + 1, now.getFullYear()))}
            disabled={year >= now.getFullYear()}
            className="w-7 h-7 flex items-center justify-center rounded-full active:bg-kosha-border transition-colors disabled:opacity-30"
          >
            <ChevronRight size={16} className="text-ink-2" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card p-8 text-center">
          <p className="text-ink-3 text-[15px]">Loading…</p>
        </div>
      ) : (
        <motion.div
          key={year}
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.07 } } }}
          className="space-y-4"
        >
          {/* ── Year KPI grid ── */}
          <motion.div variants={fadeUp}>
            <p className="section-label mb-3">Year at a Glance</p>
            <div className="grid grid-cols-2 gap-3">
              <KpiCard
                label="Total Earned"   value={data?.totalIncome     || 0}
                cls="text-income-text"  bg="bg-income-bg"
                diff={null}
              />
              <KpiCard
                label="Total Spent"    value={data?.totalExpense    || 0}
                cls="text-expense-text" bg="bg-expense-bg"
                diff={null}
              />
              <KpiCard
                label="Total Invested" value={data?.totalInvestment || 0}
                cls="text-invest-text"  bg="bg-invest-bg"
                diff={null}
              />
              <div className="card p-4">
                <div className="w-8 h-8 rounded-lg bg-brand-container flex items-center justify-center mb-2">
                  <span className="text-xs font-bold text-brand">%</span>
                </div>
                <p className="text-[11px] text-ink-3 font-medium">Avg Savings Rate</p>
                <p className="text-[17px] font-bold text-brand mt-0.5">
                  {data?.avgSavings || 0}%
                </p>
              </div>
            </div>
          </motion.div>

          {/* ── Monthly Breakdown ── */}
          <motion.div variants={fadeUp}>
            <p className="section-label mb-3">Monthly Breakdown</p>
            <MonthlySummaryCards monthly={data?.monthly || []} />
          </motion.div>

          {/* ── Spending by category donut ── */}
          {catData.length > 0 && (
            <motion.div variants={fadeUp} className="card p-4">
              <p className="section-label mb-4">Spending by Category</p>
              <div className="flex gap-4 items-center">
                <div className="shrink-0">
                  <PieChart width={110} height={110}>
                    <Pie
                      data={catData} dataKey="val"
                      cx={50} cy={50}
                      innerRadius={30} outerRadius={50}
                      strokeWidth={0}
                    >
                      {catData.map((c,i) => <Cell key={i} fill={c.color} />)}
                    </Pie>
                    <Tooltip
                      formatter={(v) => fmt(v)}
                      contentStyle={{
                        background:'#fff', border:'0.5px solid #E5E5EA',
                        borderRadius:8, fontSize:12,
                      }}
                    />
                  </PieChart>
                </div>
                <div className="flex-1 space-y-2.5">
                  {catData.map(c => {
                    const pct = totalExpense > 0 ? Math.round((c.val / totalExpense) * 100) : 0
                    return (
                      <div key={c.id} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.color }} />
                        <span className="flex-1 text-[12px] text-ink truncate">{c.name}</span>
                        <span className="text-[11px] font-semibold text-ink-3 tabular-nums">{pct}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Investment portfolio ── */}
          {vehicleData.length > 0 && (
            <motion.div variants={fadeUp} className="card p-4">
              <p className="section-label mb-4">Portfolio Breakdown</p>
              <div className="space-y-3">
                {vehicleData.map(([vehicle, val]) => (
                  <div key={vehicle}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[13px] text-ink">{vehicle}</span>
                      <span className="text-[13px] font-semibold text-invest-text tabular-nums">{fmt(val)}</span>
                    </div>
                    <div className="h-1.5 bg-kosha-surface-2 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-invest-text rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${(val / maxVehicle) * 100}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

        </motion.div>
      )}
    </div>
  )
}
