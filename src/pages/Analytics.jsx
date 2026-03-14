import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { useYearSummary } from '../hooks/useTransactions'
import CategoryIcon from '../components/CategoryIcon'
import { fmt, savingsRate } from '../lib/utils'
import { CATEGORIES } from '../lib/categories'

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function KpiCard({ label, value, cls, bg }) {
  return (
    <div className="card p-4">
      <div className={`w-8 h-8 rounded-chip ${bg} flex items-center justify-center mb-2`}>
        <span className={`text-xs font-bold ${cls}`}>₹</span>
      </div>
      <p className="text-[11px] text-ink-3 font-medium">{label}</p>
      <p className={`text-lg font-bold ${cls} mt-0.5`}>{fmt(value)}</p>
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

export default function Analytics() {
  const now  = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const { data, loading } = useYearSummary(year)

  const chartData = (data?.monthly || []).map((m, i) => ({
    name:   MONTH_SHORT[i],
    Income: m.income,
    Spent:  m.expense,
    Invest: m.investment,
  }))

  const catData = Object.entries(data?.byCategory || {})
    .sort((a,b) => b[1]-a[1]).slice(0,6)
    .map(([id, val]) => ({
      id, val,
      name:  CATEGORIES.find(c=>c.id===id)?.label || id,
      color: CATEGORIES.find(c=>c.id===id)?.color || '#6C47FF',
    }))

  const vehicleData = Object.entries(data?.byVehicle || {})
    .sort((a,b) => b[1]-a[1])
  const maxVehicle = vehicleData[0]?.[1] || 1

  const totalSpent = data?.totalExpense || 0

  return (
    <div className="page">
      {/* Year navigator */}
      <div className="flex items-center justify-between mb-4 pt-2">
        <button onClick={() => setYear(y=>y-1)}
          className="w-9 h-9 rounded-pill bg-kosha-surface border border-kosha-border flex items-center justify-center">
          <ChevronLeft size={18} className="text-ink-2" />
        </button>
        <h1 className="font-display text-display text-ink">{year}</h1>
        <button onClick={() => setYear(y=>y+1)}
          className="w-9 h-9 rounded-pill bg-kosha-surface border border-kosha-border flex items-center justify-center">
          <ChevronRight size={18} className="text-ink-2" />
        </button>
      </div>

      {loading ? (
        <div className="card p-8 text-center">
          <p className="text-ink-3 text-sm">Loading…</p>
        </div>
      ) : (
        <motion.div
          key={year}
          initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
          transition={{ duration:0.25 }}
          className="space-y-4"
        >
          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label="Total Earned"   value={data?.totalIncome     || 0} cls="amt-income"  bg="bg-income-bg" />
            <KpiCard label="Total Spent"    value={data?.totalExpense    || 0} cls="amt-expense" bg="bg-expense-bg" />
            <KpiCard label="Total Invested" value={data?.totalInvestment || 0} cls="amt-invest"  bg="bg-invest-bg" />
            <div className="card p-4">
              <div className="w-8 h-8 rounded-chip bg-brand-container flex items-center justify-center mb-2">
                <span className="text-xs font-bold text-brand">%</span>
              </div>
              <p className="text-[11px] text-ink-3 font-medium">Avg Savings Rate</p>
              <p className="text-lg font-bold text-brand mt-0.5">{data?.avgSavings || 0}%</p>
            </div>
          </div>

          {/* Monthly bar chart */}
          <div className="card-hard p-4">
            <p className="section-label mb-4">Monthly Cash Flow</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData} barSize={6} barGap={2}>
                <XAxis dataKey="name" tick={{ fontSize:10, fill:'#A09CC0' }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} cursor={{ fill:'rgba(108,71,255,0.05)' }} />
                <Bar dataKey="Income" fill="#00C896" radius={[3,3,0,0]} />
                <Bar dataKey="Spent"  fill="#FF4757" radius={[3,3,0,0]} />
                <Bar dataKey="Invest" fill="#6C47FF" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
            {/* Legend */}
            <div className="flex justify-center gap-4 mt-2">
              {[['Income','#00C896'],['Spent','#FF4757'],['Invest','#6C47FF']].map(([l,c])=>(
                <div key={l} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background:c }} />
                  <span className="text-[11px] text-ink-2">{l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Spending donut */}
          {catData.length > 0 && (
            <div className="card p-4">
              <p className="section-label mb-4">Spending by Category</p>
              <div className="flex gap-4 items-center">
                <div className="shrink-0">
                  <PieChart width={120} height={120}>
                    <Pie data={catData} dataKey="val" cx={55} cy={55}
                         innerRadius={32} outerRadius={55} strokeWidth={0}>
                      {catData.map((c,i) => <Cell key={i} fill={c.color} />)}
                    </Pie>
                  </PieChart>
                </div>
                <div className="flex-1 space-y-2">
                  {catData.map(c => (
                    <div key={c.id} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-pill shrink-0" style={{ background:c.color }} />
                      <span className="text-[11px] text-ink-2 flex-1 truncate">{c.name}</span>
                      <span className="text-[11px] font-semibold text-ink">{fmt(c.val)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Investment portfolio */}
          {vehicleData.length > 0 && (
            <div className="card-hard p-4">
              <p className="section-label mb-3">Investment Portfolio</p>
              <div className="space-y-3">
                {vehicleData.map(([vehicle, amt]) => (
                  <div key={vehicle}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-ink">{vehicle}</span>
                      <span className="text-xs font-semibold amt-invest">{fmt(amt)}</span>
                    </div>
                    <div className="bar-light-track">
                      <motion.div
                        className="bar-light-fill"
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

          {/* No data */}
          {!data?.totalIncome && !data?.totalExpense && (
            <div className="card p-8 text-center">
              <p className="text-ink-2 text-sm">No data for {year}.</p>
              <p className="text-ink-3 text-xs mt-1">Navigate to a year with transactions.</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}
