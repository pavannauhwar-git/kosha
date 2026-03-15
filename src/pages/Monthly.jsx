import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PieChart, Pie, Cell } from 'recharts'
import { useMonthSummary } from '../hooks/useTransactions'
import CategoryIcon from '../components/CategoryIcon'
import { fmt, savingsRate } from '../lib/utils'
import { CATEGORIES } from '../lib/categories'

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

// ── Hero card ──────────────────────────────────────────────────────────────
function MonthHeroCard({ month, year }) {
  const { data } = useMonthSummary(year, month)
  const earned   = data?.earned     || 0
  const spent    = data?.expense    || 0
  const invested = data?.investment || 0
  const balance  = data?.balance    || 0
  const rate     = savingsRate(earned, spent)

  return (
    <div className="card-hero p-6 relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <p className="text-caption font-bold tracking-widest uppercase"
           style={{ color:'rgba(159,232,112,0.75)' }}>
          {MONTH_NAMES[month - 1].slice(0, 3)} {year}
        </p>
        <p className="text-caption font-bold tracking-widest"
           style={{ color:'rgba(255,255,255,0.35)' }}>KOSHA</p>
      </div>

      <p className="text-caption font-medium mb-1" style={{ color:'rgba(255,255,255,0.55)' }}>
        Monthly balance
      </p>
      <p className={`text-hero font-bold leading-none tabular-nums
        ${balance >= 0 ? 'text-white' : 'text-[#FFB3AF]'}`}>
        {fmt(balance)}
      </p>

      <div className="mt-2 mb-5 inline-flex items-center px-2.5 py-1 rounded-pill"
           style={{ background:'rgba(159,232,112,0.18)' }}>
        <span className="text-caption font-semibold" style={{ color:'#9FE870' }}>
          {rate}% saved
        </span>
      </div>

      <div className="border-t mb-4" style={{ borderColor:'rgba(255,255,255,0.12)' }} />

      <div className="flex justify-between mb-5">
        {[
          { label:'Earned',   val:earned   },
          { label:'Spent',    val:spent    },
          { label:'Invested', val:invested },
        ].map(s => (
          <div key={s.label} className="px-3 py-2.5 rounded-2xl"
               style={{ background:'rgba(255,255,255,0.10)' }}>
            <p className="text-caption mb-0.5" style={{ color:'rgba(255,255,255,0.55)' }}>{s.label}</p>
            <p className="text-label font-bold text-white tabular-nums">{fmt(s.val)}</p>
          </div>
        ))}
      </div>

      <div>
        <div className="flex justify-between mb-2">
          <span className="text-caption" style={{ color:'rgba(255,255,255,0.55)' }}>Savings rate</span>
          <span className="text-caption font-semibold text-white">{rate}%</span>
        </div>
        <div className="bar-dark-track">
          <motion.div className="bar-dark-fill"
            initial={{ width:0 }} animate={{ width:`${rate}%` }}
            transition={{ duration:0.7, ease:'easeOut' }}
          />
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function Monthly() {
  const now   = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const { data, loading } = useMonthSummary(year, month)

  function prev() {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function next() {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const earned   = data?.earned     || 0
  const spent    = data?.expense    || 0
  const invested = data?.investment || 0
  const repaid   = data?.repayments || 0
  const saved    = Math.max(0, earned - spent - invested)

  const spentPct    = earned > 0 ? Math.round((spent    / earned) * 100) : 0
  const investedPct = earned > 0 ? Math.round((invested / earned) * 100) : 0
  const savedPct    = Math.max(0, 100 - spentPct - investedPct)

  // Category bars: scale to total spend (not maxCat) for meaningful %
  const catEntries = Object.entries(data?.byCategory || {})
    .sort((a, b) => b[1] - a[1]).slice(0, 6)
  const totalCatSpend = catEntries.reduce((s, [, v]) => s + v, 0) || 1

  const vehicleEntries = Object.entries(data?.byVehicle || {})
    .sort((a, b) => b[1] - a[1])

  return (
    <div className="page">

      {/* ── Month navigator ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6 pt-2">
        <button onClick={prev}
          className="w-9 h-9 rounded-full bg-kosha-surface border border-kosha-border
                     flex items-center justify-center active:bg-kosha-surface-2">
          <ChevronLeft size={18} className="text-ink-2" />
        </button>
        <h1 className="text-display font-bold text-ink tracking-tight">
          {MONTH_NAMES[month - 1]} {year}
        </h1>
        <button onClick={next}
          className="w-9 h-9 rounded-full bg-kosha-surface border border-kosha-border
                     flex items-center justify-center active:bg-kosha-surface-2">
          <ChevronRight size={18} className="text-ink-2" />
        </button>
      </div>

      {/* ── Hero card ─────────────────────────────────────────────────── */}
      <div className="mb-6">
        <MonthHeroCard month={month} year={year} />
      </div>

      {loading ? (
        <div className="card p-8 text-center">
          <p className="text-body text-ink-3">Loading…</p>
        </div>
      ) : (
        <motion.div
          key={`${year}-${month}`}
          initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
          transition={{ duration:0.25 }}
          className="space-y-6"
        >

          {/* ── Budget Breakdown ──────────────────────────────────────── */}
          {earned > 0 && (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="section-label">Budget Breakdown</p>
              <span className="text-caption text-ink-3">{fmt(earned)} earned</span>
            </div>

            {/* Donut + rows side-by-side (same pattern as portfolio donut) */}
            <div className="flex gap-4 items-start">

              {/* Donut */}
              <div className="relative shrink-0" style={{ width:110, height:110 }}>
                <PieChart width={110} height={110}>
                  <Pie
                    data={[
                      { name:'Spent',    value: spent    || 0.001 },
                      { name:'Invested', value: invested || 0     },
                      { name:'Saved',    value: saved    || 0     },
                    ].filter(d => d.value > 0)}
                    cx={55} cy={55}
                    innerRadius={36} outerRadius={52}
                    dataKey="value"
                    strokeWidth={0}
                    paddingAngle={2}
                  >
                    <Cell fill="#D42B3A" />
                    <Cell fill="#1A5C45" />
                    <Cell fill="#163300" />
                  </Pie>
                </PieChart>
                {/* Center: saved % */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span style={{ fontSize:15, fontWeight:700, color:'#163300',
                                 fontFamily:'Plus Jakarta Sans, system-ui', lineHeight:1.1 }}>
                    {savedPct}%
                  </span>
                  <span style={{ fontSize:9, color:'#7A8F6E',
                                 fontFamily:'Plus Jakarta Sans, system-ui' }}>
                    saved
                  </span>
                </div>
              </div>

              {/* Breakdown rows */}
              <div className="flex-1 space-y-3 pt-1">
                {[
                  { label:'Spent',    val:spent,    pct:spentPct,    dot:'#D42B3A', textCls:'text-expense-text' },
                  { label:'Invested', val:invested, pct:investedPct, dot:'#1A5C45', textCls:'text-invest-text'  },
                  { label:'Saved',    val:saved,    pct:savedPct,    dot:'#163300', textCls:'text-income-text'  },
                ].map(s => (
                  <div key={s.label}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background:s.dot }} />
                      <span className="text-caption text-ink-3 flex-1">{s.label}</span>
                      <span className={`text-caption font-bold tabular-nums ${s.textCls}`}>{s.pct}%</span>
                    </div>
                    <p className="text-caption text-ink-3 tabular-nums pl-4">{fmt(s.val)}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Income total + repaid */}
            <div className="mt-4 pt-3 border-t border-kosha-border space-y-1.5">
              <div className="flex justify-between">
                <span className="text-caption text-ink-3">Total income</span>
                <span className="text-caption font-bold text-income-text tabular-nums">{fmt(earned)}</span>
              </div>
              {repaid > 0 && (
                <div className="flex justify-between">
                  <span className="text-caption text-ink-3">Repayments received</span>
                  <span className="text-caption font-semibold text-repay-text tabular-nums">{fmt(repaid)}</span>
                </div>
              )}
            </div>
          </div>
          )}

          {/* ── Spent by Category — bubbles + % of total spend ────────── */}
          {catEntries.length > 0 && (
            <div className="card p-5">
              <p className="section-label mb-4">Spent by Category</p>
              <div className="space-y-0">
                {catEntries.map(([catId, amt], i) => {
                  const cat = CATEGORIES.find(c => c.id === catId)
                  // % of total category spend (meaningful proportion)
                  const pct = Math.round((amt / totalCatSpend) * 100)
                  return (
                    <div key={catId}
                      className={`flex items-center gap-3 py-3
                        ${i < catEntries.length - 1 ? 'border-b border-kosha-border' : ''}`}
                    >
                      {/* Category bubble */}
                      <div
                        className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
                        style={{ background: cat?.bg || '#F5F5F5' }}
                      >
                        <CategoryIcon categoryId={catId} size={16} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-label font-medium text-ink truncate">
                            {cat?.label || catId}
                          </span>
                          <span className="text-caption text-ink-3 ml-2 shrink-0">{pct}%</span>
                        </div>
                        <div className="h-[4px] bg-kosha-border rounded-pill overflow-hidden">
                          <motion.div
                            className="h-full rounded-pill"
                            style={{ background: cat?.color || '#38A169' }}
                            initial={{ width:0 }} animate={{ width:`${pct}%` }}
                            transition={{ duration:0.6, ease:'easeOut' }}
                          />
                        </div>
                      </div>
                      <span className="text-label font-semibold text-expense-text tabular-nums ml-2 shrink-0">
                        {fmt(amt)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Investments ───────────────────────────────────────────── */}
          {vehicleEntries.length > 0 && (
            <div>
              <p className="section-label mb-3">Investments</p>
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                {vehicleEntries.map(([vehicle, amt]) => (
                  <div key={vehicle} className="card p-4 shrink-0 min-w-[120px]">
                    <p className="text-caption text-ink-3 font-medium mb-1 truncate">{vehicle}</p>
                    <p className="text-value font-bold text-invest-text tabular-nums">{fmt(amt)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {earned === 0 && spent === 0 && invested === 0 && (
            <div className="card p-8 text-center">
              <p className="text-body text-ink-2">No data for this month.</p>
              <p className="text-label text-ink-3 mt-1">Navigate to a month with transactions.</p>
            </div>
          )}

        </motion.div>
      )}
    </div>
  )
}
