import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useMonthSummary } from '../hooks/useTransactions'
import { useBudgets } from '../hooks/useBudgets'
import CategoryIcon from '../components/CategoryIcon'
import { fmt, savingsRate } from '../lib/utils'
import { C } from '../lib/colors'
import { CATEGORIES } from '../lib/categories'

// ── SVG arc bar ───────────────────────────────────────────────────────────
function SvgArcBar({ pct, color, overBudget = false }) {
  const W    = 100
  const H    = 6
  const R    = H / 2
  const max  = W - R * 2
  const fill = Math.max(0, Math.min(pct, 100)) / 100 * max
  const barColor = overBudget ? '#E11D48' : color
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <line x1={R} y1={R} x2={W - R} y2={R}
        stroke="#D4CEFF" strokeWidth={H} strokeLinecap="round" />
      {fill > 0 && (
        <line x1={R} y1={R} x2={R + fill} y2={R}
          stroke={barColor} strokeWidth={H} strokeLinecap="round" />
      )}
    </svg>
  )
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
]

// ── Budget input sheet ────────────────────────────────────────────────────
// Bottom sheet for setting/editing/removing a budget for one category.
function BudgetSheet({ cat, current, onSave, onRemove, onClose }) {
  const [value, setValue] = useState(current ? String(current) : '')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const amt = parseFloat(value)
    if (!amt || amt <= 0) return
    setSaving(true)
    try { await onSave(cat.id, amt); onClose() }
    catch { /* error handled by hook */ }
    finally { setSaving(false) }
  }

  async function handleRemove() {
    setSaving(true)
    try { await onRemove(cat.id); onClose() }
    catch {}
    finally { setSaving(false) }
  }

  return (
    <>
      <motion.div className="sheet-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }}
        onClick={onClose}
      />
      <motion.div className="sheet-panel"
        initial={{ y: '100%' }}
        animate={{ y: 0, transition: { type: 'spring', stiffness: 400, damping: 32 } }}
        exit={{ y: '100%', transition: { duration: 0.22 } }}
      >
        <div className="sheet-handle" />
        <div className="px-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <CategoryIcon categoryId={cat.id} size={18} />
              <h2 className="text-[20px] font-bold text-ink">{cat.label} Budget</h2>
            </div>
            <button onClick={onClose} className="close-btn">
              <X size={16} className="text-ink-3" />
            </button>
          </div>

          {/* Amount input */}
          <p className="text-caption text-ink-3 mb-2">Monthly limit</p>
          <div className="bg-kosha-surface-2 rounded-card px-4 py-3 mb-5 flex items-center gap-2">
            <span className="font-display text-2xl font-bold text-brand">₹</span>
            <input
              type="number" inputMode="decimal" placeholder="0"
              value={value}
              onChange={e => setValue(e.target.value)}
              autoFocus
              className="flex-1 bg-transparent font-display text-3xl font-bold text-ink
                         outline-none tabular-nums placeholder-ink-4"
            />
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving || !value || +value <= 0}
            className="w-full py-4 rounded-card text-[17px] font-semibold bg-brand text-white
                       active:scale-[0.98] disabled:opacity-40 transition-all mb-3"
          >
            {saving ? 'Saving…' : current ? 'Update Budget' : 'Set Budget'}
          </button>

          {/* Remove (only shown when a budget already exists) */}
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
function MonthHeroCard({ month, year }) {
  const { data } = useMonthSummary(year, month)
  const earned   = data?.earned     || 0
  const spent    = data?.expense    || 0
  const invested = data?.investment || 0
  const balance  = data?.balance    || 0
  const rate     = savingsRate(earned, spent)

  const spentPct    = earned > 0 ? Math.round((spent    / earned) * 100) : 0
  const investedPct = earned > 0 ? Math.round((invested / earned) * 100) : 0
  const savedPct    = Math.max(0, 100 - spentPct - investedPct)

  const CX = 44, CY = 44, R = 36, SW = 8
  const CIRC   = 2 * Math.PI * R
  const GAP_DEG = 4

  const segments = [
    { pct: spentPct,    color: '#E11D48' },
    { pct: investedPct, color: '#BE185D' },
    { pct: savedPct,    color: '#3730A3' },
  ]

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

      <div className="flex justify-between mb-5">
        {[
          { label: 'Earned',   val: earned   },
          { label: 'Spent',    val: spent    },
          { label: 'Invested', val: invested },
        ].map(s => (
          <div key={s.label} className="px-3 py-2.5 rounded-2xl"
               style={{ background: C.heroStatBg }}>
            <p className="text-caption mb-0.5" style={{ color: C.heroLabel }}>{s.label}</p>
            <p className="text-label font-bold text-white tabular-nums">{fmt(s.val)}</p>
          </div>
        ))}
      </div>

      {/* Donut + breakdown */}
      <div className="flex items-center gap-4">
        {(() => {
          let offset = 0
          return (
            <div className="relative shrink-0" style={{ width: 88, height: 88 }}>
              <svg width={88} height={88} viewBox="0 0 88 88">
                {segments.map((seg, i) => {
                  const dashLen = Math.max(0, (seg.pct / 100) * CIRC - (GAP_DEG / 360) * CIRC)
                  const currentOffset = offset
                  offset += seg.pct
                  return (
                    <circle key={i} cx={CX} cy={CY} r={R}
                      fill="none" stroke={seg.color} strokeWidth={SW}
                      strokeDasharray={`${dashLen} ${CIRC}`}
                      strokeDashoffset={-currentOffset * CIRC / 100}
                      transform={`rotate(-90 ${CX} ${CY})`}
                    />
                  )
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span style={{ fontSize: 15, fontWeight: 700, color: C.brand,
                               fontFamily: 'Plus Jakarta Sans, system-ui', lineHeight: 1.1 }}>
                  {savedPct}%
                </span>
                <span style={{ fontSize: 9, color: C.inkMuted,
                               fontFamily: 'Plus Jakarta Sans, system-ui' }}>
                  saved
                </span>
              </div>
            </div>
          )
        })()}

        <div className="flex-1 space-y-3 pt-1">
          {[
            { label: 'Spent',    val: spent,    pct: spentPct,    dot: C.expense,    textCls: 'text-expense-text' },
            { label: 'Invested', val: invested, pct: investedPct, dot: C.investText, textCls: 'text-invest-text'  },
            { label: 'Saved',    val: Math.max(0, earned - spent - invested), pct: savedPct, dot: C.brand, textCls: 'text-brand' },
          ].map(s => (
            <div key={s.label}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: s.dot }} />
                <span className="text-caption text-ink-3 flex-1">{s.label}</span>
                <span className={`text-caption font-bold tabular-nums ${s.textCls}`}>{s.pct}%</span>
              </div>
              <p className="text-caption text-ink-3 tabular-nums pl-4">{fmt(s.val)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t space-y-1.5" style={{ borderColor: C.heroDivider }}>
        <div className="flex justify-between">
          <span className="text-caption" style={{ color: C.heroLabel }}>Total income</span>
          <span className="text-caption font-bold text-white tabular-nums">{fmt(earned)}</span>
        </div>
        {(data?.repayments || 0) > 0 && (
          <div className="flex justify-between">
            <span className="text-caption" style={{ color: C.heroLabel }}>Repayments received</span>
            <span className="text-caption font-semibold tabular-nums"
                  style={{ color: 'rgba(255,255,255,0.7)' }}>{fmt(data.repayments)}</span>
          </div>
        )}
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
  const { budgets, setBudget, removeBudget } = useBudgets()

  // Budget sheet state
  const [budgetCat, setBudgetCat] = useState(null)  // category object | null

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

  // Show top 8 categories (more useful with budgets visible)
  const catEntries = Object.entries(data?.byCategory || {})
    .sort((a, b) => b[1] - a[1]).slice(0, 8)
  const totalCatSpend = catEntries.reduce((s, [, v]) => s + v, 0) || 1

  const vehicleEntries = Object.entries(data?.byVehicle || {})
    .sort((a, b) => b[1] - a[1])

  // Count how many categories have budgets set — shown in section header
  const budgetCount = catEntries.filter(([id]) => budgets[id]).length

  const openBudgetSheet = useCallback((cat) => {
    setBudgetCat(cat)
  }, [])

  return (
    <div className="page">

      {/* ── Month navigator ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6 pr-14">
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
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-6"
        >

          {/* ── Budget summary strip ─────────────────────────────────── */}
          {catEntries.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="section-label">Spent by Category</p>
              <span className="text-caption text-ink-3">
                {budgetCount > 0
                  ? `${budgetCount} budget${budgetCount > 1 ? 's' : ''} set · tap to edit`
                  : 'tap a row to set budget'}
              </span>
            </div>
          )}

          {/* ── Category rows with budget overlay ───────────────────── */}
          {catEntries.length > 0 && (
            <div className="card p-0 overflow-hidden -mt-3">
              {catEntries.map(([catId, amt], i) => {
                const cat        = CATEGORIES.find(c => c.id === catId)
                const budget     = budgets[catId] || 0
                const hasBudget  = budget > 0
                // If budget set: bar shows spent vs budget. Else: % of total spend.
                const barPct     = hasBudget
                  ? Math.min(Math.round((amt / budget) * 100), 100)
                  : Math.round((amt / totalCatSpend) * 100)
                const overBudget = hasBudget && amt > budget
                const remaining  = hasBudget ? budget - amt : null

                return (
                  <button
                    key={catId}
                    onClick={() => openBudgetSheet(cat)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left
                                active:bg-kosha-surface-2 transition-colors
                                ${i < catEntries.length - 1 ? 'border-b border-kosha-border' : ''}`}
                  >
                    {/* Category icon */}
                    <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0"
                         style={{ background: cat?.bg || '#F5F5F5' }}>
                      <CategoryIcon categoryId={catId} size={16} />
                    </div>

                    {/* Name + bar + budget labels */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-label font-medium text-ink truncate">
                          {cat?.label || catId}
                        </span>
                        {/* Budget status label */}
                        {hasBudget ? (
                          <span className={`text-caption ml-2 shrink-0 font-semibold
                            ${overBudget ? 'text-expense-text' : 'text-ink-3'}`}>
                            {overBudget
                              ? `+${fmt(Math.abs(remaining))} over`
                              : `${fmt(remaining)} left`}
                          </span>
                        ) : (
                          <span className="text-caption text-ink-4 ml-2 shrink-0">
                            {Math.round((amt / totalCatSpend) * 100)}%
                          </span>
                        )}
                      </div>

                      {/* Progress bar */}
                      <SvgArcBar
                        pct={barPct}
                        color={cat?.color || C.income}
                        overBudget={overBudget}
                      />

                      {/* Budget sub-label: "₹3,200 of ₹5,000" */}
                      {hasBudget && (
                        <p className={`text-caption mt-1 tabular-nums
                          ${overBudget ? 'text-expense-text' : 'text-ink-3'}`}>
                          {fmt(amt)} of {fmt(budget)}
                        </p>
                      )}
                    </div>

                    {/* Spent amount */}
                    <span className={`text-label font-semibold tabular-nums ml-2 shrink-0
                      ${overBudget ? 'text-expense-text' : 'text-expense-text'}`}>
                      {fmt(amt)}
                    </span>
                  </button>
                )
              })}
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

          {/* ── Empty state ──────────────────────────────────────────── */}
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
