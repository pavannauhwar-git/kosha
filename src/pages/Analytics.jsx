import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ReferenceLine,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { useYearSummary } from '../hooks/useTransactions'
import { supabase } from '../lib/supabase'
import CategoryIcon from '../components/CategoryIcon'
import { fmt, fmtDate } from '../lib/utils'
import { CATEGORIES } from '../lib/categories'

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun',
                     'Jul','Aug','Sep','Oct','Nov','Dec']
const YEARS = [2023, 2024, 2025, 2026]

// ── Apple frosted glass tooltip ────────────────────────────────────────────
const AppleTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'rgba(255,255,255,0.96)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderRadius: 12,
      padding: '10px 14px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.06)',
      minWidth: 140,
    }}>
      <p style={{ fontSize:11, fontWeight:600, color:'#8E8E93',
                  letterSpacing:'0.04em', marginBottom:6, textTransform:'uppercase' }}>
        {label}
      </p>
      {payload.map(p => (
        <div key={p.name} style={{ display:'flex', justifyContent:'space-between',
                                   gap:16, marginBottom:3 }}>
          <span style={{ fontSize:12, color:'#3C3C43' }}>{p.name}</span>
          <span style={{ fontSize:12, fontWeight:700, color: p.color || p.fill }}>
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
      {diff !== null && Math.abs(diff) > 100 && (
        <div className={`flex items-center gap-1 mt-1.5
          ${up ? 'text-income-text' : 'text-expense-text'}`}>
          {up ? <TrendingUp size={10}/> : <TrendingDown size={10}/>}
          <span className="text-[10px] font-semibold">
            {fmt(Math.abs(diff))} vs prev year
          </span>
        </div>
      )}
    </div>
  )
}

// ── Spending trend pill ────────────────────────────────────────────────────
function TrendPill({ current, previous, label }) {
  if (!previous || previous === 0) return null
  const pct  = Math.round(((current - previous) / previous) * 100)
  const up   = pct > 0
  const same = Math.abs(pct) < 3
  if (same) return (
    <span className="chip-neutral text-[11px]">≈ Stable {label}</span>
  )
  return (
    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full
      ${up ? 'bg-expense-bg text-expense-text' : 'bg-income-bg text-income-text'}`}>
      {up ? '↑' : '↓'} {Math.abs(pct)}% {label}
    </span>
  )
}

export default function Analytics() {
  const now  = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [top5, setTop5] = useState([])

  const { data, loading }      = useYearSummary(year)
  const { data: prevData }     = useYearSummary(year - 1)

  // Fetch top 5 biggest expenses for selected year
  useEffect(() => {
    async function loadTop5() {
      const { data: rows } = await supabase
        .from('transactions')
        .select('id, date, description, amount, category')
        .eq('type', 'expense')
        .gte('date', `${year}-01-01`)
        .lte('date', `${year}-12-31`)
        .order('amount', { ascending: false })
        .limit(5)
      setTop5(rows || [])
    }
    loadTop5()
  }, [year])

  // Area chart — only months with data, linear for sparse sets
  const chartData = (data?.monthly || [])
    .map((m, i) => ({
      name:   MONTH_SHORT[i],
      Income: Math.round(m.income),
      Spent:  Math.round(m.expense),
      Invest: Math.round(m.investment),
    }))
    .filter(m => m.Income > 0 || m.Spent > 0 || m.Invest > 0)

  const curveType = chartData.length <= 4 ? 'linear' : 'monotone'
  const chartH    = chartData.length <= 4 ? 140 : 180

  // Net savings per month (income - expense - investment)
  const netData = (data?.monthly || [])
    .map((m, i) => ({
      name: MONTH_SHORT[i],
      Net:  Math.round(m.income - m.expense - m.investment),
    }))
    .filter(m => m.Net !== 0)

  // YoY comparison — all 4 years
  const yoyYears = YEARS.filter(y => y <= now.getFullYear())

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

  // Spending trend pills
  const recentMonths = (data?.monthly || []).filter(m => m.expense > 0)
  const lastTwo      = recentMonths.slice(-2)
  const spendTrend   = lastTwo.length === 2 ? { current: lastTwo[1].expense, previous: lastTwo[0].expense } : null

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

          {/* ── 1. Annual KPIs ── */}
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
              <p className="text-[17px] font-bold text-brand mt-0.5">{data?.avgSavings || 0}%</p>
              {spendTrend && (
                <div className="mt-2">
                  <TrendPill
                    current={spendTrend.current}
                    previous={spendTrend.previous}
                    label="spend"
                  />
                </div>
              )}
            </div>
          </div>

          {/* ── 2. Cash Flow area chart ── */}
          {chartData.length > 0 && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="section-label">Monthly Cash Flow</p>
                <span className="text-[11px] text-ink-3">
                  {chartData.length} months
                </span>
              </div>
              <p className="text-[12px] text-ink-3 mb-4">Tap chart to see details</p>

              <ResponsiveContainer width="100%" height={chartH}>
                <AreaChart data={chartData}
                  margin={{ top:8, right:4, left:4, bottom:0 }}>
                  <defs>
                    <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34C759" stopOpacity={0.20}/>
                      <stop offset="100%" stopColor="#34C759" stopOpacity={0.02}/>
                    </linearGradient>
                    <linearGradient id="gSpent" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FF3B30" stopOpacity={0.20}/>
                      <stop offset="100%" stopColor="#FF3B30" stopOpacity={0.02}/>
                    </linearGradient>
                    <linearGradient id="gInvest" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#007AFF" stopOpacity={0.20}/>
                      <stop offset="100%" stopColor="#007AFF" stopOpacity={0.02}/>
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name"
                    tick={{ fontSize:11, fill:'#8E8E93', fontWeight:500 }}
                    axisLine={false} tickLine={false} interval={0}
                  />
                  <YAxis hide />
                  <Tooltip content={<AppleTooltip />}
                    cursor={{ stroke:'#E5E5EA', strokeWidth:1, strokeDasharray:'4 2' }}
                  />
                  <Area type={curveType} dataKey="Income"
                    stroke="#34C759" strokeWidth={2} fill="url(#gIncome)"
                    dot={false} activeDot={{ r:4, fill:'#34C759', strokeWidth:0 }}
                  />
                  <Area type={curveType} dataKey="Invest"
                    stroke="#007AFF" strokeWidth={2} fill="url(#gInvest)"
                    dot={false} activeDot={{ r:4, fill:'#007AFF', strokeWidth:0 }}
                  />
                  <Area type={curveType} dataKey="Spent"
                    stroke="#FF3B30" strokeWidth={2} fill="url(#gSpent)"
                    dot={false} activeDot={{ r:4, fill:'#FF3B30', strokeWidth:0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>

              <div className="flex justify-center gap-5 mt-3">
                {[['Income','#34C759'],['Invest','#007AFF'],['Spent','#FF3B30']].map(([l,c]) => (
                  <div key={l} className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background:c }}/>
                    <span className="text-[12px] text-ink-2 font-medium">{l}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 3. Net Savings per month ── */}
          {netData.length > 0 && (
            <div className="card p-4">
              <p className="section-label mb-1">Net Savings</p>
              <p className="text-[12px] text-ink-3 mb-4">
                After expenses & investments · green = saved, red = overspent
              </p>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={netData}
                  margin={{ top:4, right:4, left:4, bottom:0 }}>
                  <XAxis dataKey="name"
                    tick={{ fontSize:11, fill:'#8E8E93', fontWeight:500 }}
                    axisLine={false} tickLine={false} interval={0}
                  />
                  <YAxis hide />
                  <Tooltip content={<AppleTooltip />}
                    cursor={{ fill:'rgba(0,0,0,0.04)' }}
                  />
                  <ReferenceLine y={0} stroke="#E5E5EA" strokeWidth={1} />
                  <Bar dataKey="Net" radius={[4,4,0,0]} maxBarSize={32}>
                    {netData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.Net >= 0 ? '#34C759' : '#FF3B30'}
                        fillOpacity={0.85}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── 4. Year-over-year comparison ── */}
          <YoYTable years={yoyYears} currentYear={year} />

          {/* ── 5. Top 5 biggest expenses ── */}
          {top5.length > 0 && (
            <div className="card p-4">
              <p className="section-label mb-4">Top Expenses {year}</p>
              <div className="space-y-0 overflow-hidden rounded-card">
                {top5.map((t, i) => (
                  <div key={t.id}
                    className={`flex items-center gap-3 py-3 px-1
                      ${i < top5.length - 1 ? 'border-b border-kosha-border' : ''}`}
                  >
                    <div className="w-6 h-6 rounded-full bg-kosha-surface-2 flex items-center
                                    justify-center shrink-0">
                      <span className="text-[11px] font-bold text-ink-3">{i+1}</span>
                    </div>
                    <CategoryIcon categoryId={t.category} size={14} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-ink truncate">
                        {t.description}
                      </p>
                      <p className="text-[11px] text-ink-3">{fmtDate(t.date)}</p>
                    </div>
                    <span className="text-[14px] font-bold text-expense-text tabular-nums shrink-0">
                      {fmt(t.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 6. Spending by Category ── */}
          {catData.length > 0 && (
            <div className="card p-4">
              <p className="section-label mb-4">Spending by Category</p>
              <div className="flex justify-center mb-5">
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
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <p className="text-[10px] text-ink-3 font-medium">Total</p>
                    <p className="text-[13px] font-bold text-expense-text tabular-nums">
                      {fmt(totalCatSpend)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {catData.map(cat => (
                  <div key={cat.id}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <CategoryIcon categoryId={cat.id} size={14} />
                      <span className="flex-1 text-[13px] text-ink font-medium truncate">
                        {cat.name}
                      </span>
                      <span className="text-[11px] text-ink-3 tabular-nums w-8 text-right">
                        {totalCatSpend > 0 ? Math.round((cat.val/totalCatSpend)*100) : 0}%
                      </span>
                      <span className="text-[13px] font-semibold text-ink tabular-nums">
                        {fmt(cat.val)}
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

          {/* ── 7. Investment Portfolio ── */}
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

// ── Year-over-year comparison table ───────────────────────────────────────
function YoYTable({ years, currentYear }) {
  const [allData, setAllData] = useState({})

  useEffect(() => {
    // Fetch summaries for all years concurrently
    years.forEach(y => {
      supabase.from('transactions').select('type, amount, date, is_repayment')
        .gte('date', `${y}-01-01`).lte('date', `${y}-12-31`)
        .then(({ data: rows }) => {
          if (!rows) return
          const income = rows.filter(r=>r.type==='income'&&!r.is_repayment).reduce((s,r)=>s+ +r.amount,0)
          const spent  = rows.filter(r=>r.type==='expense').reduce((s,r)=>s+ +r.amount,0)
          const invest = rows.filter(r=>r.type==='investment').reduce((s,r)=>s+ +r.amount,0)
          const rate   = income > 0 ? Math.round(((income-spent)/income)*100) : 0
          setAllData(prev => ({ ...prev, [y]: { income, spent, invest, rate } }))
        })
    })
  }, [years.join(',')])

  const yearsWithData = years.filter(y => allData[y]?.income > 0 || allData[y]?.spent > 0)
  if (yearsWithData.length < 2) return null

  return (
    <div className="card p-4">
      <p className="section-label mb-4">Year over Year</p>
      <div className="overflow-x-auto no-scrollbar">
        <table className="w-full" style={{ minWidth: 320 }}>
          <thead>
            <tr>
              <td className="text-[11px] text-ink-3 font-medium pb-3 w-20"></td>
              {yearsWithData.map(y => (
                <td key={y}
                  className={`text-[12px] font-bold pb-3 text-center tabular-nums
                    ${y === currentYear ? 'text-brand' : 'text-ink'}`}>
                  {y}
                </td>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-kosha-border">
            {[
              { label:'Earned',  key:'income',  cls:'text-income-text'  },
              { label:'Spent',   key:'spent',   cls:'text-expense-text' },
              { label:'Invested',key:'invest',  cls:'text-invest-text'  },
              { label:'Savings', key:'rate',    cls:'text-brand', suffix:'%' },
            ].map(row => (
              <tr key={row.key}>
                <td className="text-[12px] text-ink-2 py-2.5 font-medium">{row.label}</td>
                {yearsWithData.map(y => {
                  const val = allData[y]?.[row.key] ?? '—'
                  const display = val === '—' ? '—'
                    : row.suffix ? `${val}%`
                    : fmt(val)
                  return (
                    <td key={y}
                      className={`text-[12px] font-semibold py-2.5 text-center tabular-nums
                        ${y === currentYear ? row.cls : 'text-ink-2'}`}>
                      {display}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
