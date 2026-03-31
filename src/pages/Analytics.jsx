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
import { useYearSummary, useTransactions } from '../hooks/useTransactions'
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
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  ScatterChart,
  Scatter,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  LineChart,
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

function mean(values) {
  if (!Array.isArray(values) || values.length === 0) return 0
  return values.reduce((sum, value) => sum + toFiniteNumber(value), 0) / values.length
}

function standardDeviation(values, avg) {
  if (!Array.isArray(values) || values.length < 2) return 0
  const variance = values.reduce((sum, value) => {
    const normalized = toFiniteNumber(value)
    return sum + ((normalized - avg) ** 2)
  }, 0) / values.length
  return Math.sqrt(variance)
}

function median(values) {
  if (!Array.isArray(values) || values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2) return sorted[mid]
  return (sorted[mid - 1] + sorted[mid]) / 2
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
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

function BehaviorScatterDot(props) {
  const { cx, cy, payload } = props
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return null

  const bubbleScale = toFiniteNumber(payload?.bubbleScale)
  const r = clampNumber((bubbleScale / 14), 4, 11)
  const isHealthy = Boolean(payload?.isHealthy)

  return (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill={isHealthy ? C.chartIncome : C.chartExpense}
      fillOpacity={0.78}
      stroke="#FFFFFF"
      strokeWidth={1.2}
    />
  )
}

function BehaviorScatterTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload || {}

  return (
    <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5 shadow-card min-w-[176px]">
      <p className="text-[11px] font-semibold text-ink mb-1">{row?.month || 'Month'}</p>
      <div className="space-y-0.5 text-[11px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-3">Spend ratio</span>
          <span className="font-semibold tabular-nums text-expense-text">{Math.round(Number(row?.spendRatio || 0))}%</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-3">Invest ratio</span>
          <span className="font-semibold tabular-nums text-invest-text">{Math.round(Number(row?.investRatio || 0))}%</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-3">Surplus ratio</span>
          <span className={`font-semibold tabular-nums ${Number(row?.surplusRatio || 0) >= 0 ? 'text-income-text' : 'text-warning-text'}`}>
            {Number(row?.surplusRatio || 0) >= 0 ? '+' : '-'}{Math.abs(Math.round(Number(row?.surplusRatio || 0)))}%
          </span>
        </div>
      </div>
    </div>
  )
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

function SurplusControlTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload || {}

  return (
    <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5 shadow-card min-w-[186px]">
      <p className="text-[11px] font-semibold text-ink mb-1">{label}</p>
      <div className="space-y-0.5 text-[11px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-3">Net</span>
          <span className={`font-semibold tabular-nums ${Number(row?.Net || 0) >= 0 ? 'text-income-text' : 'text-warning-text'}`}>
            {Number(row?.Net || 0) >= 0 ? '+' : '-'}{fmt(Math.abs(Number(row?.Net || 0)))}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-3">Rolling 3M</span>
          <span className="font-semibold tabular-nums text-brand">{fmt(Number(row?.rolling3 || 0))}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-3">Regime signal</span>
          <span className={`font-semibold ${row?.isSignal ? 'text-warning-text' : 'text-income-text'}`}>
            {row?.isSignal ? 'Outlier' : 'Normal'}
          </span>
        </div>
      </div>
    </div>
  )
}

function HabitRadarTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload || {}

  return (
    <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5 shadow-card min-w-[168px]">
      <p className="text-[11px] font-semibold text-ink mb-1">{row?.metric || 'Metric'}</p>
      <div className="flex items-center justify-between gap-3 text-[11px]">
        <span className="text-ink-3">Score</span>
        <span className="font-semibold tabular-nums text-brand">{Math.round(Number(row?.score || 0))}/100</span>
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

  const behaviorScatter = useMemo(() => {
    const points = flowTrendData
      .filter((row) => toFiniteNumber(row.Income) > 0 || toFiniteNumber(row.Outflow) > 0)
      .map((row) => {
        const income = toFiniteNumber(row.Income)
        const spent = toFiniteNumber(row.Spent)
        const invested = toFiniteNumber(row.Invested)
        const outflow = toFiniteNumber(row.Outflow)

        const spendRatio = income > 0 ? (spent / income) * 100 : 0
        const investRatio = income > 0 ? (invested / income) * 100 : 0
        const surplusRatio = income > 0 ? ((income - outflow) / income) * 100 : -100

        return {
          month: row.name,
          spendRatio: Number(spendRatio.toFixed(1)),
          investRatio: Number(investRatio.toFixed(1)),
          surplusRatio: Number(surplusRatio.toFixed(1)),
          bubbleScale: Math.max(12, Math.min(150, Math.abs(surplusRatio) * 2.4 + 24)),
          isHealthy: surplusRatio >= 0,
        }
      })

    return {
      hasData: points.length > 0,
      points,
      spendMedian: median(points.map((point) => point.spendRatio)),
      investMedian: median(points.map((point) => point.investRatio)),
      avgSpendRatio: Math.round(mean(points.map((point) => point.spendRatio))),
      avgInvestRatio: Math.round(mean(points.map((point) => point.investRatio))),
      stressMonths: points.filter((point) => point.surplusRatio < 0).length,
    }
  }, [flowTrendData])

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
        shortLabel: shortLabel(label, 11),
        amount,
        cumulativePct: Math.round((running / categoryTotal) * 100),
      }
    })

    const index80 = rows.findIndex((row) => row.cumulativePct >= 80)

    return {
      hasData: rows.length > 0,
      rows,
      topShare: Math.round(((rows[0]?.amount || 0) / categoryTotal) * 100),
      categoriesFor80Pct: index80 >= 0 ? index80 + 1 : rows.length,
    }
  }, [allCatEntries, categoryLabelById, categoryTotal])

  const surplusControl = useMemo(() => {
    if (!surplusData.length) {
      return {
        hasData: false,
        series: [],
        meanNet: 0,
        upperBand: 0,
        lowerBand: 0,
        signalMonths: [],
        variationPct: null,
      }
    }

    const values = surplusData.map((row) => toFiniteNumber(row.Net))
    const meanNet = mean(values)
    const stdNet = standardDeviation(values, meanNet)
    const upperBand = meanNet + stdNet
    const lowerBand = meanNet - stdNet

    const series = surplusData.map((row, index, arr) => {
      const window = arr.slice(Math.max(0, index - 2), index + 1)
      const rolling3 = mean(window.map((point) => toFiniteNumber(point.Net)))
      const net = toFiniteNumber(row.Net)

      return {
        ...row,
        rolling3: Math.round(rolling3),
        isSignal: net > upperBand || net < lowerBand,
      }
    })

    const signalMonths = series.filter((row) => row.isSignal).map((row) => row.name)
    const variationPct = Math.abs(meanNet) > 0
      ? Math.round((stdNet / Math.abs(meanNet)) * 100)
      : null

    return {
      hasData: true,
      series,
      meanNet,
      upperBand,
      lowerBand,
      signalMonths,
      variationPct,
    }
  }, [surplusData])

  const habitProfile = useMemo(() => {
    const activeMonths = flowTrendData.filter((row) => {
      const income = toFiniteNumber(row.Income)
      const outflow = toFiniteNumber(row.Outflow)
      return income > 0 || outflow > 0
    })

    if (!activeMonths.length) {
      return {
        hasData: false,
        rows: [],
        overall: 0,
      }
    }

    const spendRatios = activeMonths.map((row) => {
      const income = toFiniteNumber(row.Income)
      return income > 0 ? (toFiniteNumber(row.Spent) / income) * 100 : 0
    })
    const investRatios = activeMonths.map((row) => {
      const income = toFiniteNumber(row.Income)
      return income > 0 ? (toFiniteNumber(row.Invested) / income) * 100 : 0
    })
    const netRatios = activeMonths.map((row) => {
      const income = toFiniteNumber(row.Income)
      return income > 0 ? ((income - toFiniteNumber(row.Outflow)) / income) * 100 : 0
    })

    const spendDiscipline = clampNumber(Math.round(100 - mean(spendRatios)), 0, 100)
    const investConsistency = clampNumber(
      Math.round((activeMonths.filter((row) => toFiniteNumber(row.Invested) > 0).length / activeMonths.length) * 100),
      0,
      100
    )
    const surplusStrength = clampNumber(Math.round((mean(netRatios) + 20) * 2.4), 0, 100)
    const surplusStability = clampNumber(
      Math.round(100 - (standardDeviation(netRatios, mean(netRatios)) * 2.2)),
      0,
      100
    )
    const categoryDiversity = clampNumber(Math.round(100 - toFiniteNumber(concentrationRiskTrend.avgShare)), 0, 100)

    const rows = [
      { metric: 'Spend control', score: spendDiscipline },
      { metric: 'Invest consistency', score: investConsistency },
      { metric: 'Surplus strength', score: surplusStrength },
      { metric: 'Surplus stability', score: surplusStability },
      { metric: 'Category diversity', score: categoryDiversity },
    ]

    return {
      hasData: true,
      rows,
      overall: Math.round(mean(rows.map((row) => row.score))),
    }
  }, [flowTrendData, concentrationRiskTrend.avgShare])

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

              <RunwayCoverageChart
                flowData={flowTrendData}
                annualSurplus={annualSurplus}
              />

              {behaviorScatter.hasData && (
                <div className="card p-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-label font-semibold text-ink">Spending vs investment behavior map</p>
                      <p className="text-[11px] text-ink-3 mt-0.5">Scatter view of monthly behavior. X = spend ratio, Y = invest ratio, bubble size = surplus intensity.</p>
                    </div>
                    <span className="text-[11px] px-2 py-1 rounded-pill font-semibold bg-brand-container text-brand-on">
                      Stress months {behaviorScatter.stressMonths}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-2.5">
                    <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
                      <p className="text-[10px] text-ink-3">Avg spend ratio</p>
                      <p className="text-[12px] font-bold tabular-nums text-expense-text">{behaviorScatter.avgSpendRatio}%</p>
                    </div>
                    <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
                      <p className="text-[10px] text-ink-3">Avg invest ratio</p>
                      <p className="text-[12px] font-bold tabular-nums text-invest-text">{behaviorScatter.avgInvestRatio}%</p>
                    </div>
                    <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
                      <p className="text-[10px] text-ink-3">Behavior centroid</p>
                      <p className="text-[12px] font-bold tabular-nums text-ink">{Math.round(behaviorScatter.spendMedian)} / {Math.round(behaviorScatter.investMedian)}</p>
                    </div>
                  </div>

                  <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
                    <ResponsiveContainer width="100%" height={214}>
                      <ScatterChart margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(16,33,63,0.10)" />
                        <XAxis
                          type="number"
                          dataKey="spendRatio"
                          domain={[0, 'dataMax + 10']}
                          tickFormatter={(value) => `${Math.round(value)}%`}
                          tick={{ fontSize: 10, fill: 'rgba(94,109,143,0.95)', fontWeight: 600 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          type="number"
                          dataKey="investRatio"
                          domain={[0, 'dataMax + 8']}
                          tickFormatter={(value) => `${Math.round(value)}%`}
                          tick={{ fontSize: 10, fill: 'rgba(94,109,143,0.95)' }}
                          axisLine={false}
                          tickLine={false}
                          width={34}
                        />
                        <RechartsTooltip content={<BehaviorScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
                        <ReferenceLine x={behaviorScatter.spendMedian} stroke="rgba(226,59,92,0.55)" strokeDasharray="4 4" />
                        <ReferenceLine y={behaviorScatter.investMedian} stroke="rgba(124,58,237,0.55)" strokeDasharray="4 4" />
                        <Scatter data={behaviorScatter.points} shape={<BehaviorScatterDot />} />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex items-center justify-center gap-5 pt-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: C.chartIncome }} />
                      <span className="text-[11px] text-ink-3">Positive surplus month</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: C.chartExpense }} />
                      <span className="text-[11px] text-ink-3">Deficit month</span>
                    </div>
                  </div>
                </div>
              )}

              {categoryPareto.hasData && (
                <div className="card p-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-label font-semibold text-ink">Category Pareto frontier</p>
                      <p className="text-[11px] text-ink-3 mt-0.5">Bar + cumulative line to show which categories drive most annual spend.</p>
                    </div>
                    <span className="text-[11px] px-2 py-1 rounded-pill font-semibold bg-warning-bg text-warning-text">
                      Top category {categoryPareto.topShare}%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-2.5">
                    <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
                      <p className="text-[10px] text-ink-3">Categories for 80%</p>
                      <p className="text-[12px] font-bold tabular-nums text-ink">{categoryPareto.categoriesFor80Pct}</p>
                    </div>
                    <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
                      <p className="text-[10px] text-ink-3">Coverage shown</p>
                      <p className="text-[12px] font-bold tabular-nums text-brand">{categoryPareto.rows[categoryPareto.rows.length - 1]?.cumulativePct || 0}%</p>
                    </div>
                  </div>

                  <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
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
                        <ReferenceLine yAxisId="pct" y={80} stroke="rgba(154,114,0,0.65)" strokeDasharray="4 4" />
                        <Bar yAxisId="amount" dataKey="amount" fill={C.brand} radius={[6, 6, 0, 0]} maxBarSize={22} />
                        <Line yAxisId="pct" type="monotone" dataKey="cumulativePct" stroke={C.bills} strokeWidth={2.4} dot={{ r: 3 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {surplusControl.hasData && (
                <div className="card p-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-label font-semibold text-ink">Surplus control chart</p>
                      <p className="text-[11px] text-ink-3 mt-0.5">Net surplus vs rolling 3-month baseline with one-sigma control bands.</p>
                    </div>
                    <span className={`text-[11px] px-2 py-1 rounded-pill font-semibold ${surplusControl.signalMonths.length > 0 ? 'bg-warning-bg text-warning-text' : 'bg-income-bg text-income-text'}`}>
                      {surplusControl.signalMonths.length} outlier month{surplusControl.signalMonths.length === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-2.5">
                    <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
                      <p className="text-[10px] text-ink-3">Mean surplus</p>
                      <p className={`text-[12px] font-bold tabular-nums ${surplusControl.meanNet >= 0 ? 'text-income-text' : 'text-warning-text'}`}>
                        {surplusControl.meanNet >= 0 ? '+' : '-'}{fmt(Math.abs(surplusControl.meanNet), true)}
                      </p>
                    </div>
                    <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
                      <p className="text-[10px] text-ink-3">Upper band</p>
                      <p className="text-[12px] font-bold tabular-nums text-brand">{fmt(surplusControl.upperBand, true)}</p>
                    </div>
                    <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
                      <p className="text-[10px] text-ink-3">Variation</p>
                      <p className="text-[12px] font-bold tabular-nums text-ink">{surplusControl.variationPct == null ? 'n/a' : `${surplusControl.variationPct}%`}</p>
                    </div>
                  </div>

                  <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
                    <ResponsiveContainer width="100%" height={214}>
                      <LineChart data={surplusControl.series} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(16,33,63,0.10)" />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10, fill: 'rgba(94,109,143,0.95)', fontWeight: 600 }}
                          axisLine={false}
                          tickLine={false}
                          interval={0}
                        />
                        <YAxis
                          tickFormatter={compactTick}
                          tick={{ fontSize: 10, fill: 'rgba(94,109,143,0.95)' }}
                          axisLine={false}
                          tickLine={false}
                          width={34}
                        />
                        <RechartsTooltip content={<SurplusControlTooltip />} />
                        <ReferenceLine y={surplusControl.meanNet} stroke="rgba(10,103,216,0.55)" strokeDasharray="4 4" />
                        <ReferenceLine y={surplusControl.upperBand} stroke="rgba(154,114,0,0.55)" strokeDasharray="4 4" />
                        <ReferenceLine y={surplusControl.lowerBand} stroke="rgba(154,114,0,0.55)" strokeDasharray="4 4" />
                        <Line
                          type="monotone"
                          dataKey="Net"
                          stroke={C.brand}
                          strokeWidth={2.4}
                          dot={{ r: 3 }}
                          activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
                        />
                        <Line
                          type="monotone"
                          dataKey="rolling3"
                          stroke={C.bills}
                          strokeWidth={2}
                          strokeDasharray="5 4"
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {habitProfile.hasData && (
                <div className="card p-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-label font-semibold text-ink">Financial habit profile</p>
                      <p className="text-[11px] text-ink-3 mt-0.5">Radar summary of spending habits, investment habits, surplus quality, and category diversification.</p>
                    </div>
                    <span className={`text-[11px] px-2 py-1 rounded-pill font-semibold ${habitProfile.overall >= 70 ? 'bg-income-bg text-income-text' : habitProfile.overall >= 50 ? 'bg-warning-bg text-warning-text' : 'bg-expense-bg text-expense-text'}`}>
                      Composite {habitProfile.overall}/100
                    </span>
                  </div>

                  <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5 mb-2.5">
                    <ResponsiveContainer width="100%" height={232}>
                      <RadarChart data={habitProfile.rows}>
                        <PolarGrid stroke="rgba(16,33,63,0.14)" />
                        <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: 'rgba(94,109,143,0.95)' }} />
                        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                        <RechartsTooltip content={<HabitRadarTooltip />} />
                        <Radar dataKey="score" stroke={C.brand} fill={C.brand} fillOpacity={0.28} strokeWidth={2.2} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-1.5">
                    {habitProfile.rows.map((row) => (
                      <div key={row.metric} className="rounded-card bg-kosha-surface px-2.5 py-2">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-[11px] font-semibold text-ink-2 truncate">{row.metric}</p>
                          <p className="text-[11px] font-semibold text-brand tabular-nums shrink-0">{row.score}/100</p>
                        </div>
                        <div className="h-1.5 rounded-pill bg-kosha-border overflow-hidden">
                          <div className="h-full rounded-pill bg-brand" style={{ width: `${Math.max(6, row.score)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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

