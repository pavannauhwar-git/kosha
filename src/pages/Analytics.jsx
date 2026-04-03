import { CATEGORIES } from '../lib/categories'
import { useState, useMemo, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  CashFlowChart,
  CashflowWaterfallChart,
  MonthlyCompositionAreaChart,
  SurplusTrajectoryChart,
  WhatIfSimulatorCard,
  RunwayCoverageChart,
} from '../components/dashboard/AnalyticsCharts'
import { useYearSummary, useYearDailyExpenseTotals } from '../hooks/useTransactions'
import { fmt } from '../lib/utils'
import PageHeader from '../components/layout/PageHeader'
import { MONTH_SHORT } from '../lib/constants'
import { useNavigate } from 'react-router-dom'
import SkeletonLayout from '../components/common/SkeletonLayout'
import PickerNavigator from '../components/common/PickerNavigator'
import EmptyState from '../components/common/EmptyState'
import AnnualSummaryCard from '../components/cards/analytics/AnnualSummaryCard'
import YoYCards from '../components/cards/analytics/YoYCards'
import YearlyInsightsCard from '../components/cards/analytics/YearlyInsightsCard'
import YearlyPortfolioSnapshotCard from '../components/cards/analytics/YearlyPortfolioSnapshotCard'
import InvestmentConsistencyCard from '../components/cards/analytics/InvestmentConsistencyCard'
import SavingsRateTrend from '../components/dashboard/SavingsRateTrend'
import FinancialHealthRadar from '../components/cards/analytics/FinancialHealthRadar'
import CalendarHeatmap from '../components/cards/analytics/CalendarHeatmap'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
} from 'recharts'
import { C } from '../lib/colors'

const MIN_NAV_YEAR = 1900
const MAX_NAV_YEAR = 2100

function toFiniteNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function compactTick(value) {
  const n = Number(value || 0)
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${Math.round((n / 1_000_000) * 10) / 10}M`
  if (abs >= 1_000) return `${Math.round(n / 1_000)}k`
  return `${Math.round(n)}`
}

function shortLabel(label, maxLength = 12) {
  const txt = String(label || '')
  if (txt.length <= maxLength) return txt
  return `${txt.slice(0, maxLength)}...`
}

function ParetoTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload || {}

  return (
    <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5 shadow-card min-w-[186px]">
      <p className="text-[11px] font-semibold text-ink mb-1">{row?.label || 'Category'}</p>
      <div className="space-y-0.5 text-[11px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-3">Annual spend</span>
          <span className="font-semibold tabular-nums text-ink">{fmt(Number(row?.amount || 0))}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-3">Cumulative share</span>
          <span className="font-semibold tabular-nums text-warning-text">{Math.round(Number(row?.cumulativePct || 0))}%</span>
        </div>
      </div>
    </div>
  )
}


// ── Main page ─────────────────────────────────────────────────────────────
export default function Analytics() {
  const navigate = useNavigate()
  const now = new Date()
  const currentYear = now.getFullYear()
  const [year, setYear] = useState(currentYear)
  const yearRef = useRef(null)
  const [heavyReady, setHeavyReady] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setHeavyReady(true), 260)
    return () => clearTimeout(timer)
  }, [])

  const { data, loading } = useYearSummary(year)
  const { data: prevData } = useYearSummary(year - 1, { enabled: heavyReady })
  const { data: yearDailyTotals, loading: yearDailyLoading } = useYearDailyExpenseTotals(year, { enabled: heavyReady })

  const flowTrendData = useMemo(() => (data?.monthly || [])
    .map((m, i) => ({
      name: MONTH_SHORT[i],
      Income: Math.round(toFiniteNumber(m?.income)),
      Spent: Math.round(toFiniteNumber(m?.expense)),
      Invested: Math.round(toFiniteNumber(m?.investment)),
      Outflow: Math.round(toFiniteNumber(m?.expense) + toFiniteNumber(m?.investment)),
    })), [data?.monthly])

  const surplusData = useMemo(() => (data?.monthly || [])
    .map((m, i) => ({
      name: MONTH_SHORT[i],
      Net: Math.round(toFiniteNumber(m?.income) - toFiniteNumber(m?.expense) - toFiniteNumber(m?.investment)),
    })), [data?.monthly])

  const yoyYears = useMemo(() => {
    const startYear = Math.max(MIN_NAV_YEAR, year - 7)
    return Array.from({ length: year - startYear + 1 }, (_, index) => startYear + index)
      .filter((value) => value >= MIN_NAV_YEAR && value <= MAX_NAV_YEAR)
  }, [year])

  const allCatEntries = useMemo(() => Object.entries(data?.byCategory || {})
    .map(([key, value]) => [key, toFiniteNumber(value)])
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]), [data?.byCategory])
  const categoryLabelById = useMemo(() => {
    return new Map(CATEGORIES.map((category) => [category.id, category.label]))
  }, [])
  const catEntries = useMemo(() => allCatEntries.slice(0, 8), [allCatEntries])
  const categoryTotal = useMemo(() => allCatEntries.reduce((s, [, v]) => s + v, 0) || 1, [allCatEntries])

  const scenarioCategories = useMemo(() => allCatEntries.map(([id, value]) => ({
    id,
    label: categoryLabelById.get(id) || id,
    value: toFiniteNumber(value),
  })), [allCatEntries, categoryLabelById])

  const annualSurplus = useMemo(
    () => Math.round(
      toFiniteNumber(data?.totalIncome)
      - toFiniteNumber(data?.totalExpense)
      - toFiniteNumber(data?.totalInvestment)
    ),
    [data?.totalIncome, data?.totalExpense, data?.totalInvestment]
  )

  const vehicleData = useMemo(
    () => Object.entries(data?.byVehicle || {})
      .map(([key, value]) => [key, toFiniteNumber(value)])
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1]),
    [data?.byVehicle]
  )

  const strategicRecommendations = useMemo(() => {
    const items = []
    const totalIncome = Number(data?.totalIncome || 0)
    const totalExpense = Number(data?.totalExpense || 0)
    const totalInvestment = Number(data?.totalInvestment || 0)
    const annualNet = totalIncome - totalExpense - totalInvestment

    if (totalIncome > 0) {
      const netPct = Math.round((annualNet / totalIncome) * 100)
      const deployPct = Math.round((totalInvestment / totalIncome) * 100)

      items.push(
        `Annual ${annualNet >= 0 ? 'surplus' : 'deficit'} is ${annualNet >= 0 ? '+' : '-'}${fmt(Math.abs(annualNet))} (${netPct}% of income).`
      )

      items.push(
        `Investments total ${fmt(totalInvestment)} this year at a ${deployPct}% deployment rate.`
      )
    }

    if (allCatEntries.length > 0) {
      const [topCategoryId, topCategoryAmount] = allCatEntries[0]
      const topCategoryLabel = categoryLabelById.get(topCategoryId) || String(topCategoryId).replace(/_/g, ' ')
      const expenseBase = Math.max(1, Number(data?.totalExpense || 0))
      const topCategoryShare = Math.round((Number(topCategoryAmount || 0) / expenseBase) * 100)
      items.push(`${topCategoryLabel} drove ${topCategoryShare}% of yearly spend (${fmt(Number(topCategoryAmount || 0))}).`)
    }

    if (!items.length) {
      items.push('Add more transaction history to unlock actionable yearly recommendations.')
    }

    return items.slice(0, 3)
  }, [data, allCatEntries, categoryLabelById])

  const categoryPareto = useMemo(() => {
    if (!allCatEntries.length) {
      return {
        hasData: false,
        rows: [],
        topShare: 0,
        categoriesFor80Pct: 0,
      }
    }

    const head = allCatEntries.slice(0, 8)
    const tailTotal = allCatEntries.slice(8).reduce((sum, [, value]) => sum + value, 0)
    const paretoSource = tailTotal > 0 ? [...head, ['other_categories', tailTotal]] : head

    let running = 0
    const rows = paretoSource.map(([id, amount]) => {
      running += amount
      const label = id === 'other_categories'
        ? 'Other categories'
        : (categoryLabelById.get(id) || String(id).replace(/_/g, ' '))

      return {
        id,
        label,
        shortLabel: shortLabel(label, 10),
        amount,
        cumulativePct: Math.round((running / categoryTotal) * 100),
      }
    })

    const index80 = rows.findIndex((row) => row.cumulativePct >= 80)

    return {
      hasData: rows.length > 0,
      rows,
      topShare: Math.round(((rows[0]?.amount || 0) / categoryTotal) * 100),
      topAmount: Number(rows[0]?.amount || 0),
      topLabel: rows[0]?.label || '—',
      categoriesFor80Pct: index80 >= 0 ? index80 + 1 : rows.length,
    }
  }, [allCatEntries, categoryLabelById, categoryTotal])

  const decisionSignals = useMemo(() => {
    if (!flowTrendData.length || !surplusData.length) return []

    const highestBurn = flowTrendData
      .map((row) => ({
        name: row.name,
        burn: row.Income > 0 ? Math.round((row.Outflow / row.Income) * 100) : 0,
      }))
      .sort((a, b) => b.burn - a.burn)[0]

    const strongestSurplus = [...surplusData].sort((a, b) => b.Net - a.Net)[0]
    const deepestDip = [...surplusData].sort((a, b) => a.Net - b.Net)[0]
    const heaviestDeploy = flowTrendData
      .map((row) => ({
        name: row.name,
        share: row.Income > 0 ? Math.round((row.Invested / row.Income) * 100) : 0,
      }))
      .sort((a, b) => b.share - a.share)[0]

    return [
      `Highest cash burn month: ${highestBurn?.name || '—'} at ${highestBurn?.burn || 0}% outflow-to-income ratio.`,
      `Strongest surplus month: ${strongestSurplus?.name || '—'} with ${fmt(strongestSurplus?.Net || 0)} leftover.`,
      `Deepest monthly dip: ${deepestDip?.name || '—'} at ${fmt(Math.abs(deepestDip?.Net || 0))} below zero.`,
      `Highest investment deployment: ${heaviestDeploy?.name || '—'} at ${heaviestDeploy?.share || 0}% of monthly income.`,
    ]
  }, [flowTrendData, surplusData])

  const hasYearData = useMemo(() => {
    return (
      Number(data?.totalIncome || 0) > 0 ||
      Number(data?.totalExpense || 0) > 0 ||
      Number(data?.totalInvestment || 0) > 0 ||
      allCatEntries.length > 0 ||
      vehicleData.length > 0
    )
  }, [
    data?.totalIncome,
    data?.totalExpense,
    data?.totalInvestment,
    allCatEntries.length,
    vehicleData.length,
  ])

  return (
    <div className="page">
      <PageHeader title="Analytics" className="mb-3" />

      {/* ── Year navigator ────────────────────────────────────────────── */}
      <PickerNavigator
        className="mb-3"
        label={year}
        onPrev={() => setYear((y) => Math.max(MIN_NAV_YEAR, y - 1))}
        onNext={() => setYear((y) => Math.min(MAX_NAV_YEAR, y + 1))}
        pickerRef={yearRef}
        inputType="month"
        inputValue={`${year}-01`}
        onInputChange={e => {
          const y = parseInt(e.target.value?.split('-')[0], 10)
          if (!y) return
          setYear(Math.min(MAX_NAV_YEAR, Math.max(MIN_NAV_YEAR, y)))
        }}
      />

      {loading ? (
        <SkeletonLayout
          sections={[
            { type: 'grid', cols: 2, count: 4, height: 'h-[110px]' },
            { type: 'block', height: 'h-[220px]' },
            { type: 'block', height: 'h-[170px]' },
            { type: 'block', height: 'h-[180px]' },
          ]}
        />
      ) : (
        <motion.div key={year}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="page-stack"
        >
          {hasYearData ? (
            <>
              <AnnualSummaryCard
                data={data}
                prevData={prevData}
                year={year}
              />

              {heavyReady && (
                <FinancialHealthRadar
                  data={data}
                  prevData={prevData}
                  year={year}
                />
              )}

              <YearlyInsightsCard
                year={year}
                data={data}
                catEntries={catEntries}
                strategicRecommendations={strategicRecommendations}
                decisionSignals={decisionSignals}
              />

              <YearlyPortfolioSnapshotCard data={data} vehicleData={vehicleData} />

            <div className="space-y-4">
              {/* ── 2. Year-over-year context ───────────────────────── */}
              {heavyReady ? (
                <YoYCards years={yoyYears} currentYear={year} enabled />
              ) : (
                <div className="card p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="section-label">Year over year trends</p>
                    <span className="text-caption text-ink-3">Preparing</span>
                  </div>
                  <p className="text-[12px] text-ink-3">Preparing comparison data...</p>
                </div>
              )}

              {/* ── 3. Performance trends ─────────────────────────────── */}
              <CashFlowChart
                chartData={flowTrendData}
                totalIncome={data?.totalIncome}
              />
              <MonthlyCompositionAreaChart flowData={flowTrendData} />
              <CashflowWaterfallChart
                flowData={flowTrendData}
                totalIncome={data?.totalIncome}
                totalExpense={data?.totalExpense}
                totalInvestment={data?.totalInvestment}
              />
              <SurplusTrajectoryChart netData={surplusData} />

              <SavingsRateTrend flowTrendData={flowTrendData} monthLabels={MONTH_SHORT} />

              <InvestmentConsistencyCard monthlyData={data?.monthly} year={year} />

              <CalendarHeatmap
                dailyTotals={yearDailyTotals}
                year={year}
                loading={yearDailyLoading}
              />

              <RunwayCoverageChart
                flowData={flowTrendData}
                annualSurplus={annualSurplus}
              />

              {categoryPareto.hasData && (
                <div className="card p-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-label font-semibold text-ink">Category Pareto frontier</p>
                      <p className="text-[11px] text-ink-3 mt-0.5">Bar + cumulative line to show which categories drive most annual spend.</p>
                    </div>
                    <span className="text-[11px] px-2 py-1 rounded-pill font-semibold bg-brand-accent text-brand-on tabular-nums">
                      Top {categoryPareto.topShare}% · {fmt(categoryPareto.topAmount, true)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-2.5">
                    <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
                      <p className="text-[10px] text-ink-3">Categories for 80%</p>
                      <p className="text-[12px] font-bold tabular-nums text-ink">{categoryPareto.categoriesFor80Pct}</p>
                    </div>
                    <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
                      <p className="text-[10px] text-ink-3">Top category</p>
                      <p className="text-[12px] font-bold tabular-nums text-brand" title={categoryPareto.topLabel}>{categoryPareto.topLabel}</p>
                      <p className="text-[10px] tabular-nums text-ink-3 mt-0.5">{fmt(categoryPareto.topAmount, true)}</p>
                    </div>
                  </div>

                  <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5 mb-2 md:mb-0 md:hidden space-y-1.5">
                    {categoryPareto.rows.map((row) => (
                      <div key={`pareto-mobile-${row.id}`} className="rounded-card border border-kosha-border bg-kosha-surface-2 px-2.5 py-2">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-[11px] font-semibold text-ink truncate">{row.label}</p>
                          <p className="text-[10px] tabular-nums text-ink shrink-0">{fmt(row.amount, true)} · {row.cumulativePct}%</p>
                        </div>
                        <div className="h-1.5 rounded-pill bg-kosha-border overflow-hidden">
                          <div className="h-full rounded-pill bg-brand" style={{ width: `${Math.max(6, Math.min(100, row.cumulativePct))}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5 hidden md:block">
                    <ResponsiveContainer width="100%" height={228}>
                      <ComposedChart data={categoryPareto.rows} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(16,33,63,0.10)" />
                        <XAxis
                          dataKey="shortLabel"
                          tick={{ fontSize: 10, fill: 'rgba(94,109,143,0.95)', fontWeight: 600 }}
                          axisLine={false}
                          tickLine={false}
                          interval={0}
                        />
                        <YAxis
                          yAxisId="amount"
                          tickFormatter={compactTick}
                          tick={{ fontSize: 10, fill: 'rgba(94,109,143,0.95)' }}
                          axisLine={false}
                          tickLine={false}
                          width={34}
                        />
                        <YAxis
                          yAxisId="pct"
                          orientation="right"
                          domain={[0, 100]}
                          tickFormatter={(value) => `${Math.round(value)}%`}
                          tick={{ fontSize: 10, fill: 'rgba(94,109,143,0.95)' }}
                          axisLine={false}
                          tickLine={false}
                          width={34}
                        />
                        <RechartsTooltip content={<ParetoTooltip />} />
                        <ReferenceLine yAxisId="pct" y={80} stroke={C.invest} strokeDasharray="4 4" strokeOpacity={0.7} />
                        <Bar yAxisId="amount" dataKey="amount" fill={C.brand} radius={[6, 6, 0, 0]} maxBarSize={22} />
                        <Line yAxisId="pct" type="monotone" dataKey="cumulativePct" stroke={C.invest} strokeWidth={2.4} dot={{ r: 3 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <WhatIfSimulatorCard
                categories={scenarioCategories}
                totalIncome={data?.totalIncome}
                totalExpense={data?.totalExpense}
                totalInvestment={data?.totalInvestment}
              />

              {/* Spent-by-category section intentionally removed; yearly portfolio lives in the snapshot card above. */}
            </div>
            </>
          ) : (
            <EmptyState
              title={`No data for ${year}`}
              description="This year is empty right now. Add transactions to unlock yearly trends, category intelligence, and YoY comparisons."
              actionLabel={year === currentYear ? 'Add transaction' : 'Go to current year'}
              onAction={() => {
                if (year === currentYear) {
                  navigate('/transactions')
                  return
                }
                setYear(currentYear)
              }}
              secondaryLabel={year === currentYear ? undefined : 'Add transaction'}
              onSecondaryAction={year === currentYear ? undefined : () => navigate('/transactions')}
            />
          )}

        </motion.div>
      )}
    </div>
  )
}

