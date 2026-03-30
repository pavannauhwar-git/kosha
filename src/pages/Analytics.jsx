import { CATEGORIES } from '../lib/categories'
import { useState, useMemo, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  CashFlowChart,
  MoneyFlowComparisonChart,
  CashflowWaterfallChart,
  MonthlyCompositionAreaChart,
  SurplusTrajectoryChart,
  WhatIfSimulatorCard,
  RunwayCoverageChart,
  VolatilityScoreCard,
} from '../components/dashboard/AnalyticsCharts'
import { useYearSummary, useTransactions } from '../hooks/useTransactions'
import { fmt } from '../lib/utils'
import PageHeader from '../components/layout/PageHeader'
import { MONTH_SHORT } from '../lib/constants'
import { useNavigate } from 'react-router-dom'
import SkeletonLayout from '../components/common/SkeletonLayout'
import PickerNavigator from '../components/common/PickerNavigator'
import EmptyState from '../components/common/EmptyState'
import SectionHeader from '../components/common/SectionHeader'
import AnnualSummaryCard from '../components/cards/analytics/AnnualSummaryCard'
import YoYCards from '../components/cards/analytics/YoYCards'
import YearlyInsightsCard from '../components/cards/analytics/YearlyInsightsCard'
import YearlyPortfolioSnapshotCard from '../components/cards/analytics/YearlyPortfolioSnapshotCard'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
} from 'recharts'

const MIN_NAV_YEAR = 1900
const MAX_NAV_YEAR = 2100

function toFiniteNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function ConcentrationTrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload || {}

  return (
    <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5 shadow-card">
      <p className="text-[11px] font-semibold text-ink mb-1">{label}</p>
      <div className="flex items-center justify-between gap-3 text-[11px]">
        <span className="text-ink-3">Top-3 share</span>
        <span className="font-semibold tabular-nums text-warning-text">{Math.round(Number(row.share || 0))}%</span>
      </div>
      <div className="flex items-center justify-between gap-3 text-[11px] mt-0.5">
        <span className="text-ink-3">Expense base</span>
        <span className="font-semibold tabular-nums text-ink">{fmt(Number(row.total || 0))}</span>
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
  const [yoyRange, setYoyRange] = useState(3)
  const [chartMode, setChartMode] = useState('advanced')
  const yearRef = useRef(null)
  const [heavyReady, setHeavyReady] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setHeavyReady(true), 260)
    return () => clearTimeout(timer)
  }, [])

  const { data, loading } = useYearSummary(year)
  const { data: prevData } = useYearSummary(year - 1, { enabled: heavyReady })
  const { data: yearCategoryRows = [] } = useTransactions({
    startDate: `${year}-01-01`,
    endDate: `${year}-12-31`,
    limit: 2600,
    enabled: heavyReady,
    columns: 'id,date,type,amount,category',
  })

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
    return Array.from({ length: yoyRange }, (_, i) => year - (yoyRange - 1) + i)
      .filter((y) => y >= MIN_NAV_YEAR && y <= MAX_NAV_YEAR)
  }, [year, yoyRange])

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

    if (totalIncome > 0) {
      const savingsPct = Math.round(((totalIncome - totalExpense - totalInvestment) / totalIncome) * 100)
      if (savingsPct < 15) {
        items.push(`Savings rate is ${savingsPct}%. Reduce discretionary spend by 5-10% next month to improve buffer.`)
      } else {
        items.push(`Savings rate is ${savingsPct}%. Maintain this pace and route surplus into planned investments.`)
      }
    }

    return items.slice(0, 3)
  }, [data])

  const concentrationRiskTrend = useMemo(() => {
    const monthCategoryMaps = Array.from({ length: 12 }, () => new Map())

    for (const row of (Array.isArray(yearCategoryRows) ? yearCategoryRows : [])) {
      if (row?.type !== 'expense') continue

      const amount = Number(row?.amount || 0)
      if (!Number.isFinite(amount) || amount <= 0) continue

      const monthNum = Number(String(row?.date || '').slice(5, 7))
      const monthIndex = monthNum - 1
      if (monthIndex < 0 || monthIndex > 11) continue

      const category = row?.category || 'other'
      const categoryMap = monthCategoryMaps[monthIndex]
      categoryMap.set(category, (categoryMap.get(category) || 0) + amount)
    }

    const series = monthCategoryMaps.map((categoryMap, index) => {
      const totals = [...categoryMap.values()].sort((a, b) => b - a)
      const total = totals.reduce((sum, value) => sum + value, 0)
      const top3 = totals.slice(0, 3).reduce((sum, value) => sum + value, 0)
      const share = total > 0 ? Math.round((top3 / total) * 100) : 0

      return {
        month: MONTH_SHORT[index],
        share,
        total,
      }
    })

    const activeSeries = series.filter((row) => row.total > 0)
    const avgShare = activeSeries.length
      ? Math.round(activeSeries.reduce((sum, row) => sum + row.share, 0) / activeSeries.length)
      : 0

    return {
      hasData: activeSeries.length > 0,
      series,
      avgShare,
      highRiskMonths: activeSeries.filter((row) => row.share >= 65).length,
    }
  }, [yearCategoryRows])

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

              {strategicRecommendations.length > 0 && (
                <motion.div whileHover={{ y: -1 }} transition={{ duration: 0.14 }} className="card p-4">
                  <SectionHeader
                    className="mb-1"
                    title="So what now?"
                    rightText="Actionable next steps"
                  />
                  <div className="space-y-2.5">
                    {strategicRecommendations.map((line, i) => (
                      <div key={line} className="flex items-start gap-2.5">
                        <span className="text-[11px] font-bold text-brand mt-0.5 shrink-0 w-4 text-right">{i + 1}</span>
                        <p className="text-[12px] text-ink-2 leading-relaxed">{line}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              <YearlyInsightsCard data={data} catEntries={catEntries} />

              <YearlyPortfolioSnapshotCard data={data} vehicleData={vehicleData} />

            <div className="space-y-4">

              <div className="flex items-center justify-between gap-2 px-1">
                <p className="text-[11px] font-semibold text-ink-3">Chart mode</p>
                <div className="inline-flex rounded-pill border border-kosha-border bg-kosha-surface p-0.5">
                  {[
                    { id: 'core', label: 'Core' },
                    { id: 'advanced', label: 'Advanced' },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setChartMode(mode.id)}
                      className={`h-7 px-3 rounded-pill text-[11px] font-semibold transition-colors ${
                        chartMode === mode.id
                          ? 'bg-brand text-white'
                          : 'text-ink-2 hover:bg-kosha-surface-2'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── 2. Year-over-year context ───────────────────────── */}
              {heavyReady ? (
                <YoYCards years={yoyYears} currentYear={year} enabled rangeYears={yoyRange} onRangeChange={setYoyRange} />
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
              {chartMode === 'core' ? (
                <>
                  <MoneyFlowComparisonChart flowData={flowTrendData} />
                  <CashFlowChart
                    chartData={flowTrendData}
                    totalIncome={data?.totalIncome}
                  />
                </>
              ) : (
                <>
                  <MonthlyCompositionAreaChart flowData={flowTrendData} />
                  <CashflowWaterfallChart
                    flowData={flowTrendData}
                    totalIncome={data?.totalIncome}
                    totalExpense={data?.totalExpense}
                    totalInvestment={data?.totalInvestment}
                  />
                  <SurplusTrajectoryChart netData={surplusData} />
                </>
              )}

              <RunwayCoverageChart
                flowData={flowTrendData}
                annualSurplus={annualSurplus}
              />

              <VolatilityScoreCard flowData={flowTrendData} />

              {concentrationRiskTrend.hasData && (
                <div className="card p-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-label font-semibold text-ink">Category concentration risk</p>
                      <p className="text-[11px] text-ink-3 mt-0.5">Top-3 category share of monthly expense across the selected year.</p>
                    </div>
                    <span className={`text-[11px] px-2 py-1 rounded-pill font-semibold ${concentrationRiskTrend.avgShare >= 65 ? 'bg-warning-bg text-warning-text' : 'bg-income-bg text-income-text'}`}>
                      Avg {concentrationRiskTrend.avgShare}%
                    </span>
                  </div>

                  <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
                    <ResponsiveContainer width="100%" height={196}>
                      <LineChart data={concentrationRiskTrend.series} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(16,33,63,0.10)" />
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 10, fill: 'rgba(94,109,143,0.95)', fontWeight: 600 }}
                          axisLine={false}
                          tickLine={false}
                          interval={0}
                        />
                        <YAxis
                          domain={[0, 100]}
                          tickFormatter={(value) => `${value}%`}
                          tick={{ fontSize: 10, fill: 'rgba(94,109,143,0.95)' }}
                          axisLine={false}
                          tickLine={false}
                          width={30}
                        />
                        <RechartsTooltip content={<ConcentrationTrendTooltip />} />
                        <ReferenceLine y={65} stroke="rgba(154,114,0,0.65)" strokeDasharray="4 4" />
                        <Line
                          type="monotone"
                          dataKey="share"
                          stroke="#9A7200"
                          strokeWidth={2.5}
                          dot={false}
                          activeDot={{ r: 4, fill: '#9A7200', stroke: '#fff', strokeWidth: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <p className="text-[11px] text-ink-3 mt-2">
                    {concentrationRiskTrend.highRiskMonths} month{concentrationRiskTrend.highRiskMonths === 1 ? '' : 's'} crossed the 65% concentration risk threshold.
                  </p>
                </div>
              )}

              <WhatIfSimulatorCard
                categories={scenarioCategories}
                totalIncome={data?.totalIncome}
                totalExpense={data?.totalExpense}
                totalInvestment={data?.totalInvestment}
              />

              {decisionSignals.length > 0 && (
                <div className="card p-4">
                  <SectionHeader title="Decision signals" rightText="What to act on" className="mb-2" />
                  <div className="space-y-2">
                    {decisionSignals.map((line, idx) => (
                      <div key={`signal-${idx}`} className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-pill bg-brand-container text-brand-on text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</span>
                        <p className="text-[12px] text-ink-2 leading-relaxed">{line}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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

