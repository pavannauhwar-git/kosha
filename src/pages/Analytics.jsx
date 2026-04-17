import { CATEGORIES } from '../lib/categories'
import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  CashFlowChart,
  CashflowWaterfallChart,
  SurplusTrajectoryChart,
  WhatIfSimulatorCard,
  RunwayCoverageChart,
} from '../components/analytics/AnalyticsCharts'
import { useYearSummary, useYearDailyExpenseTotals } from '../hooks/useTransactions'
import { fmt } from '../lib/utils'
import { bandTextClass, scoreHealthBand, scoreRiskBand } from '../lib/insightBands'
import PageHeaderPage from '../components/layout/PageHeaderPage'
import { MONTH_SHORT } from '../lib/constants'
import { useNavigate } from 'react-router-dom'
import SkeletonLayout from '../components/common/SkeletonLayout'
import PickerNavigator from '../components/common/PickerNavigator'
import EmptyState from '../components/common/EmptyState'
import YearOverYearCards from '../components/cards/analytics/YearOverYearCards'
import YearlyPortfolioSnapshotCard from '../components/cards/analytics/YearlyPortfolioSnapshotCard'
import InvestmentConsistencyCard from '../components/cards/analytics/InvestmentConsistencyCard'
import CalendarHeatmap from '../components/cards/analytics/CalendarHeatmap'

const MIN_NAV_YEAR = 1900
const MAX_NAV_YEAR = 2100

function toFiniteNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function Analytics() {
  const navigate = useNavigate()
  const now = new Date()
  const currentYear = now.getFullYear()
  const [year, setYear] = useState(currentYear)
  const [heavyReady, setHeavyReady] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setHeavyReady(true), 260)
    return () => clearTimeout(timer)
  }, [])

  const { data, loading } = useYearSummary(year)
  const { data: yearDailyTotals, loading: yearDailyLoading } = useYearDailyExpenseTotals(year)

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

  const yearSummaryCard = useMemo(() => {
    const income = toFiniteNumber(data?.totalIncome)
    const expense = toFiniteNumber(data?.totalExpense)
    const investment = toFiniteNumber(data?.totalInvestment)
    const outflow = expense + investment
    const net = income - outflow
    const savingsRate = income > 0 ? Math.round((net / income) * 100) : 0

    const monthlyRows = (data?.monthly || [])
      .map((row) => ({
        income: toFiniteNumber(row?.income),
        expense: toFiniteNumber(row?.expense),
        investment: toFiniteNumber(row?.investment),
      }))
      .filter((row) => row.income > 0 || row.expense > 0 || row.investment > 0)

    const positiveMonths = monthlyRows.filter((row) => (row.income - row.expense - row.investment) >= 0).length
    const activeMonths = monthlyRows.length
    const band = scoreHealthBand(savingsRate, { healthy: 20, watch: 5 })

    return {
      income,
      outflow,
      net,
      savingsRate,
      positiveMonths,
      activeMonths,
      band,
    }
  }, [data?.monthly, data?.totalIncome, data?.totalExpense, data?.totalInvestment])

  const yearHealthSignal = useMemo(() => {
    const monthlyRows = (data?.monthly || [])
      .map((row) => ({
        income: toFiniteNumber(row?.income),
        expense: toFiniteNumber(row?.expense),
        investment: toFiniteNumber(row?.investment),
      }))
      .filter((row) => row.income > 0 || row.expense > 0 || row.investment > 0)

    if (!monthlyRows.length) return null

    const positiveMonths = monthlyRows.filter((row) => (row.income - row.expense - row.investment) >= 0).length
    const avgSavings = Math.round(toFiniteNumber(data?.avgSavings))

    const outflowSeries = monthlyRows
      .map((row) => row.expense + row.investment)
      .filter((value) => value > 0)

    const outflowMean = outflowSeries.length
      ? outflowSeries.reduce((sum, value) => sum + value, 0) / outflowSeries.length
      : 0

    const outflowVariance = outflowSeries.length
      ? outflowSeries.reduce((sum, value) => sum + ((value - outflowMean) ** 2), 0) / outflowSeries.length
      : 0

    const outflowCv = outflowMean > 0 ? Math.sqrt(outflowVariance) / outflowMean : 0

    const positiveScore = (positiveMonths / monthlyRows.length) * 50
    const savingsScore = clampNumber((avgSavings + 10) * 1.5, 0, 30)
    const stabilityScore = clampNumber(20 - (outflowCv * 20), 0, 20)
    const score = Math.round(positiveScore + savingsScore + stabilityScore)
    const band = scoreHealthBand(score, { healthy: 74, watch: 58 })

    return {
      score,
      band,
      positiveMonths,
      activeMonths: monthlyRows.length,
      avgSavings,
    }
  }, [data?.monthly, data?.avgSavings])

  const expenseConcentrationSignal = useMemo(() => {
    const totalExpense = toFiniteNumber(data?.totalExpense)
    if (totalExpense <= 0 || !allCatEntries.length) return null

    const topThree = allCatEntries.slice(0, 3)
    const topThreeAmount = topThree.reduce((sum, [, amount]) => sum + amount, 0)
    const topThreePct = Math.round((topThreeAmount / totalExpense) * 100)
    const topCategoryId = topThree[0]?.[0]
    const topCategoryAmount = topThree[0]?.[1] || 0
    const band = scoreRiskBand(topThreePct, { high: 65, watch: 45 })

    return {
      topThreePct,
      topCategoryLabel: categoryLabelById.get(topCategoryId) || topCategoryId || '—',
      topCategoryAmount,
      band,
    }
  }, [data?.totalExpense, allCatEntries, categoryLabelById])

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
    <PageHeaderPage title="Analytics">

      {/* ── Year navigator ────────────────────────────────────────────── */}
      <PickerNavigator
        className="mb-3"
        label={year}
        onPrev={() => setYear((y) => Math.max(MIN_NAV_YEAR, y - 1))}
        onNext={() => setYear((y) => Math.min(MAX_NAV_YEAR, y + 1))}
        mode="year"
        year={year}
        minYear={MIN_NAV_YEAR}
        maxYear={MAX_NAV_YEAR}
        onSelectYear={(selectedYear) => {
          setYear(Math.min(MAX_NAV_YEAR, Math.max(MIN_NAV_YEAR, selectedYear)))
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
              <div className="card p-3.5 border-0">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="text-[10px] text-ink-3 tracking-wide">Year summary</p>
                    <p className="text-[14px] font-semibold text-ink mt-1">{year}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-pill ${yearSummaryCard.band === 'healthy' ? 'bg-income-bg text-income-text' : yearSummaryCard.band === 'watch' ? 'bg-brand-container text-brand' : 'bg-warning-bg text-warning-text'}`}>
                    {yearSummaryCard.band === 'healthy' ? 'Healthy' : yearSummaryCard.band === 'watch' ? 'Watch' : 'Stressed'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="mini-panel px-3 py-2.5">
                    <p className="text-[10px] text-ink-3 uppercase tracking-wide">Income</p>
                    <p className="text-[13px] font-semibold tabular-nums text-income-text mt-1">{fmt(yearSummaryCard.income)}</p>
                  </div>
                  <div className="mini-panel px-3 py-2.5">
                    <p className="text-[10px] text-ink-3 uppercase tracking-wide">Outflow</p>
                    <p className="text-[13px] font-semibold tabular-nums text-ink mt-1">{fmt(yearSummaryCard.outflow)}</p>
                  </div>
                  <div className="mini-panel px-3 py-2.5">
                    <p className="text-[10px] text-ink-3 uppercase tracking-wide">Net</p>
                    <p className={`text-[13px] font-semibold tabular-nums mt-1 ${yearSummaryCard.net >= 0 ? 'text-income-text' : 'text-warning-text'}`}>
                      {yearSummaryCard.net >= 0 ? '+' : '-'}{fmt(Math.abs(yearSummaryCard.net))}
                    </p>
                  </div>
                  <div className="mini-panel px-3 py-2.5">
                    <p className="text-[10px] text-ink-3 uppercase tracking-wide">Savings</p>
                    <p className={`text-[13px] font-semibold tabular-nums mt-1 ${bandTextClass(yearSummaryCard.band)}`}>
                      {yearSummaryCard.savingsRate}%
                    </p>
                  </div>
                </div>

                <p className="text-[10px] text-ink-3 mt-2 tabular-nums">
                  {yearSummaryCard.positiveMonths}/{yearSummaryCard.activeMonths || 0} months closed positive
                </p>
              </div>

              <CalendarHeatmap
                dailyTotals={yearDailyTotals}
                year={year}
                loading={yearDailyLoading}
              />

              {(yearHealthSignal || expenseConcentrationSignal) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {yearHealthSignal && (
                    <div className="card p-3.5 border-0">
                      <p className="text-[10px] text-ink-3 tracking-wide">Year health score</p>
                      <p className={`text-[18px] font-semibold tabular-nums mt-1 ${bandTextClass(yearHealthSignal.band)}`}>
                        {yearHealthSignal.score}/100
                      </p>
                      <p className="text-[11px] text-ink-2 mt-1">
                        {yearHealthSignal.positiveMonths}/{yearHealthSignal.activeMonths} months closed positive
                      </p>
                      <p className="text-[10px] text-ink-3 mt-1 tabular-nums">
                        Avg savings rate {yearHealthSignal.avgSavings}%
                      </p>
                    </div>
                  )}

                  {expenseConcentrationSignal && (
                    <div className="card p-3.5 border-0">
                      <p className="text-[10px] text-ink-3 tracking-wide">Expense concentration</p>
                      <p className={`text-[18px] font-semibold tabular-nums mt-1 ${bandTextClass(expenseConcentrationSignal.band)}`}>
                        {expenseConcentrationSignal.topThreePct}%
                      </p>
                      <p className="text-[11px] text-ink-2 mt-1">
                        Top 3 categories share of annual spend
                      </p>
                      <p className="text-[10px] text-ink-3 mt-1 tabular-nums truncate" title={expenseConcentrationSignal.topCategoryLabel}>
                        {expenseConcentrationSignal.topCategoryLabel}: {fmt(expenseConcentrationSignal.topCategoryAmount)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              <YearlyPortfolioSnapshotCard data={data} vehicleData={vehicleData} />

            <div className="space-y-4">
              {/* ── 2. Year-over-year context ───────────────────────── */}
              {heavyReady ? (
                <YearOverYearCards years={yoyYears} currentYear={year} enabled />
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
              <CashflowWaterfallChart
                flowData={flowTrendData}
                totalIncome={data?.totalIncome}
                totalExpense={data?.totalExpense}
                totalInvestment={data?.totalInvestment}
                periodLabel="Yearly"
              />
              <SurplusTrajectoryChart netData={surplusData} />

              <InvestmentConsistencyCard monthlyData={data?.monthly} year={year} />

              <RunwayCoverageChart
                flowData={flowTrendData}
                annualSurplus={annualSurplus}
              />

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
              className="py-10"
              imageUrl="/illustrations/yearly_empty.png"
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
    </PageHeaderPage>
  )
}

