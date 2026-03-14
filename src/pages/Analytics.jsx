import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { useYearSummary } from '../hooks/useTransactions'
import CategoryIcon from '../components/CategoryIcon'
import { fmt } from '../lib/utils'
import { CATEGORIES } from '../lib/categories'

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun',
                     'Jul','Aug','Sep','Oct','Nov','Dec']

// ── Apple-style tooltip ────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'rgba(255,255,255,0.95)',
      backdropFilter: 'blur(20px)',
      borderRadius: 12,
      padding: '10px 14px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.06)',
      minWidth: 130,
    }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: '#8E8E93',
                  letterSpacing: '0.04em', marginBottom: 6 }}>
        {label}
      </p>
      {payload.map(p => (
        <div key={p.name} style={{ display:'flex', justifyContent:'space-between',
                                   gap: 16, marginBottom: 3 }}>
          <span style={{ fontSize: 12, color: '#3C3C43' }}>{p.name}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: p.color }}>
            {fmt(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── KPI card ───────────────────────────────────────────────────────────────
function KpiCard({ label, value, prevValue, textCls, bg }) {
  const diff = prevValue ? value - prevValue : null
  const up   = diff > 0

  return (
    <div className="card p-4">
      <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-2`}>
        <span className={`text-xs font-bold ${textCls}`}>₹</span>
      </div>
      <p className="text-[11px] text-ink-3 font-medium">{label}</p>
      <p className={`text-[17px] font-bold ${textCls} mt-0.5 tabular-nums`}>{fmt(value)}</p>
      {diff !== null && Math.abs(diff) > 0 && (
        <div className={`flex items-center gap-1 mt-1.5
          ${up ? 'text-income-text' : 'text-expense-text'}`}>
          {up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          <span className="text-[10px] font-semibold">
            {fmt(Math.abs(diff))} vs {(new Date().getFullYear()) - 1}
          </span>
        </div>
      )}
    </div>
  )
}

export default function Analytics() {
  const now  = new Date()
  const [year, setYear] = useState(now.getFullYear())

  const { data, loading } = useYearSummary(year)
  const { data: prevData } = useYearSummary(year - 1)

  // Area chart data — only months with data
  const chartData = (data?.monthly || [])
    .map((m, i) => ({
      name:   MONTH_SHORT[i],
      Income: Math.round(m.income),
      Spent:  Math.round(m.expense),
      Invest: Math.round(m.investment),
    }))
    .filter(m => m.Income > 0 || m.Spent > 0 || m.Invest > 0)

  // Donut data
  const catData = Object.entries(data?.byCategory || {})
    .sort((a,b) => b[1]-a[1]).slice(0,6)
    .map(([id, val]) => ({
      id, val,
      name:  CATEGORIES.find(c=>c.id===id)?.label || id,
      color: CATEGORIES.find(c=>c.id===id)?.color || '#007AFF',
    }))
  const totalCatSpend = catData.reduce((s,c) => s+c.val, 0)

  // Portfolio
  const vehicleData = Object.entries(data?.byVehicle || {}).sort((a,b) => b[1]-a[1])
  const maxVehicle  = vehicleData[0]?.[1] || 1

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
        <motion.div key={year}
          initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
          transition={{ duration:0.25 }} className="space-y-4"
        >
          {/* ── Annual KPIs ── */}
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label="Total Earned"
              value={data?.totalIncome || 0}
              prevValue={prevData?.totalIncome}
              textCls="text-income-text" bg="bg-income-bg" />
            <KpiCard label="Total Spent"
              value={data?.totalExpense || 0}
              prevValue={prevData?.totalExpense}
              textCls="text-expense-text" bg="bg-expense-bg" />
            <KpiCard label="Total Invested"
              value={data?.totalInvestment || 0}
              prevValue={prevData?.totalInvestment}
              textCls="text-invest-text" bg="bg-invest-bg" />
            <div className="card p-4">
              <div className="w-8 h-8 rounded-lg bg-brand-container
                              flex items-center justify-center mb-2">
                <span className="text-xs font-bold text-brand">%</span>
              </div>
              <p className="text-[11px] text-ink-3 font-medium">Avg Savings Rate</p>
              <p className="text-[17px] font-bold text-brand mt-0.5">
                {data?.avgSavings || 0}%
              </p>
              {prevData?.avgSavings != null && (
                <div className={`flex items-center gap-1 mt-1.5
                  ${(data?.avgSavings||0) >= prevData.avgSavings
                    ? 'text-income-text' : 'text-expense-text'}`}>
                  {(data?.avgSavings||0) >= prevData.avgSavings
                    ? <TrendingUp size={10}/> : <TrendingDown size={10}/>}
                  <span className="text-[10px] font-semibold">
                    {Math.abs((data?.avgSavings||0) - prevData.avgSavings)}% vs last year
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Area chart — Apple Health style ── */}
          {chartData.length > 0 && (
            <div className="card p-4">
              <p className="section-label mb-1">Monthly Cash Flow</p>
              <p className="text-[12px] text-ink-3 mb-4">
                {chartData.length} months · tap to see details
              </p>

              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}
                  margin={{ top:8, right:4, left:4, bottom:0 }}>
                  <defs>
                    <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34C759" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#34C759" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gradSpent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FF3B30" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#FF3B30" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gradInvest" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#007AFF" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#007AFF" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize:11, fill:'#8E8E93', fontWeight:500 }}
                    axisLine={false} tickLine={false}
                    interval={0}
                  />
                  <YAxis hide />
                  <Tooltip
                    content={<CustomTooltip />}
                    cursor={{ stroke:'#E5E5EA', strokeWidth:1, strokeDasharray:'4 2' }}
                  />
                  <Area
                    type="monotone" dataKey="Income"
                    stroke="#34C759" strokeWidth={2}
                    fill="url(#gradIncome)"
                    dot={false} activeDot={{ r:4, fill:'#34C759', strokeWidth:0 }}
                  />
                  <Area
                    type="monotone" dataKey="Invest"
                    stroke="#007AFF" strokeWidth={2}
                    fill="url(#gradInvest)"
                    dot={false} activeDot={{ r:4, fill:'#007AFF', strokeWidth:0 }}
                  />
                  <Area
                    type="monotone" dataKey="Spent"
                    stroke="#FF3B30" strokeWidth={2}
                    fill="url(#gradSpent)"
                    dot={false} activeDot={{ r:4, fill:'#FF3B30', strokeWidth:0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>

              {/* Inline legend */}
              <div className="flex justify-center gap-5 mt-3">
                {[['Income','#34C759'],['Invest','#007AFF'],['Spent','#FF3B30']].map(([l,c]) => (
                  <div key={l} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background:c }} />
                    <span className="text-[12px] text-ink-2 font-medium">{l}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Spending by Category ── */}
          {catData.length > 0 && (
            <div className="card p-4">
              <p className="section-label mb-4">Spending by Category</p>

              {/* Centred donut */}
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <PieChart width={160} height={160}>
                    <Pie data={catData} dataKey="val"
                         cx={75} cy={75}
                         innerRadius={46} outerRadius={72}
                         strokeWidth={2} stroke="#F2F2F7"
                         startAngle={90} endAngle={-270}>
                      {catData.map((c,i) => <Cell key={i} fill={c.color} />)}
                    </Pie>
                  </PieChart>
                  {/* Centre label */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-[10px] text-ink-3 font-medium">Total</p>
                    <p className="text-[14px] font-bold text-expense-text tabular-nums">
                      {fmt(totalCatSpend)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Category list */}
              <div className="space-y-3">
                {catData.map(cat => (
                  <div key={cat.id}>
                    <div className="flex items-center gap-2 mb-1">
                      <CategoryIcon categoryId={cat.id} size={14} />
                      <span className="flex-1 text-[13px] text-ink font-medium truncate">
                        {cat.name}
                      </span>
                      <span className="text-[13px] font-semibold text-ink tabular-nums">
                        {fmt(cat.val)}
                      </span>
                      <span className="text-[11px] text-ink-3 w-8 text-right">
                        {totalCatSpend > 0 ? Math.round((cat.val/totalCatSpend)*100) : 0}%
                      </span>
                    </div>
                    <div className="bar-light-track">
                      <motion.div className="bar-light-fill"
                        initial={{ width:0 }}
                        animate={{ width:`${totalCatSpend > 0 ? (cat.val/totalCatSpend)*100 : 0}%` }}
                        transition={{ duration:0.6, ease:'easeOut' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Investment Portfolio ── */}
          {vehicleData.length > 0 && (
            <div className="card p-4">
              <p className="section-label mb-4">Investment Portfolio</p>
              <div className="space-y-4">
                {vehicleData.map(([vehicle, amt]) => (
                  <div key={vehicle}>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-[14px] font-medium text-ink">{vehicle}</span>
                      <span className="text-[14px] font-bold text-invest-text tabular-nums">
                        {fmt(amt)}
                      </span>
                    </div>
                    <div className="bar-light-track">
                      <motion.div className="bar-light-fill"
                        initial={{ width:0 }}
                        animate={{ width:`${(amt/maxVehicle)*100}%` }}
                        transition={{ duration:0.6, ease:'easeOut' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!data?.totalIncome && !data?.totalExpense && (
            <div className="card p-8 text-center">
              <p className="text-ink-3 text-[15px]">No data for {year}.</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
