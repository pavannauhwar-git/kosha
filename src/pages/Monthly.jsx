import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMonthSummary } from '../hooks/useTransactions'
import CategoryIcon from '../components/CategoryIcon'
import { fmt, savingsRate } from '../lib/utils'
import { CATEGORIES } from '../lib/categories'

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

function MiniMonthCard({ month, year }) {
  const { data } = useMonthSummary(year, month)
  const earned   = data?.earned     || 0
  const spent    = data?.expense    || 0
  const invested = data?.investment || 0
  const balance  = data?.balance    || 0
  const rate     = savingsRate(earned, spent)

  return (
    <div className="card-hero p-5 relative overflow-hidden">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-bold tracking-widest text-white/70 uppercase">
          {MONTH_NAMES[month-1].slice(0,3)} {year} · Now
        </p>
        <p className="text-[11px] font-bold tracking-widest text-white/70">KOSHA</p>
      </div>

      <p className={`text-[40px] font-bold leading-none tabular-nums mb-1
        ${balance >= 0 ? 'text-white' : 'text-[#FFB3AF]'}`}>
        {fmt(balance)}
      </p>
      <p className="text-[13px] text-white/60 mb-4">Running balance</p>

      <div className="flex gap-2 flex-wrap mb-4">
        {[
          { label:'Earned',   val:earned,   bg:'rgba(52,199,89,0.25)'  },
          { label:'Spent',    val:spent,    bg:'rgba(255,59,48,0.25)'  },
          { label:'Invested', val:invested, bg:'rgba(108,71,255,0.25)' },
        ].map(s => (
          <div key={s.label}
            className="px-3 py-1.5 rounded-full"
            style={{ background: s.bg, backdropFilter:'blur(8px)' }}>
            <p className="text-[10px] font-medium text-white/70">{s.label}</p>
            <p className="text-[13px] font-bold text-white tabular-nums">{fmt(s.val)}</p>
          </div>
        ))}
      </div>

      <div>
        <div className="flex justify-between mb-1.5">
          <span className="text-[11px] text-white/60">Savings rate</span>
          <span className="text-[11px] font-semibold text-white">{rate}%</span>
        </div>
        <div className="bar-dark-track">
          <motion.div
            className="bar-dark-fill"
            initial={{ width: 0 }}
            animate={{ width: `${rate}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
        </div>
      </div>
    </div>
  )
}

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
  const rate     = savingsRate(earned, spent)
  const saved    = Math.max(0, earned - spent - invested)

  const spentPct    = earned > 0 ? Math.round((spent    / earned) * 100) : 0
  const investedPct = earned > 0 ? Math.round((invested / earned) * 100) : 0
  const savedPct    = Math.max(0, 100 - spentPct - investedPct)

  const catEntries = Object.entries(data?.byCategory || {})
    .sort((a,b) => b[1]-a[1]).slice(0, 6)
  const maxCat = catEntries[0]?.[1] || 1

  const vehicleEntries = Object.entries(data?.byVehicle || {})
    .sort((a,b) => b[1]-a[1])

  return (
    <div className="page">
      {/* Month navigator */}
      <div className="flex items-center justify-between mb-4 pt-2">
        <button onClick={prev}
          className="w-9 h-9 rounded-full bg-kosha-surface border border-kosha-border
                     flex items-center justify-center active:bg-kosha-surface-2">
          <ChevronLeft size={18} className="text-ink-2" />
        </button>
        <h1 className="text-[28px] font-bold text-ink tracking-tight">
          {MONTH_NAMES[month-1]} {year}
        </h1>
        <button onClick={next}
          className="w-9 h-9 rounded-full bg-kosha-surface border border-kosha-border
                     flex items-center justify-center active:bg-kosha-surface-2">
          <ChevronRight size={18} className="text-ink-2" />
        </button>
      </div>

      {/* Single current month card */}
      <div className="mb-4">
        <MiniMonthCard month={month} year={year} />
      </div>

      {loading ? (
        <div className="card p-8 text-center">
          <p className="text-ink-3 text-[15px]">Loading…</p>
        </div>
      ) : (
        <motion.div
          key={`${year}-${month}`}
          initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
          transition={{ duration:0.25 }} className="space-y-4"
        >

          {/* Budget Breakdown */}
          <div className="card p-5">
            <p className="section-label mb-4">Budget Breakdown</p>

            {/* Segmented bar */}
            <div className="flex rounded-pill overflow-hidden h-3 mb-5" style={{ gap: 2 }}>
              <motion.div
                className="h-full bg-expense-text"
                style={{ borderRadius: '9999px 0 0 9999px' }}
                initial={{ width: '0%' }}
                animate={{ width: `${spentPct}%` }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
              />
              <motion.div
                className="h-full bg-invest-text"
                initial={{ width: '0%' }}
                animate={{ width: `${investedPct}%` }}
                transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
              />
              <motion.div
                className="h-full bg-brand flex-1"
                style={{ borderRadius: '0 9999px 9999px 0' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              />
            </div>

            {/* Stat rows */}
            <div className="space-y-3">
              {[
                { label:'Spent',    val:spent,    pct:spentPct,    dot:'bg-expense-text', textCls:'text-expense-text' },
                { label:'Invested', val:invested, pct:investedPct, dot:'bg-invest-text',  textCls:'text-invest-text'  },
                { label:'Saved',    val:saved,    pct:savedPct,    dot:'bg-brand',        textCls:'text-brand'        },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-3">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${s.dot}`} />
                  <span className="text-[13px] text-ink-3 w-16">{s.label}</span>
                  <div className="flex-1 bar-light-track">
                    <motion.div
                      className={`h-full rounded-pill ${s.dot}`}
                      initial={{ width: '0%' }}
                      animate={{ width: `${s.pct}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                  <span className={`text-[13px] font-bold tabular-nums w-8 text-right ${s.textCls}`}>
                    {s.pct}%
                  </span>
                  <span className="text-[12px] text-ink-3 tabular-nums w-24 text-right">
                    {fmt(s.val)}
                  </span>
                </div>
              ))}
            </div>

            {/* Total income baseline */}
            <div className="mt-4 pt-3 border-t border-kosha-border flex justify-between items-center">
              <span className="text-[12px] text-ink-3">Total Income</span>
              <span className="text-[14px] font-bold text-income-text tabular-nums">{fmt(earned)}</span>
            </div>
          </div>

          {/* 4-stat grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label:'Earned',   val:earned,   cls:'text-income-text',  bg:'bg-income-bg'  },
              { label:'Spent',    val:spent,    cls:'text-expense-text', bg:'bg-expense-bg' },
              { label:'Invested', val:invested, cls:'text-invest-text',  bg:'bg-invest-bg'  },
              { label:'Repaid',   val:repaid,   cls:'text-repay-text',   bg:'bg-repay-bg'   },
            ].map(s => (
              <div key={s.label} className="card p-4">
                <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center mb-2`}>
                  <span className={`text-xs font-bold ${s.cls}`}>₹</span>
                </div>
                <p className="text-[11px] text-ink-3 font-medium">{s.label}</p>
                <p className={`text-[17px] font-bold ${s.cls} mt-0.5 tabular-nums`}>{fmt(s.val)}</p>
              </div>
            ))}
          </div>

          {/* Category bars */}
          {catEntries.length > 0 && (
            <div className="card p-4">
              <p className="section-label mb-4">Spent by Category</p>
              <div className="space-y-3">
                {catEntries.map(([catId, amt]) => {
                  const cat = CATEGORIES.find(c => c.id === catId)
                  const pct = Math.round((amt / maxCat) * 100)
                  return (
                    <div key={catId}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <CategoryIcon categoryId={catId} size={14} />
                        <span className="text-[13px] text-ink font-medium flex-1 truncate">
                          {cat?.label || catId}
                        </span>
                        <span className="text-[13px] font-semibold text-expense-text tabular-nums">
                          {fmt(amt)}
                        </span>
                      </div>
                      <div className="bar-light-track">
                        <motion.div className="bar-light-fill"
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Investment chips */}
          {vehicleEntries.length > 0 && (
            <div>
              <p className="section-label mb-3">Investments</p>
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                {vehicleEntries.map(([vehicle, amt]) => (
                  <div key={vehicle} className="card p-3.5 shrink-0 min-w-[110px]">
                    <p className="text-[10px] text-ink-3 font-medium mb-1 truncate">{vehicle}</p>
                    <p className="text-[14px] font-bold text-invest-text tabular-nums">{fmt(amt)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {earned === 0 && spent === 0 && invested === 0 && (
            <div className="card p-8 text-center">
              <p className="text-ink-2 text-[15px]">No data for this month.</p>
              <p className="text-ink-3 text-[13px] mt-1">Navigate to a month with transactions.</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}