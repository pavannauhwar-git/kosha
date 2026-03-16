import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMonthSummary } from '../hooks/useTransactions'
import CategoryIcon from '../components/CategoryIcon'
import { fmt, savingsRate } from '../lib/utils'
import PullToRefresh from '../components/PullToRefresh'
import ProfileMenu from '../components/ProfileMenu'

// ── SVG arc bar — round-capped, same as Dashboard Spending Pulse ──────────
function SvgArcBar({ pct, color }) {
  const W   = 100
  const H   = 6
  const R   = H / 2
  const max = W - R * 2
  const fill = Math.max(0, Math.min(pct, 100)) / 100 * max
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <line x1={R} y1={R} x2={W - R} y2={R}
        stroke="#D4CEFF" strokeWidth={H} strokeLinecap="round" />
      {fill > 0 && (
        <line x1={R} y1={R} x2={R + fill} y2={R}
          stroke={color} strokeWidth={H} strokeLinecap="round" />
      )}
    </svg>
  )
}
import { C } from '../lib/colors'
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
           style={{ color:C.heroAccent }}>
          {MONTH_NAMES[month - 1].slice(0, 3)} {year}
        </p>
        <p className="text-caption font-bold tracking-widest"
           style={{ color:C.heroDimmer }}>KOSHA</p>
      </div>

      <p className="text-caption font-medium mb-1" style={{ color:C.heroLabel }}>
        Monthly balance
      </p>
      <p className={`text-hero font-bold leading-none tabular-nums
        ${balance >= 0 ? 'text-white' : 'text-[#FFB3AF]'}`}>
        {fmt(balance)}
      </p>

      <div className="mt-2 mb-5 inline-flex items-center px-2.5 py-1 rounded-pill"
           style={{ background:C.heroAccentBg }}>
        <span className="text-caption font-semibold" style={{ color:C.heroAccentSolid }}>
          {rate}% saved
        </span>
      </div>

      <div className="border-t mb-4" style={{ borderColor:C.heroDivider }} />

      <div className="flex justify-between mb-5">
        {[
          { label:'Earned',   val:earned   },
          { label:'Spent',    val:spent    },
          { label:'Invested', val:invested },
        ].map(s => (
          <div key={s.label} className="px-3 py-2.5 rounded-2xl"
               style={{ background:C.heroStatBg }}>
            <p className="text-caption mb-0.5" style={{ color:C.heroLabel }}>{s.label}</p>
            <p className="text-label font-bold text-white tabular-nums">{fmt(s.val)}</p>
          </div>
        ))}
      </div>

      <div>
        <div className="flex justify-between mb-2">
          <span className="text-caption" style={{ color:C.heroLabel }}>Savings rate</span>
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
  const { data, loading, refetch } = useMonthSummary(year, month)

  function prev() {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function next() {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const handleRefresh = useCallback(() => {
    refetch()
  }, [refetch])

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
      <PullToRefresh onRefresh={handleRefresh} />

      {/* ── Month navigator + profile ─────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6 pt-2">
        <button onClick={prev}
          className="w-9 h-9 rounded-full bg-kosha-surface border border-kosha-border
                     flex items-center justify-center active:bg-kosha-surface-2">
          <ChevronLeft size={18} className="text-ink-2" />
        </button>
        <h1 className="text-display font-bold text-ink tracking-tight">
          {MONTH_NAMES[month - 1]} {year}
        </h1>
        <div className="flex items-center gap-2">
          <button onClick={next}
            className="w-9 h-9 rounded-full bg-kosha-surface border border-kosha-border
                       flex items-center justify-center active:bg-kosha-surface-2">
            <ChevronRight size={18} className="text-ink-2" />
          </button>
          <ProfileMenu />
        </div>
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

            {/* Donut + rows side-by-side */}
            <div className="flex gap-4 items-start">

              {/* Pure SVG donut — no recharts, no clipping */}
              {(() => {
                const SIZE = 110
                const SW   = 10        // stroke-width
                const R    = (SIZE / 2) - SW
                const CX   = SIZE / 2
                const CY   = SIZE / 2
                const CIRC = 2 * Math.PI * R

                // Build arc segments from proportions
                const segs = [
                  { pct: spentPct,    color: C.expense },
                  { pct: investedPct, color: C.investText },
                  { pct: savedPct,    color: C.brand },
                ].filter(s => s.pct > 0)

                const GAP_DEG = 3
                let offset = 0

                return (
                  <div className="relative shrink-0" style={{ width: SIZE, height: SIZE }}>
                    <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}
                         style={{ overflow: 'visible' }}>
                      {/* Track */}
                      <circle cx={CX} cy={CY} r={R}
                        fill="none" stroke={C.brandBorder} strokeWidth={SW} />
                      {/* Coloured arcs */}
                      {segs.map((s, i) => {
                        const gapFrac = (GAP_DEG / 360) * CIRC
                        const arcLen  = (s.pct / 100) * CIRC - gapFrac
                        const dashArr = `${Math.max(arcLen, 0)} ${CIRC}`
                        const dashOff = -(offset / 100) * CIRC
                        const node = (
                          <circle key={i} cx={CX} cy={CY} r={R}
                            fill="none"
                            stroke={s.color}
                            strokeWidth={SW}
                            strokeDasharray={dashArr}
                            strokeDashoffset={dashOff}
                            strokeLinecap="round"
                            transform={`rotate(-90 ${CX} ${CY})`}
                          />
                        )
                        offset += s.pct
                        return node
                      })}
                    </svg>
                    {/* Center label */}
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

              {/* Breakdown rows */}
              <div className="flex-1 space-y-3 pt-1">
                {[
                  { label:'Spent',    val:spent,    pct:spentPct,    dot:C.expense, textCls:'text-expense-text' },
                  { label:'Invested', val:invested, pct:investedPct, dot:C.investText, textCls:'text-invest-text'  },
                  { label:'Saved',    val:saved,    pct:savedPct,    dot:C.brand, textCls:'text-brand'        },
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
                        <SvgArcBar pct={pct} color={cat?.color || C.income} />
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
