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

// ── Mini month card — same mesh gradient as hero ───────────────────────────
function MiniMonthCard({ month, year, isCurrent }) {
  const { data } = useMonthSummary(year, month)
  const earned   = data?.earned     || 0
  const spent    = data?.expense    || 0
  const invested = data?.investment || 0
  const rate     = savingsRate(earned, spent)
  const hasData  = earned > 0 || spent > 0 || invested > 0

  return (
    <motion.div
      className="rounded-card overflow-hidden relative w-full"
      style={{
        background: (
          isCurrent
            ? `radial-gradient(ellipse at 20% 30%, rgba(175,82,222,0.90) 0%, transparent 50%),
               radial-gradient(ellipse at 85% 15%, rgba(255,149,0,0.85) 0%, transparent 45%),
               radial-gradient(ellipse at 70% 80%, rgba(255,214,10,0.80) 0%, transparent 45%),
               radial-gradient(ellipse at 10% 75%, rgba(255,45,85,0.70) 0%, transparent 45%),
               #E8D5FF`
            : '#FFFFFF'
        ),
        boxShadow: isCurrent
          ? '0 8px 24px rgba(108,71,255,0.25), 0 2px 8px rgba(0,0,0,0.08)'
          : '0 2px 8px rgba(0,0,0,0.08), 0 0 0 0.5px rgba(0,0,0,0.04)',
      }}
      initial={{ opacity:0, scale:0.96 }}
      animate={{ opacity:1, scale:1 }}
      transition={{ duration:0.25 }}
    >
      <div className="p-4">
        {/* Month label */}
        <p className={`text-[10px] font-semibold tracking-widest uppercase mb-2
          ${isCurrent ? 'text-white/70' : 'text-ink-3'}`}>
          {MONTH_NAMES[month-1].slice(0,3)} {year}
          {isCurrent && <span className="ml-1">· Now</span>}
        </p>

        {hasData ? (
          <>
            {/* Stats */}
            <div className="space-y-1.5 mb-3">
              {[
                { label:'Income',  val:earned,   color: isCurrent ? '#FFFFFF' : '#1A7A35' },
                { label:'Spent',   val:spent,    color: isCurrent ? '#FFFFFF' : '#CC0000' },
                { label:'Invested',val:invested, color: isCurrent ? '#FFFFFF' : '#0040A0' },
              ].map(s => (
                <div key={s.label} className="flex justify-between items-baseline">
                  <span style={{ fontSize:10, color: isCurrent ? 'rgba(255,255,255,0.75)' : '#8E8E93' }}>
                    {s.label}
                  </span>
                  <span style={{ fontSize:12, fontWeight:700, color:s.color,
                                 fontVariantNumeric:'tabular-nums' }}>
                    {fmt(s.val)}
                  </span>
                </div>
              ))}
            </div>

            {/* Savings bar */}
            <div>
              <div className="flex justify-between mb-1">
                <span style={{ fontSize:9, color: isCurrent ? 'rgba(255,255,255,0.55)' : '#C7C7CC' }}>
                  Savings
                </span>
                <span style={{ fontSize:9, fontWeight:700,
                               color: isCurrent ? 'rgba(255,255,255,0.9)' : '#1A7A35' }}>
                  {rate}%
                </span>
              </div>
              <div className={isCurrent ? 'bar-dark-track' : 'bar-light-track'}>
                <motion.div
                  className={isCurrent ? 'bar-dark-fill' : 'bar-light-fill'}
                  style={{ height:'100%' }}
                  initial={{ width:0 }}
                  animate={{ width:`${rate}%` }}
                  transition={{ duration:0.6, ease:'easeOut' }}
                />
              </div>
            </div>
          </>
        ) : (
          <p className={`text-[12px] ${isCurrent ? 'text-white/50' : 'text-ink-4'}`}>
            No data
          </p>
        )}
      </div>
    </motion.div>
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
  const balance  = data?.balance    || 0
  const rate     = savingsRate(earned, spent)

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

      <div className="mb-4">
        <MiniMonthCard month={month} year={year} isCurrent={true} />
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

          <div className="card-hero p-5 relative overflow-hidden">
            <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full"
                 style={{ background:'rgba(108,71,255,0.2)' }} />
            <div className="grid grid-cols-2 gap-4 relative">
              <div>
                <p className="text-[10px] font-semibold tracking-widest uppercase
                               text-white/60 mb-1">Balance</p>
                <p className={`text-[32px] font-bold leading-none tabular-nums
                  ${balance >= 0 ? 'text-white' : 'text-[#FFB3AF]'}`}>
                  {fmt(balance)}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold tracking-widest uppercase
                               text-white/60 mb-1">Savings Rate</p>
                <p className="text-[32px] font-bold leading-none text-white">{rate}%</p>
              </div>
            </div>
            <div className="mt-4 relative">
              <div className="bar-dark-track">
                <motion.div className="bar-dark-fill"
                  initial={{ width:0 }}
                  animate={{ width:`${rate}%` }}
                  transition={{ duration:0.7, ease:'easeOut' }}
                />
              </div>
            </div>
          </div>

          {/* ── 4-stat grid ── */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label:'Earned',   val:earned,   cls:'text-income-text',  bg:'bg-income-bg'  },
              { label:'Spent',    val:spent,    cls:'text-expense-text', bg:'bg-expense-bg' },
              { label:'Invested', val:invested, cls:'text-invest-text',  bg:'bg-invest-bg'  },
              { label:'Repaid',   val:repaid,   cls:'text-repay-text',   bg:'bg-repay-bg'   },
            ].map(s => (
              <div key={s.label} className="card p-4">
                <div className={`w-8 h-8 rounded-lg ${s.bg}
                                flex items-center justify-center mb-2`}>
                  <span className={`text-xs font-bold ${s.cls}`}>₹</span>
                </div>
                <p className="text-[11px] text-ink-3 font-medium">{s.label}</p>
                <p className={`text-[17px] font-bold ${s.cls} mt-0.5 tabular-nums`}>
                  {fmt(s.val)}
                </p>
              </div>
            ))}
          </div>

          {/* ── Category bars ── */}
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

          {/* ── Investment chips ── */}
          {vehicleEntries.length > 0 && (
            <div>
              <p className="section-label mb-3">Investments</p>
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                {vehicleEntries.map(([vehicle, amt]) => (
                  <div key={vehicle} className="card p-3.5 shrink-0 min-w-[110px]">
                    <p className="text-[10px] text-ink-3 font-medium mb-1 truncate">
                      {vehicle}
                    </p>
                    <p className="text-[14px] font-bold text-invest-text tabular-nums">
                      {fmt(amt)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {earned === 0 && spent === 0 && invested === 0 && (
            <div className="card p-8 text-center">
              <p className="text-ink-2 text-[15px]">No data for this month.</p>
              <p className="text-ink-3 text-[13px] mt-1">
                Navigate to a month with transactions.
              </p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}