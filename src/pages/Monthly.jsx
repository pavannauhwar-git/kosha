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

// ── Hero card for the selected month ─────────────────────────────────────
// Stat chips now use solid rgba backgrounds — backdropFilter removed.
function MonthHeroCard({ month, year }) {
  const { data } = useMonthSummary(year, month)
  const earned   = data?.earned     || 0
  const spent    = data?.expense    || 0
  const invested = data?.investment || 0
  const balance  = data?.balance    || 0
  const rate     = savingsRate(earned, spent)

  return (
    <div className="card-hero p-6 relative overflow-hidden">
      {/* Month + brand label */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-caption font-bold tracking-widest uppercase"
           style={{ color: 'rgba(159,232,112,0.75)' }}>
          {MONTH_NAMES[month - 1].slice(0, 3)} {year}
        </p>
        <p className="text-caption font-bold tracking-widest"
           style={{ color: 'rgba(255,255,255,0.35)' }}>KOSHA</p>
      </div>

      {/* Balance label + amount */}
      <p className="text-caption font-medium mb-1"
         style={{ color: 'rgba(255,255,255,0.55)' }}>
        Monthly balance
      </p>
      <p className={`text-hero font-bold leading-none tabular-nums
        ${balance >= 0 ? 'text-white' : 'text-[#FFB3AF]'}`}>
        {fmt(balance)}
      </p>

      {/* Savings rate chip */}
      <div className="mt-2 mb-5 inline-flex items-center gap-1 px-2.5 py-1 rounded-pill"
           style={{ background: 'rgba(159,232,112,0.18)' }}>
        <span className="text-caption font-semibold" style={{ color: '#9FE870' }}>
          {rate}% saved
        </span>
      </div>

      {/* Divider */}
      <div className="border-t mb-4" style={{ borderColor: 'rgba(255,255,255,0.12)' }} />

      {/* Stat chips — solid backgrounds, no blur */}
      <div className="flex justify-between mb-5">
        {[
          { label: 'Earned',   val: earned   },
          { label: 'Spent',    val: spent    },
          { label: 'Invested', val: invested },
        ].map(s => (
          <div key={s.label}
            className="px-3 py-2.5 rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.10)' }}
          >
            <p className="text-caption mb-0.5" style={{ color: 'rgba(255,255,255,0.55)' }}>
              {s.label}
            </p>
            <p className="text-label font-bold text-white tabular-nums">{fmt(s.val)}</p>
          </div>
        ))}
      </div>

      {/* Savings rate bar */}
      <div>
        <div className="flex justify-between mb-2">
          <span className="text-caption" style={{ color: 'rgba(255,255,255,0.55)' }}>
            Savings rate
          </span>
          <span className="text-caption font-semibold text-white">{rate}%</span>
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
  const rate     = savingsRate(earned, spent)
  const saved    = Math.max(0, earned - spent - invested)

  const spentPct    = earned > 0 ? Math.round((spent    / earned) * 100) : 0
  const investedPct = earned > 0 ? Math.round((invested / earned) * 100) : 0
  const savedPct    = Math.max(0, 100 - spentPct - investedPct)

  const catEntries = Object.entries(data?.byCategory || {})
    .sort((a, b) => b[1] - a[1]).slice(0, 6)
  const maxCat = catEntries[0]?.[1] || 1

  const vehicleEntries = Object.entries(data?.byVehicle || {})
    .sort((a, b) => b[1] - a[1])

  return (
    <div className="page">

      {/* ── Month navigator ─────────────────────────────────────────── */}
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

      {/* ── Hero card ───────────────────────────────────────────────── */}
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
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >

          {/* ── Budget Breakdown ──────────────────────────────────── */}
          <div className="card p-5">
            <p className="section-label mb-4">Budget Breakdown</p>

            {/* Segmented bar */}
            <div className="flex rounded-pill overflow-hidden h-2 mb-5" style={{ gap: 2 }}>
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

            {/* Breakdown rows */}
            <div className="space-y-3">
              {[
                { label: 'Spent',    val: spent,    pct: spentPct,    dot: 'bg-expense-text', textCls: 'text-expense-text' },
                { label: 'Invested', val: invested, pct: investedPct, dot: 'bg-invest-text',  textCls: 'text-invest-text'  },
                { label: 'Saved',    val: saved,    pct: savedPct,    dot: 'bg-brand',        textCls: 'text-income-text'  },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                  <span className="text-label text-ink-3 w-16">{s.label}</span>
                  <div className="flex-1 bar-light-track">
                    <motion.div
                      className={`h-full rounded-pill ${s.dot}`}
                      initial={{ width: '0%' }}
                      animate={{ width: `${s.pct}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                  <span className={`text-label font-bold tabular-nums w-8 text-right ${s.textCls}`}>
                    {s.pct}%
                  </span>
                  <span className="text-label text-ink-3 tabular-nums w-24 text-right">
                    {fmt(s.val)}
                  </span>
                </div>
              ))}
            </div>

            {/* Income baseline + repaid */}
            <div className="mt-4 pt-3 border-t border-kosha-border space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-label text-ink-3">Total income</span>
                <span className="text-label font-bold text-income-text tabular-nums">{fmt(earned)}</span>
              </div>
              {repaid > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-label text-ink-3">Repayments received</span>
                  <span className="text-label font-semibold text-repay-text tabular-nums">{fmt(repaid)}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── Spent by Category ─────────────────────────────────── */}
          {catEntries.length > 0 && (
            <div className="card p-5">
              <p className="section-label mb-4">Spent by Category</p>
              <div className="space-y-4">
                {catEntries.map(([catId, amt]) => {
                  const cat = CATEGORIES.find(c => c.id === catId)
                  const pct = Math.round((amt / maxCat) * 100)
                  return (
                    <div key={catId}>
                      <div className="flex items-center gap-2 mb-2">
                        <CategoryIcon categoryId={catId} size={14} />
                        <span className="text-label text-ink font-medium flex-1 truncate">
                          {cat?.label || catId}
                        </span>
                        <span className="text-label font-semibold text-expense-text tabular-nums">
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

          {/* ── Investments ───────────────────────────────────────── */}
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
