import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { useYearSummary } from '../hooks/useTransactions'
import { fmt, savingsRate } from '../lib/utils'
import { CATEGORIES } from '../lib/categories'
import CategoryIcon from '../components/CategoryIcon'

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

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

// Month summary cards replacing bar chart
function MonthlySummaryCards({ monthly }) {
  const active = monthly.filter(m => m.income > 0 || m.expense > 0 || m.investment > 0)
  if (active.length === 0) return (
    <p className="text-ink-4 text-[13px] text-center py-4">No monthly data</p>
  )
  return (
    <div className="space-y-2">
      {active.map((m, i) => {
        const prev = i > 0 ? active[i-1] : null
        const incDiff  = prev ? m.income     - prev.income     : null
        const expDiff  = prev ? m.expense    - prev.expense    : null
        const invDiff  = prev ? m.investment - prev.investment : null
        return (
          <div key={m.month} className="card p-4">
            {/* Month label */}
            <p className="text-[12px] font-semibold text-ink-3 mb-3 tracking-wide">
              {MONTH_SHORT[m.month-1].toUpperCase()}
            </p>
            {/* 3 stat cards in a row */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label:'Income',  val:m.income,     cls:'text-income-text',  bg:'bg-income-bg',  diff:incDiff },
                { label:'Spent',   val:m.expense,    cls:'text-expense-text', bg:'bg-expense-bg', diff:expDiff },
                { label:'Invest',  val:m.investment, cls:'text-invest-text',  bg:'bg-invest-bg',  diff:invDiff },
              ].map(s => (
                <div key={s.label} className={`rounded-card p-2.5 ${s.bg}`}>
                  <p className="text-[10px] text-ink-3 font-medium mb-0.5">{s.label}</p>
                  <p className={`text-[13px] font-bold tabular-nums ${s.cls}`}>{fmt(s.val)}</p>
                  {s.diff !== null && s.diff !== 0 && (
                    <div className="flex items-center gap-0.5 mt-0.5">
                      {s.diff > 0
                        ? <TrendingUp size={9} className="text-income-text" />
                        : <TrendingDown size={9} className="text-expense-text" />
                      }
                      <span className={`text-[9px] font-medium ${s.diff > 0 ? 'text-income-text' : 'text-expense-text'}`}>
                        {fmt(Math.abs(s.diff))}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

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

  const vehicleData    = Object.entries(data?.byVehicle || {}).sort((a,b) => b[1]-a[1])
  const maxVehicle     = vehicleData[0]?.[1] || 1
  const totalExpense   = data?.totalExpense || 0

  return (
    <div className="page">
      {/* Year navigator */}
      <div className="flex items-center justify-between mb-4 pt-2">
        <button onClick={() => setYear(y=>y-1)}
          className="w-9 h-9 rounded-full bg-kosha-surface border border-kosha-border
                     flex items-center justify-center active:bg-kosha-surface-2">
          <ChevronLeft size={18} className="text-ink-2" />
        </button>
        <h1 className="text-[28px] font-bold text-ink tracking-tight">{year}</h1>
        <button onClick={() => setYear(y=>y+1)}
          className="w-9 h-9 rounded-full bg-kosha-surface border border-kosha-border
                     flex items-center justify-center active:bg-kosha-surface-2">
          <ChevronRight size={18} className="text-ink-2" />
        </button>
      </div>

      {loading ? (
        <div className="card p-8 text-center">
          <p className="text-ink-3 text-[15px]">Loading…</p>
        </div>
      ) : (
        <motion.div
          key={year}
          initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
          transition={{ duration:0.25 }}
          className="space-y-4"
        >
          {/* Year KPI grid */}
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

          {/* Monthly summary cards */}
          <div>
            <p className="section-label mb-3">Monthly Breakdown</p>
            <MonthlySummaryCards monthly={data?.monthly || []} />
          </div>

          {/* Spending by category donut */}
          {catData.length > 0 && (
            <div className="card p-4">
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
                    const pct = totalExpense > 0 ? Math.round((c.val/totalExpense)*100) : 0
                    return (
                      <div key={c.id}>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ background:c.color }} />
                          <span className="text-[12px] text-ink flex-1 truncate">{c.name}</span>
                          <span className="text-[12px] font-semibold text-ink tabular-nums">{fmt(c.val)}</span>
                        </div>
                        <div className="bar-light-track">
                          <motion.div
                            className="bar-light-fill"
                            initial={{ width:0 }}
                            animate={{ width:`${pct}%` }}
                            transition={{ duration:0.6, ease:'easeOut' }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Investment portfolio */}
          {vehicleData.length > 0 && (
            <div className="card p-4">
              <p className="section-label mb-3">Investment Portfolio</p>
              <div className="space-y-3">
                {vehicleData.map(([vehicle, amt]) => {
                  const pct = Math.round((amt / maxVehicle) * 100)
                  return (
                    <div key={vehicle}>
                      <div className="flex justify-between mb-1.5">
                        <span className="text-[13px] font-medium text-ink">{vehicle}</span>
                        <span className="text-[13px] font-semibold text-invest-text tabular-nums">
                          {fmt(amt)}
                        </span>
                      </div>
                      <div className="bar-light-track">
                        <motion.div
                          className="bar-light-fill"
                          initial={{ width:0 }}
                          animate={{ width:`${pct}%` }}
                          transition={{ duration:0.6, ease:'easeOut' }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* No data */}
          {!data?.totalIncome && !data?.totalExpense && (
            <div className="card p-8 text-center">
              <p className="text-ink-2 text-[15px]">No data for {year}.</p>
              <p className="text-ink-4 text-[13px] mt-1">Navigate to a year with transactions.</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
