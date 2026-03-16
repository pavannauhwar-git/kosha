import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react'
import {
  AreaChart, Area,
  BarChart, Bar,
  XAxis, YAxis, Tooltip, ReferenceLine,
  ResponsiveContainer, Cell,
  PieChart, Pie,
} from 'recharts'
import { useYearSummary } from '../hooks/useTransactions'
import { supabase } from '../lib/supabase'
import CategoryIcon from '../components/CategoryIcon'
import { fmt, fmtDate } from '../lib/utils'
import { C } from '../lib/colors'
import { CATEGORIES } from '../lib/categories'

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun',
                     'Jul','Aug','Sep','Oct','Nov','Dec']
const YEARS = [2023, 2024, 2025, 2026]

// Portfolio colours — green family, darkest to lightest
const PORTFOLIO_COLORS = C.portfolio

// ── Light tooltip (KPI cards, net savings) ───────────────────────────────
const AppleTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'rgba(255,255,255,0.98)',
      borderRadius: 12,
      padding: '10px 14px',
      boxShadow: '0 4px 20px rgba(30,27,75,0.14), 0 0 0 0.5px rgba(30,27,75,0.08)',
      minWidth: 140,
    }}>
      <p style={{ fontSize:12, fontWeight:600, color:C.inkMuted,
                  letterSpacing:'0.04em', marginBottom:6, textTransform:'uppercase' }}>
        {label}
      </p>
      {payload.map(p => (
        <div key={p.name} style={{ display:'flex', justifyContent:'space-between', gap:16, marginBottom:3 }}>
          <span style={{ fontSize:13, color:C.ink }}>{p.name}</span>
          <span style={{ fontSize:13, fontWeight:700, color:p.fill || p.color }}>
            {fmt(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Dark tooltip (on dark chart card) ────────────────────────────────────
const DarkTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'rgba(48,42,110,0.96)',
      borderRadius: 12,
      padding: '10px 14px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
      minWidth: 140,
      border: '0.5px solid rgba(255,255,255,0.10)',
    }}>
      <p style={{ fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.5)',
                  letterSpacing:'0.04em', marginBottom:6, textTransform:'uppercase' }}>
        {label}
      </p>
      {payload.map(p => (
        <div key={p.name} style={{ display:'flex', justifyContent:'space-between', gap:16, marginBottom:3 }}>
          <span style={{ fontSize:13, color:'rgba(255,255,255,0.75)' }}>{p.name}</span>
          <span style={{ fontSize:13, fontWeight:700, color:p.stroke || p.fill || p.color }}>
            {fmt(p.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── KPI card ──────────────────────────────────────────────────────────────
function KpiCard({ label, value, prevValue, textCls, bg }) {
  const diff = prevValue != null ? value - prevValue : null
  const up   = diff > 0
  return (
    <div className="card p-4">
      <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-3`}>
        <span className={`text-label font-bold ${textCls}`}>₹</span>
      </div>
      <p className="text-label text-ink-3 font-medium mb-0.5">{label}</p>
      <p className={`text-value font-bold ${textCls} tabular-nums`}>{fmt(value)}</p>
      {diff !== null && Math.abs(diff) > 100 && (
        <div className={`flex items-center gap-1 mt-2 ${up ? 'text-income-text' : 'text-expense-text'}`}>
          {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          <span className="text-caption font-semibold">{fmt(Math.abs(diff))} vs prev year</span>
        </div>
      )}
    </div>
  )
}

// ── Trend pill ────────────────────────────────────────────────────────────
function TrendPill({ current, previous, label }) {
  if (!previous || previous === 0) return null
  const pct  = Math.round(((current - previous) / previous) * 100)
  const up   = pct > 0
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

  useEffect(() => {
    years.forEach(y => {
      supabase.from('transactions')
        .select('type, amount, date, is_repayment')
        .gte('date', `${y}-01-01`)
        .lte('date', `${y}-12-31`)
        .then(({ data: rows }) => {
          if (!rows) return
          const income = rows.filter(r => r.type === 'income' && !r.is_repayment).reduce((s, r) => s + +r.amount, 0)
          const spent  = rows.filter(r => r.type === 'expense').reduce((s, r) => s + +r.amount, 0)
          const invest = rows.filter(r => r.type === 'investment').reduce((s, r) => s + +r.amount, 0)
          const rate   = income > 0 ? Math.round(((income - spent) / income) * 100) : 0
          setAllData(prev => ({ ...prev, [y]: { income, spent, invest, rate } }))
        })
    })
  }, [years.join(',')])

  const yearsWithData = years.filter(y => allData[y]?.income > 0 || allData[y]?.spent > 0)
  if (yearsWithData.length < 2) return null

  return (
    <div className="space-y-3">
      <p className="section-label">Year over Year</p>
      {yearsWithData.map((y, idx) => {
        const d    = allData[y]
        const prev = allData[yearsWithData[idx - 1]]
        const isCurrent = y === currentYear

        function delta(curr, prv) {
          if (!prv || prv === 0) return null
          return Math.round(((curr - prv) / prv) * 100)
        }

        return (
          <div key={y}
            className={`card p-4 ${isCurrent ? 'border-brand' : ''}`}
            style={isCurrent ? { borderWidth:'1.5px' } : {}}
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
                { label:'Earned',   key:'income', cls: isCurrent ? 'text-income-text' : 'text-ink-3' },
                { label:'Spent',    key:'spent',  cls: isCurrent ? 'text-expense-text': 'text-ink-3' },
                { label:'Invested', key:'invest', cls: isCurrent ? 'text-invest-text' : 'text-ink-3' },
                { label:'Saved',    key:'rate',   cls: isCurrent ? 'text-brand'        : 'text-ink-3', suffix:'%' },
              ].map(row => {
                const val   = d?.[row.key] ?? 0
                const prevV = prev?.[row.key]
                const d2    = delta(val, prevV)
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
  const total    = vehicleData.reduce((s, [, v]) => s + v, 0) || 1
  const pieData  = vehicleData.map(([name, value]) => ({ name, value }))

  return (
    <div className="card p-5">
      <p className="section-label mb-4">Portfolio Allocation</p>
      <div className="flex items-center gap-4">
        <div className="relative shrink-0" style={{ width:130, height:130 }}>
          <PieChart width={130} height={130}>
            <Pie
              data={pieData}
              cx={65} cy={65}
              innerRadius={42} outerRadius={60}
              dataKey="value"
              strokeWidth={0}
              paddingAngle={2}
            >
              {pieData.map((_, i) => (
                <Cell key={i} fill={PORTFOLIO_COLORS[i % PORTFOLIO_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[12px] font-bold text-ink tabular-nums">{fmt(total, true)}</span>
            <span className="text-[10px] text-ink-3">total</span>
          </div>
        </div>

        <div className="flex-1 space-y-0 min-w-0">
          {vehicleData.map(([vehicle, amt], i) => {
            const pct = Math.round((amt / total) * 100)
            return (
              <div key={vehicle}
                className={`flex items-center gap-2 py-2
                  ${i < vehicleData.length - 1 ? 'border-b border-kosha-border' : ''}`}
              >
                <div className="w-2.5 h-2.5 rounded-full shrink-0"
                     style={{ background: PORTFOLIO_COLORS[i % PORTFOLIO_COLORS.length] }} />
                <span className="text-caption text-ink font-medium flex-1 truncate">{vehicle}</span>
                <span className="text-caption text-ink-3 w-7 text-right">{pct}%</span>
                <span className="text-caption font-semibold text-ink tabular-nums w-16 text-right">
                  {fmt(amt, true)}
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
  const now  = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [top5, setTop5] = useState([])

  const { data, loading, refetch } = useYearSummary(year)
  const { data: prevData, refetch: refetchPrev } = useYearSummary(year - 1)

  const refreshTop5 = useCallback(async () => {
    const { data: rows } = await supabase
      .from('transactions')
      .select('id, date, description, amount, category')
      .eq('type', 'expense')
      .gte('date', `${year}-01-01`)
      .lte('date', `${year}-12-31`)
      .order('amount', { ascending: false })
      .limit(5)
    setTop5(rows || [])
  }, [year])

  useEffect(() => {
    refreshTop5()
  }, [refreshTop5])

  const chartData = (data?.monthly || [])
    .map((m, i) => ({
      name:   MONTH_SHORT[i],
      Income: Math.round(m.income),
      Spent:  Math.round(m.expense),
    }))
    .filter(m => m.Income > 0 || m.Spent > 0)

  const chartH = chartData.length <= 4 ? 140 : 180

  const netData = (data?.monthly || [])
    .map((m, i) => ({
      name: MONTH_SHORT[i],
      Net:  Math.round(m.income - m.expense - m.investment),
    }))
    .filter(m => m.Net !== 0)

  const yoyYears = YEARS.filter(y => y <= now.getFullYear())

  const catData = Object.entries(data?.byCategory || {})
    .sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([id, val]) => ({
      id, val,
      name:  CATEGORIES.find(c => c.id === id)?.label || id,
      color: CATEGORIES.find(c => c.id === id)?.color || C.brand,
    }))
  const totalCatSpend = catData.reduce((s, c) => s + c.val, 0)

  const vehicleData = Object.entries(data?.byVehicle || {}).sort((a, b) => b[1] - a[1])

  const recentMonths = (data?.monthly || []).filter(m => m.expense > 0)
  const lastTwo      = recentMonths.slice(-2)
  const spendTrend   = lastTwo.length === 2
    ? { current: lastTwo[1].expense, previous: lastTwo[0].expense }
    : null

  return (
    <div className="page">

      {/* ── Year navigator ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6 pt-2 pr-14">
        <button onClick={() => setYear(y => y - 1)}
          className="w-9 h-9 rounded-full bg-kosha-surface border border-kosha-border
                     flex items-center justify-center active:bg-kosha-surface-2">
          <ChevronLeft size={18} className="text-ink-2" />
        </button>
        <h1 className="text-display font-bold text-ink tracking-tight">{year}</h1>
        <button onClick={() => setYear(y => y + 1)}
          className="w-9 h-9 rounded-full bg-kosha-surface border border-kosha-border
                     flex items-center justify-center active:bg-kosha-surface-2">
          <ChevronRight size={18} className="text-ink-2" />
        </button>
      </div>

      {loading ? (
        <div className="card p-8 text-center">
          <p className="text-body text-ink-3">Loading…</p>
        </div>
      ) : (
        <motion.div key={year}
          initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
          transition={{ duration:0.25 }}
          className="space-y-6"
        >

          {/* ── 1. Annual KPIs ──────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label="Total Earned"
              value={data?.totalIncome || 0} prevValue={prevData?.totalIncome}
              textCls="text-income-text" bg="bg-income-bg" />
            <KpiCard label="Total Spent"
              value={data?.totalExpense || 0} prevValue={prevData?.totalExpense}
              textCls="text-expense-text" bg="bg-expense-bg" />
            <KpiCard label="Total Invested"
              value={data?.totalInvestment || 0} prevValue={prevData?.totalInvestment}
              textCls="text-invest-text" bg="bg-invest-bg" />
            <div className="card p-4">
              <div className="w-8 h-8 rounded-lg bg-brand-container flex items-center justify-center mb-3">
                <span className="text-label font-bold text-brand-on">%</span>
              </div>
              <p className="text-label text-ink-3 font-medium mb-0.5">Avg Savings Rate</p>
              <p className="text-value font-bold text-brand tabular-nums">{data?.avgSavings || 0}%</p>
              {spendTrend && (
                <div className="mt-2">
                  <TrendPill current={spendTrend.current} previous={spendTrend.previous} label="spend" />
                </div>
              )}
            </div>
          </div>

          {/* ── 2. Cash Flow chart ──────────────────────────────────── */}
          {chartData.length > 0 && (
            <div className="rounded-card overflow-hidden shadow-card-lg" style={{ background:C.chartDark }}>
              <div className="px-5 pt-5 pb-2">
                <p className="text-label font-semibold" style={{ color:'rgba(255,255,255,0.85)' }}>Cash Flow</p>
                <p style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:2 }}>Income vs spending by month</p>
              </div>
              <ResponsiveContainer width="100%" height={chartH}>
                <AreaChart data={chartData} margin={{ top:8, right:16, left:16, bottom:0 }}>
                  <defs>
                    <linearGradient id="gIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.chartIncome}  stopOpacity={0.25} />
                      <stop offset="95%" stopColor={C.chartIncome}  stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={C.chartExpense} stopOpacity={0.20} />
                      <stop offset="95%" stopColor={C.chartExpense} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name"
                    tick={{ fontSize:11, fill:'rgba(255,255,255,0.40)', fontWeight:500 }}
                    axisLine={false} tickLine={false} interval={0}
                  />
                  <YAxis hide />
                  <Tooltip content={<DarkTooltip />} cursor={{ stroke:'rgba(255,255,255,0.08)', strokeWidth:1 }} />
                  <Area dataKey="Income" type="monotone"
                    stroke={C.chartIncome} strokeWidth={2}
                    fill="url(#gIncome)" dot={false}
                    activeDot={{ r:4, fill:C.chartIncome, stroke:'#fff', strokeWidth:1.5 }}
                  />
                  <Area dataKey="Spent" type="monotone"
                    stroke={C.chartExpense} strokeWidth={2}
                    fill="url(#gExpense)" dot={false}
                    activeDot={{ r:4, fill:C.chartExpense, stroke:'#fff', strokeWidth:1.5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-6 pb-4 pt-1">
                {[['Income',C.chartIncome],['Spent',C.chartExpense]].map(([l,c]) => (
                  <div key={l} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full" style={{ background:c }} />
                    <span style={{ fontSize:11, color:'rgba(255,255,255,0.50)', fontWeight:500 }}>{l}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 3. Net Savings ──────────────────────────────────────── */}
          {netData.length > 0 && (
            <div className="rounded-card overflow-hidden shadow-card-lg" style={{ background:C.chartDark }}>
              <div className="px-5 pt-5 pb-2">
                <p className="text-label font-semibold" style={{ color:'rgba(255,255,255,0.85)' }}>Net Savings</p>
                <p style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:2 }}>After expenses &amp; investments</p>
              </div>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={netData} margin={{ top:4, right:16, left:16, bottom:0 }}>
                  <XAxis dataKey="name"
                    tick={{ fontSize:11, fill:'rgba(255,255,255,0.40)', fontWeight:500 }}
                    axisLine={false} tickLine={false} interval={0}
                  />
                  <YAxis hide />
                  <Tooltip content={<DarkTooltip />} cursor={{ fill:'rgba(255,255,255,0.05)' }} />
                  <ReferenceLine y={0} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
                  <Bar dataKey="Net" radius={[4,4,0,0]} maxBarSize={32}>
                    {netData.map((entry, i) => (
                      <Cell key={i}
                        fill={entry.Net >= 0 ? C.chartIncome : C.chartExpense}
                        fillOpacity={0.90} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="h-4"/>
            </div>
          )}

          {/* ── 4. Year-over-year stacked cards ─────────────────────── */}
          <YoYCards years={yoyYears} currentYear={year} />

          {/* ── 5. Top 5 expenses ────────────────────────────────────── */}
          {top5.length > 0 && (
            <div className="card p-5">
              <p className="section-label mb-4">Top Expenses {year}</p>
              <div className="space-y-0 overflow-hidden rounded-card">
                {top5.map((t, i) => (
                  <div key={t.id}
                    className={`flex items-center gap-3 py-3.5 px-1
                      ${i < top5.length - 1 ? 'border-b border-kosha-border' : ''}`}
                  >
                    <div className="w-6 h-6 rounded-full bg-kosha-surface-2 flex items-center justify-center shrink-0">
                      <span className="text-caption font-bold text-ink-3">{i + 1}</span>
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
                ))}
              </div>
            </div>
          )}

          {/* ── 6. Spending by Category ──────────────────────────────── */}
          {catData.length > 0 && (
            <div className="card p-5">
              <p className="section-label mb-4">Spending by Category</p>
              <div className="space-y-4">
                {catData.map(cat => {
                  const pct = totalCatSpend > 0 ? Math.round((cat.val / totalCatSpend) * 100) : 0
                  return (
                    <div key={cat.id}>
                      <div className="flex items-center gap-2 mb-2">
                        <CategoryIcon categoryId={cat.id} size={14} />
                        <span className="text-label text-ink font-medium flex-1 truncate">{cat.name}</span>
                        <span className="text-caption text-ink-3 tabular-nums">{pct}%</span>
                        <span className="text-label font-semibold text-ink tabular-nums">{fmt(cat.val)}</span>
                      </div>
                      <div className="bar-light-track">
                        <motion.div className="bar-light-fill"
                          initial={{ width:0 }} animate={{ width:`${pct}%` }}
                          transition={{ duration:0.6, ease:'easeOut' }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
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
