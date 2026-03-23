import { useState, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useMonthSummary } from '../hooks/useTransactions'
import { useBudgets } from '../hooks/useBudgets'
import CategoryIcon from '../components/CategoryIcon'
import CategorySpendingChart from '../components/CategorySpendingChart'
import { fmt, savingsRate } from '../lib/utils'
import { C } from '../lib/colors'
import PageHeader from '../components/PageHeader'

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

function MonthlySkeleton() {
  return (
    <div className="space-y-4">
      <div className="skeleton shimmer h-[260px]" />
      <div className="skeleton shimmer h-[220px]" />
      <div className="skeleton shimmer h-[180px]" />
    </div>
  )
}

// ── Budget sheet ───────────────────────────────────────────────────────────
function BudgetSheet({ cat, current, onSave, onRemove, onClose }) {
  const [value,  setValue]  = useState(current ? String(current) : '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const amt = parseFloat(value)
    if (!amt || amt <= 0) return
    setSaving(true)
    try {
      await onSave(cat.id, amt) // onSave must strictly await mutation+refetch
      onClose()
    } catch {
      // Optionally: show error UI here
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    setSaving(true)
    try {
      await onRemove(cat.id) // onRemove must strictly await mutation+refetch
      onClose()
    } catch {
      // Optionally: show error UI here
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <motion.div className="sheet-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }}
        onClick={saving ? undefined : onClose}
      />
      <motion.div className="sheet-panel"
        initial={{ y: '100%' }}
        animate={{ y: 0, transition: { type: 'spring', stiffness: 400, damping: 32 } }}
        exit={{ y: '100%', transition: { duration: 0.22 } }}
      >
        <div className="sheet-handle" />
        <div className="px-5">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <CategoryIcon categoryId={cat.id} size={18} />
              <h2 className="text-[20px] font-bold text-ink">{cat.label} Budget</h2>
            </div>
            <button onClick={saving ? undefined : onClose} className="close-btn" disabled={saving}>
              <X size={16} className="text-ink-3" />
            </button>
          </div>

          <p className="text-caption text-ink-3 mb-2">Monthly limit</p>
          <div className="bg-kosha-surface-2 rounded-card px-4 py-3 mb-5 flex items-center gap-2">
            <span className="font-display text-2xl font-bold text-brand">₹</span>
            <input
              type="number" inputMode="decimal" placeholder="0"
              value={value}
              onChange={e => setValue(e.target.value)}
              autoFocus
              disabled={saving}
              className="flex-1 bg-transparent font-display text-3xl font-bold text-ink
                         outline-none tabular-nums placeholder-ink-4 disabled:opacity-50"
            />
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !value || +value <= 0}
            className="w-full py-4 rounded-card text-[17px] font-semibold bg-brand text-white
                       active:scale-[0.98] disabled:opacity-40 transition-all mb-3"
          >
            {saving ? 'Saving…' : current ? 'Update Budget' : 'Set Budget'}
          </button>

          {current > 0 && (
            <button
              onClick={handleRemove}
              disabled={saving}
              className="w-full py-3 rounded-card text-[15px] font-semibold
                         bg-expense-bg text-expense-text border border-expense-border
                         active:scale-[0.98] disabled:opacity-40 transition-all"
            >
              Remove Budget
            </button>
          )}
          <div className="h-2" />
        </div>
      </motion.div>
    </>
  )
}

// ── Hero card ─────────────────────────────────────────────────────────────
// FIX (defect 4.6): MonthHeroCard previously called useMonthSummary(year, month)
// itself, creating a SECOND React Query subscription to the same key that the
// parent Monthly component already subscribes to. Both components re-rendered
// on every refetch even though they shared identical data.
//
// Fix: accept the summary data as a prop. The parent's single subscription
// feeds both the hero card and the rest of the page. Zero duplicate queries.
function MonthHeroCard({ month, year, data }) {
  const earned   = data?.earned     || 0
  const spent    = data?.expense    || 0
  const invested = data?.investment || 0
  const balance  = data?.balance    || 0
  const rate     = savingsRate(earned, spent)

  return (
    <div className="card-hero p-6 relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <p className="text-caption font-bold tracking-widest uppercase"
           style={{ color: C.heroAccent }}>
          {MONTH_NAMES[month - 1].slice(0, 3)} {year}
        </p>
        <p className="text-caption font-bold tracking-widest"
           style={{ color: C.heroDimmer }}>KOSHA</p>
      </div>

      <p className="text-caption font-medium mb-1" style={{ color: C.heroLabel }}>
        Monthly balance
      </p>
      <p className={`text-hero font-bold leading-none tabular-nums
        ${balance >= 0 ? 'text-white' : 'text-[#FFB3AF]'}`}>
        {fmt(balance)}
      </p>

      <div className="mt-2 mb-5 inline-flex items-center px-2.5 py-1 rounded-pill"
           style={{ background: C.heroAccentBg }}>
        <span className="text-caption font-semibold" style={{ color: C.heroAccentSolid }}>
          {rate}% saved
        </span>
      </div>

      <div className="border-t mb-4" style={{ borderColor: C.heroDivider }} />

      <div className="flex justify-between gap-1.5 sm:gap-2 mb-5">
        {[
          { label: 'Earned',   val: earned   },
          { label: 'Spent',    val: spent    },
          { label: 'Invested', val: invested },
        ].map(s => (
          <div key={s.label} className="flex-1 min-w-0 px-2 sm:px-3 py-2.5 rounded-2xl"
               style={{ background: C.heroStatBg }}>
            <p className="text-[11px] sm:text-caption mb-0.5 truncate" style={{ color: C.heroLabel }}>
              {s.label}
            </p>
            <p className="text-[12px] sm:text-label font-bold text-white tabular-nums truncate">
              {fmt(s.val)}
            </p>
          </div>
        ))}
      </div>

      <div>
        <div className="flex justify-between mb-2">
          <span className="text-caption" style={{ color: C.heroLabel }}>Savings rate</span>
          <span className="text-caption font-semibold text-white">{rate}%</span>
        </div>
        <div className="bar-dark-track">
          <motion.div className="bar-dark-fill"
            initial={{ width: 0 }} animate={{ width: `${rate}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
        </div>
      </div>
    </div>
  )
}

// ── Breakdown donut card ───────────────────────────────────────────────────
function BreakdownCard({ earned, spent, invested }) {
  const saved       = Math.max(0, earned - spent - invested)
  const spentPct    = earned > 0 ? Math.round((spent    / earned) * 100) : 0
  const investedPct = earned > 0 ? Math.round((invested / earned) * 100) : 0
  const savedPct    = Math.max(0, 100 - spentPct - investedPct)

  const SIZE  = 120
  const SW    = 8
  const R     = (SIZE / 2) - SW
  const CX    = SIZE / 2
  const CY    = SIZE / 2
  const CIRC  = 2 * Math.PI * R

  const LEFTOVER_COLOR = C.bills

  const segs = [
    { pct: spentPct,    color: C.expense      },
    { pct: investedPct, color: C.investText   },
    { pct: savedPct,    color: LEFTOVER_COLOR },
  ].filter(s => s.pct > 0)

  let offset = 0

  if (earned === 0) return null

  return (
    <div className="card p-5">
      <p className="section-label mb-4">Budget Breakdown</p>
      <div className="flex gap-4 items-center">
        <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            <circle cx={CX} cy={CY} r={R} fill="none"
              stroke={C.brandBorder} strokeWidth={SW} />
            {segs.map((seg, i) => {
              const dashLen       = Math.max(0, (seg.pct / 100) * CIRC)
              const currentOffset = offset
              offset += seg.pct
              return (
                <circle key={i} cx={CX} cy={CY} r={R}
                  fill="none" stroke={seg.color} strokeWidth={SW} strokeLinecap="butt"
                  strokeDasharray={`${dashLen} ${CIRC}`}
                  strokeDashoffset={-currentOffset * CIRC / 100}
                  transform={`rotate(-90 ${CX} ${CY})`}
                />
              )
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span style={{ fontSize: 15, fontWeight: 700, color: LEFTOVER_COLOR,
                           fontFamily: 'Roboto, system-ui', lineHeight: 1.1 }}>
              {savedPct}%
            </span>
            <span style={{ fontSize: 9, color: C.inkMuted, fontFamily: 'Roboto, system-ui' }}>
              leftover
            </span>
          </div>
        </div>

        <div className="flex-1 space-y-3 pt-1">
          {[
            { label: 'Spent',    val: spent,    pct: spentPct,    dot: C.expense,      color: C.expense      },
            { label: 'Invested', val: invested, pct: investedPct, dot: C.investText,   color: C.investText   },
            { label: 'Leftover', val: saved,    pct: savedPct,    dot: LEFTOVER_COLOR, color: LEFTOVER_COLOR },
          ].map(s => (
            <div key={s.label}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.dot }} />
                <span className="text-caption text-ink-3 flex-1">{s.label}</span>
                <span className="text-caption font-bold tabular-nums" style={{ color: s.color }}>
                  {s.pct}%
                </span>
              </div>
              <p className="text-caption text-ink-3 tabular-nums pl-4">{fmt(s.val)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-kosha-border">
        <div className="flex justify-between">
          <span className="text-caption text-ink-3">Total income</span>
          <span className="text-caption font-bold text-income-text tabular-nums">{fmt(earned)}</span>
        </div>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function Monthly() {
  const now   = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const monthRef = useRef(null)

  // FIX (defect 4.6): single subscription — data is passed down to MonthHeroCard
  // as a prop instead of MonthHeroCard calling useMonthSummary itself.
  const { data, loading } = useMonthSummary(year, month)
  const { budgets, setBudget, removeBudget } = useBudgets()

  const [budgetCat, setBudgetCat] = useState(null)

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

  const catEntries = useMemo(
    () => Object.entries(data?.byCategory || {}).sort((a, b) => b[1] - a[1]).slice(0, 8),
    [data?.byCategory]
  )
  const categoryTotal = useMemo(
    () => catEntries.reduce((s, [, v]) => s + v, 0) || 1,
    [catEntries]
  )
  const vehicleEntries = useMemo(
    () => Object.entries(data?.byVehicle || {}).sort((a, b) => b[1] - a[1]),
    [data?.byVehicle]
  )
  const budgetCount = useMemo(
    () => catEntries.filter(([id]) => budgets[id]).length,
    [catEntries, budgets]
  )

  const openBudgetSheet = useCallback((cat) => setBudgetCat(cat), [])

  return (
    <div className="page">
      <PageHeader title="Monthly" />

      {/* ── Month navigator ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={prev}
          className="w-9 h-9 rounded-full bg-kosha-surface border border-kosha-border
                     flex items-center justify-center active:bg-kosha-surface-2">
          <ChevronLeft size={18} className="text-ink-2" />
        </button>
        <button type="button" className="relative cursor-pointer"
          onClick={() => monthRef.current?.showPicker?.()}>
          <h1 className="text-display font-bold text-ink tracking-tight">
            {MONTH_NAMES[month - 1]} {year}
          </h1>
          <input
            ref={monthRef}
            type="month"
            value={`${year}-${String(month).padStart(2, '0')}`}
            onChange={e => {
              const [y, m] = e.target.value.split('-').map(Number)
              if (y && m) { setYear(y); setMonth(m) }
            }}
            className="absolute inset-0 opacity-0 w-full h-full pointer-events-none"
          />
        </button>
        <button onClick={next}
          className="w-9 h-9 rounded-full bg-kosha-surface border border-kosha-border
                     flex items-center justify-center active:bg-kosha-surface-2">
          <ChevronRight size={18} className="text-ink-2" />
        </button>
      </div>

      {/* ── Hero card — data prop, no second subscription ───────────── */}
      <div className="mb-6">
        <MonthHeroCard month={month} year={year} data={data} />
      </div>

      {loading ? (
        <MonthlySkeleton />
      ) : (
        <motion.div
          key={`${year}-${month}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >
          <BreakdownCard earned={earned} spent={spent} invested={invested} />

          {catEntries.length > 0 && (
            <CategorySpendingChart
              entries={catEntries}
              total={categoryTotal}
              budgets={budgets}
              month={month}
              year={year}
              subtitle={budgetCount > 0
                ? `${budgetCount} budget${budgetCount > 1 ? 's' : ''} set · tap to edit`
                : 'tap a row to set budget'}
              onCategoryClick={openBudgetSheet}
            />
          )}

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

          {earned === 0 && spent === 0 && invested === 0 && (
            <div className="card p-8 text-center">
              <p className="text-body text-ink-2">No data for this month.</p>
              <p className="text-label text-ink-3 mt-1">Navigate to a month with transactions.</p>
            </div>
          )}
        </motion.div>
      )}

      {/* ── Budget sheet ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {budgetCat && (
          <BudgetSheet
            cat={budgetCat}
            current={budgets[budgetCat.id] || 0}
            onSave={setBudget}
            onRemove={removeBudget}
            onClose={() => setBudgetCat(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
