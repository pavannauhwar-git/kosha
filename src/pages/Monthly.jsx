import { useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMonthSummary } from '../hooks/useTransactions'
import CategoryIcon from '../components/CategoryIcon'
import { fmt, fmtFull, savingsRate } from '../lib/utils'
import { CATEGORIES } from '../lib/categories'
import { useRunningBalance } from '../hooks/useTransactions'

const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December']

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
    .sort((a, b) => b[1] - a[1]).slice(0, 6)
  const maxCat = catEntries[0]?.[1] || 1

  const vehicleEntries = Object.entries(data?.byVehicle || {})
    .sort((a, b) => b[1] - a[1])

  return (
    <div className="page">
      {/* Month navigator */}
      <div className="flex items-center justify-between mb-4 pt-2">
        <button onClick={prev} className="w-9 h-9 rounded-pill bg-kosha-surface border border-kosha-border flex items-center justify-center active:bg-brand-container">
          <ChevronLeft size={18} className="text-ink-2" />
        </button>
        <h1 className="font-display text-display text-ink">
          {MONTH_NAMES[month-1]} {year}
        </h1>
        <button onClick={next} className="w-9 h-9 rounded-pill bg-kosha-surface border border-kosha-border flex items-center justify-center active:bg-brand-container">
          <ChevronRight size={18} className="text-ink-2" />
        </button>
      </div>

      {loading ? (
        <div className="card p-8 text-center">
          <p className="text-ink-3 text-sm">Loading…</p>
        </div>
      ) : (
        <motion.div
          key={`${year}-${month}`}
          initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
          transition={{ duration:0.25 }}
          className="space-y-4"
        >
          {/* Balance hero */}
          <div className="card-hero p-5 relative overflow-hidden">
            <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full"
                 style={{ background:'rgba(108,71,255,0.2)' }} />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="section-label text-on-grad-2 mb-1">Balance</p>
                <p className={`font-display text-3xl ${balance >= 0 ? 'text-on-grad' : 'text-expense'}`}>
                  {fmt(balance)}
                </p>
              </div>
              <div>
                <p className="section-label text-on-grad-2 mb-1">Savings Rate</p>
                <p className="font-display text-3xl text-income">{rate}%</p>
              </div>
            </div>
            <div className="mt-4">
              <div className="savings-track">
                <motion.div
                  className="savings-fill"
                  initial={{ width:0 }}
                  animate={{ width:`${rate}%` }}
                  transition={{ duration:0.7, ease:'easeOut' }}
                />
              </div>
            </div>
          </div>

          {/* 4-stat grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label:'Earned',   val:earned,   cls:'amt-income',  bg:'bg-income-bg' },
              { label:'Spent',    val:spent,    cls:'amt-expense', bg:'bg-expense-bg' },
              { label:'Invested', val:invested, cls:'amt-invest',  bg:'bg-invest-bg' },
              { label:'Repaid',   val:repaid,   cls:'amt-repay',   bg:'bg-repay-bg' },
            ].map(s => (
              <div key={s.label} className="card p-4">
                <div className={`w-8 h-8 rounded-chip ${s.bg} flex items-center justify-center mb-2`}>
                  <span className={`text-xs font-bold ${s.cls}`}>₹</span>
                </div>
                <p className="text-xs text-ink-3 font-medium">{s.label}</p>
                <p className={`text-lg font-bold ${s.cls} mt-0.5`}>{fmt(s.val)}</p>
              </div>
            ))}
          </div>

          {/* Spending by category */}
          {catEntries.length > 0 && (
            <div className="card-hard p-4">
              <p className="section-label mb-3">Spent by Category</p>
              <div className="space-y-3">
                {catEntries.map(([catId, amt]) => {
                  const cat = CATEGORIES.find(c => c.id === catId)
                  const pct = (amt / maxCat) * 100
                  return (
                    <div key={catId}>
                      <div className="flex items-center gap-2 mb-1">
                        <CategoryIcon categoryId={catId} size={14} />
                        <span className="text-xs text-ink flex-1 truncate">
                          {cat?.label || catId}
                        </span>
                        <span className="text-xs font-semibold amt-expense">{fmt(amt)}</span>
                      </div>
                      <div className="h-1.5 rounded-pill bg-kosha-bg overflow-hidden">
                        <motion.div
                          className="h-full rounded-pill"
                          style={{ background: cat?.color || '#6C47FF' }}
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

          {/* Investments */}
          {vehicleEntries.length > 0 && (
            <div>
              <p className="section-label mb-3">Investments</p>
              <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
                {vehicleEntries.map(([vehicle, amt]) => (
                  <div key={vehicle} className="card p-3 shrink-0 min-w-[110px]">
                    <p className="text-[10px] text-ink-3 font-medium mb-1 truncate">{vehicle}</p>
                    <p className="text-sm font-bold amt-invest">{fmt(amt)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No data */}
          {earned === 0 && spent === 0 && invested === 0 && (
            <div className="card p-8 text-center">
              <p className="text-ink-2 text-sm">No data for this month.</p>
              <p className="text-ink-3 text-xs mt-1">Navigate to a month with transactions.</p>
            </div>
          )}
        </motion.div>
      )}
    </div>
  )
}