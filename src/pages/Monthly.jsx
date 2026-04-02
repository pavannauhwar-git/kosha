import { useState, useMemo, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useMonthSummary, useTransactions, TRANSACTION_INSIGHTS_COLUMNS } from '../hooks/useTransactions'
import { useLiabilitiesByMonth } from '../hooks/useLiabilities'
import { CATEGORIES } from '../lib/categories'
import { C } from '../lib/colors'
import CategorySpendingChart from '../components/categories/CategorySpendingChart'
import { fmt } from '../lib/utils'
import { MONTH_NAMES } from '../lib/constants'
import PageHeader from '../components/layout/PageHeader'
import SkeletonLayout from '../components/common/SkeletonLayout'
import PickerNavigator from '../components/common/PickerNavigator'
import EmptyState from '../components/common/EmptyState'
import SectionHeader from '../components/common/SectionHeader'
import InsightDensityToggle from '../components/common/InsightDensityToggle'
import MonthHeroCard from '../components/cards/monthly/MonthHeroCard'
import BreakdownCard from '../components/cards/monthly/BreakdownCard'
import { buildReconciliationInsights, getReviewedReconciliationIds } from '../lib/reconciliation'
import { useReconciliationReviews } from '../hooks/useReconciliationReviews'
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  ScatterChart,
  Scatter,
  ZAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ReferenceLine,
} from 'recharts'

function quantile(sortedValues, p) {
  if (!sortedValues.length) return 0
  const index = (sortedValues.length - 1) * p
  const lowerIndex = Math.floor(index)
  const upperIndex = Math.ceil(index)

  if (lowerIndex === upperIndex) return sortedValues[lowerIndex]

  const weight = index - lowerIndex
  return (sortedValues[lowerIndex] * (1 - weight)) + (sortedValues[upperIndex] * weight)
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

const MONTHLY_INSIGHTS_MODE_KEY = 'monthlyInsightsMode'

function normalizeMonthlyInsightsMode(rawValue) {
  return rawValue === 'deep' ? 'deep' : 'focus'
}

function WeeklyCadenceTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload || {}

  return (
    <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5 shadow-card min-w-[186px]">
      <p className="text-[11px] font-semibold text-ink mb-1">{label} ({row.weekRange})</p>
      <div className="space-y-0.5 text-[11px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-3">Inflow</span>
          <span className="font-semibold tabular-nums text-income-text">{fmt(Number(row.Inflow || 0))}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-3">Outflow</span>
          <span className="font-semibold tabular-nums text-expense-text">{fmt(Number(row.Outflow || 0))}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-3">Net</span>
          <span className={`font-semibold tabular-nums ${Number(row.Net || 0) >= 0 ? 'text-income-text' : 'text-warning-text'}`}>
            {Number(row.Net || 0) >= 0 ? '+' : '-'}{fmt(Math.abs(Number(row.Net || 0)))}
          </span>
        </div>
      </div>
    </div>
  )
}

function DistributionTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload || {}

  return (
    <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5 shadow-card min-w-[188px]">
      <p className="text-[11px] font-semibold text-ink mb-1">{row?.label || 'Range'}</p>
      <div className="space-y-0.5 text-[11px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-3">Transactions</span>
          <span className="font-semibold tabular-nums text-ink">{Math.round(Number(row?.count || 0))}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-3">Spend in bucket</span>
          <span className="font-semibold tabular-nums text-warning-text">{fmt(Number(row?.totalAmount || 0))}</span>
        </div>
      </div>
    </div>
  )
}

function CategoryBehaviorTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload || {}

  return (
    <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5 shadow-card min-w-[186px]">
      <p className="text-[11px] font-semibold text-ink mb-1">{row?.label || 'Category'}</p>
      <div className="space-y-0.5 text-[11px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-3">Share of spend</span>
          <span className="font-semibold tabular-nums text-warning-text">{Math.round(Number(row?.sharePct || 0))}%</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-3">Avg ticket</span>
          <span className="font-semibold tabular-nums text-ink">{fmt(Number(row?.avgTicket || 0))}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-3">Txn count</span>
          <span className="font-semibold tabular-nums text-brand">{Number(row?.count || 0)}</span>
        </div>
      </div>
    </div>
  )
}

export default function Monthly() {
  const navigate = useNavigate()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [heavyReady, setHeavyReady] = useState(false)
  const [insightsMode, setInsightsMode] = useState(() => {
    if (typeof window === 'undefined') return 'focus'
    return normalizeMonthlyInsightsMode(window.localStorage.getItem(MONTHLY_INSIGHTS_MODE_KEY))
  })
  const monthRef = useRef(null)
  const showAdvancedInsights = insightsMode === 'deep'

  useEffect(() => {
    const timer = setTimeout(() => setHeavyReady(true), 260)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(MONTHLY_INSIGHTS_MODE_KEY, insightsMode)
  }, [insightsMode])

  const { data, loading } = useMonthSummary(year, month)
  const monthStartDate = `${year}-${String(month).padStart(2, '0')}-01`
  const monthEndDate = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`
  const { data: txnRows = [] } = useTransactions({
    startDate: monthStartDate,
    endDate: monthEndDate,
    limit: 250,
    enabled: heavyReady,
    columns: TRANSACTION_INSIGHTS_COLUMNS,
  })
  const { pending: pendingBills, paid: paidBills } = useLiabilitiesByMonth(year, month, { enabled: heavyReady })
  const { reviewedIdSet: serverReviewedIds, unavailable: reviewTableUnavailable } = useReconciliationReviews({ enabled: heavyReady })

  const reviewedIds = useMemo(
    () => (reviewTableUnavailable ? getReviewedReconciliationIds() : serverReviewedIds),
    [reviewTableUnavailable, serverReviewedIds]
  )
  const reconciliationInsights = useMemo(
    () => buildReconciliationInsights(txnRows, reviewedIds),
    [txnRows, reviewedIds]
  )
  const reconcileQueueCount = useMemo(() => {
    return reconciliationInsights.counts.queue
  }, [reconciliationInsights])

  function prev() {
    if (month === 1) {
      setMonth(12)
      setYear(y => y - 1)
    } else {
      setMonth(m => m - 1)
    }
  }

  function next() {
    if (month === 12) {
      setMonth(1)
      setYear(y => y + 1)
    } else {
      setMonth(m => m + 1)
    }
  }

  const earned = data?.earned || 0
  const repayments = data?.repayments || 0
  const spent = data?.expense || 0
  const invested = data?.investment || 0
  const inflow = earned + repayments

  const allCatEntries = useMemo(
    () => Object.entries(data?.byCategory || {}).sort((a, b) => b[1] - a[1]),
    [data?.byCategory]
  )
  const categoryLabelMap = useMemo(
    () => new Map(CATEGORIES.map((category) => [category.id, category.label])),
    []
  )
  const categoryTotal = useMemo(
    () => allCatEntries.reduce((s, [, v]) => s + v, 0) || 1,
    [allCatEntries]
  )
  const vehicleEntries = useMemo(
    () => Object.entries(data?.byVehicle || {}).sort((a, b) => b[1] - a[1]),
    [data?.byVehicle]
  )

  const monthlyBillStatus = useMemo(() => {
    const total = pendingBills.length + paidBills.length
    const paidPct = total > 0 ? Math.round((paidBills.length / total) * 100) : 100

    return {
      total,
      pending: pendingBills.length,
      paid: paidBills.length,
      paidPct,
    }
  }, [pendingBills, paidBills])

  const hasMonthData = useMemo(() => {
    const totalsPresent = inflow > 0 || spent > 0 || invested > 0
    const categoryPresent = allCatEntries.length > 0 || vehicleEntries.length > 0
    const planningPresent = monthlyBillStatus.total > 0 || reconcileQueueCount > 0

    return totalsPresent || categoryPresent || planningPresent
  }, [
    inflow,
    spent,
    invested,
    allCatEntries.length,
    vehicleEntries.length,
    monthlyBillStatus.total,
    reconcileQueueCount,
  ])

  const monthCloseSummary = useMemo(() => {
    const totalOutflow = spent + invested
    const net = inflow - totalOutflow

    const periodEnd = new Date(year, month, 0)
    periodEnd.setHours(0, 0, 0, 0)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const daysLeft = Math.max(0, Math.ceil((periodEnd.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)))
    const isPastMonth = year < today.getFullYear() || (year === today.getFullYear() && month < (today.getMonth() + 1))
    const isCurrentMonth = year === today.getFullYear() && month === (today.getMonth() + 1)
    const isFutureMonth = !isPastMonth && !isCurrentMonth

    const daysInMonth = new Date(year, month, 0).getDate()
    const daysElapsed = isCurrentMonth ? Math.max(1, Math.min(today.getDate(), daysInMonth)) : daysInMonth
    const projectedInflow = isCurrentMonth
      ? (daysElapsed > 0 ? (inflow / daysElapsed) * daysInMonth : inflow)
      : inflow
    const projectedOutflow = isCurrentMonth
      ? (daysElapsed > 0 ? (totalOutflow / daysElapsed) * daysInMonth : totalOutflow)
      : totalOutflow
    const projectedNet = projectedInflow - projectedOutflow

    const health = isCurrentMonth ? (projectedNet >= 0 ? 'healthy' : 'at-risk') : (net >= 0 ? 'healthy' : 'at-risk')

    let statusLabel = health === 'healthy' ? 'On track' : 'Needs correction'
    let timelineLabel = 'Days left'
    let timelineValue = String(daysLeft)
    let message = 'Outcome projection and runway.'

    if (isPastMonth) {
      timelineLabel = 'Status'
      timelineValue = 'Closed'
      if (net > 0) {
        statusLabel = 'Closed positive'
        message = `Closed the month with positive cash flow of +${fmt(Math.abs(net))}. Inflow was ${fmt(inflow)} against outflow of ${fmt(totalOutflow)}.`
      } else if (net < 0) {
        statusLabel = 'Closed negative'
        message = `Closed the month with negative cash flow of -${fmt(Math.abs(net))}. Outflow exceeded inflow by ${fmt(Math.abs(net))}.`
      } else {
        statusLabel = 'Closed breakeven'
        message = `Closed the month at breakeven. Inflow and outflow both settled at ${fmt(inflow)}.`
      }
    } else if (isCurrentMonth) {
      const daysRemaining = Math.max(0, daysInMonth - daysElapsed)
      const overrunAmount = Math.max(0, -projectedNet)
      const requiredDailyCorrection = daysRemaining > 0 ? overrunAmount / daysRemaining : overrunAmount

      if (projectedNet >= 0) {
        statusLabel = 'On track'
        message = `At current pace you are likely to close with +${fmt(Math.abs(projectedNet))} cash flow. Keep monitoring outflow over the next ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.`
      } else {
        statusLabel = 'Needs correction'
        message = `Current pace points to a -${fmt(Math.abs(projectedNet))} close. To recover, trim average daily outflow by about ${fmt(requiredDailyCorrection)} for the remaining ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.`
      }
    } else if (isFutureMonth) {
      timelineLabel = 'Preview'
      timelineValue = 'Future'
      statusLabel = net >= 0 ? 'Planned positive' : 'Planned deficit'
      message = net >= 0
        ? `Future month preview shows +${fmt(Math.abs(net))} based on planned entries.`
        : `Future month preview currently shows -${fmt(Math.abs(net))}. Add expected income or reduce planned outflow.`
    }

    return {
      inflow,
      totalOutflow,
      net,
      daysLeft,
      health,
      statusLabel,
      timelineLabel,
      timelineValue,
      message,
    }
  }, [inflow, spent, invested, year, month])

  const monthlyPortfolioSnapshot = useMemo(() => {
    const rows = vehicleEntries
      .map(([name, value]) => ({ name, value: Number(value || 0) }))
      .filter((row) => row.value > 0)

    const total = rows.reduce((sum, row) => sum + row.value, 0)
    const top = rows[0] || null
    const topPct = top && total > 0 ? Math.round((top.value / total) * 100) : 0
    const deployRate = inflow > 0 ? Math.round((invested / inflow) * 100) : 0

    const palette = [C.brand, C.brandMid, C.brandLight, C.ink, C.invest, C.brandBorder]
    const maxSlices = 5
    const visibleRows = rows.slice(0, maxSlices)
    const visibleTotal = visibleRows.reduce((sum, row) => sum + row.value, 0)

    const mixRows = visibleRows.map((row, index) => ({
      ...row,
      pct: total > 0 ? Math.round((row.value / total) * 100) : 0,
      color: palette[index % palette.length],
    }))

    if (rows.length > maxSlices && total > visibleTotal) {
      const otherValue = total - visibleTotal
      mixRows.push({
        name: 'Other',
        value: otherValue,
        pct: total > 0 ? Math.round((otherValue / total) * 100) : 0,
        color: C.brandBorder,
      })
    }

    const diversityFromCount = Math.min(40, rows.length * 12)
    const concentrationPenalty = Math.max(0, topPct - 35)
    const diversificationScore = total > 0
      ? Math.max(0, Math.min(100, Math.round(60 + diversityFromCount - (concentrationPenalty * 1.4))))
      : 0

    const concentrationBand = topPct >= 60
      ? 'High concentration'
      : topPct >= 45
        ? 'Moderate concentration'
        : 'Balanced concentration'

    const actions = []
    if (total <= 0) {
      actions.push('No tagged vehicle allocation yet. Add investment entries with a vehicle label to unlock mix intelligence.')
      actions.push('Start with one core vehicle this month, then diversify once cadence is consistent.')
      actions.push('After logging the first investment, define a second vehicle to establish diversification.')
    } else {
      if (rows.length < 3) {
        actions.push('Diversification opportunity: add at least one new vehicle category in the next investment.')
      } else {
        actions.push('Diversification base is healthy. Keep future top-ups close to the current planned weights.')
      }

      if (deployRate < 10) {
        actions.push(`Deployment is ${deployRate}% of inflow. A small top-up can improve long-term consistency.`)
      } else if (deployRate > 35) {
        actions.push(`Deployment is ${deployRate}% of inflow. Ensure monthly cash runway remains intact before increasing further.`)
      } else {
        actions.push(`Deployment is ${deployRate}% of inflow, within a balanced range for this month.`)
      }
    }

    const nextAction = (() => {
      if (total <= 0) {
        return 'Log your first investment for this month to activate allocation tracking.'
      }
      if (rows.length < 3) {
        return 'Log the next investment into a new vehicle category for diversification.'
      }
      return 'Log the next planned top-up to keep this month on allocation target.'
    })()

    return {
      rows,
      total,
      top,
      topPct,
      deployRate,
      mixRows,
      diversificationScore,
      concentrationBand,
      actions,
      nextAction,
    }
  }, [vehicleEntries, inflow, invested])

  const weeklyFlowDiagnostics = useMemo(() => {
    if (!showAdvancedInsights) {
      return {
        hasData: false,
        series: [],
        positiveWeeks: 0,
        bestWeek: null,
        stressWeek: null,
      }
    }

    const daysInSelectedMonth = new Date(year, month, 0).getDate()
    const bucketCount = Math.ceil(daysInSelectedMonth / 7)
    const currentMonthNow = new Date()
    const isCurrentMonth = year === currentMonthNow.getFullYear() && month === (currentMonthNow.getMonth() + 1)
    const currentDay = currentMonthNow.getDate()

    const weekBuckets = Array.from({ length: bucketCount }, (_, index) => {
      const startDay = (index * 7) + 1
      const endDay = Math.min(daysInSelectedMonth, startDay + 6)
      return {
        week: `W${index + 1}`,
        weekRange: `${String(startDay).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`,
        index,
        isFuture: isCurrentMonth && startDay > currentDay,
        Inflow: 0,
        Outflow: 0,
        Invested: 0,
      }
    })

    for (const row of (Array.isArray(txnRows) ? txnRows : [])) {
      const amount = Number(row?.amount || 0)
      if (!Number.isFinite(amount) || amount <= 0) continue

      const day = Number(String(row?.date || '').slice(8, 10))
      if (!Number.isFinite(day) || day < 1 || day > daysInSelectedMonth) continue

      const weekIndex = Math.floor((day - 1) / 7)
      const bucket = weekBuckets[weekIndex]
      if (!bucket) continue

      if (row?.type === 'income' && !row?.is_repayment) {
        bucket.Inflow += amount
      } else if (row?.type === 'expense') {
        bucket.Outflow += amount
      } else if (row?.type === 'investment') {
        bucket.Outflow += amount
        bucket.Invested += amount
      }
    }

    const series = weekBuckets
      .map((row) => ({
        ...row,
        Net: row.Inflow - row.Outflow,
      }))
      .filter((row) => !row.isFuture)

    const activeSeries = series.filter((row) => (row.Inflow + row.Outflow) > 0)
    if (!activeSeries.length) {
      return {
        hasData: false,
        series,
        positiveWeeks: 0,
        bestWeek: null,
        stressWeek: null,
      }
    }

    const positiveWeeks = activeSeries.filter((row) => row.Net >= 0).length
    const bestWeek = [...activeSeries].sort((a, b) => b.Net - a.Net)[0]
    const stressWeek = [...activeSeries].sort((a, b) => a.Net - b.Net)[0]

    return {
      hasData: true,
      series,
      positiveWeeks,
      bestWeek,
      stressWeek,
    }
  }, [txnRows, year, month, showAdvancedInsights])

  const expenseDistribution = useMemo(() => {
    if (!showAdvancedInsights) {
      return {
        hasData: false,
        bins: [],
        p50: 0,
        p90: 0,
        highTicketCount: 0,
      }
    }

    const expenses = (Array.isArray(txnRows) ? txnRows : [])
      .filter((row) => row?.type === 'expense')
      .map((row) => Number(row?.amount || 0))
      .filter((amount) => Number.isFinite(amount) && amount > 0)
      .sort((a, b) => a - b)

    if (expenses.length < 4) {
      return {
        hasData: false,
        bins: [],
        p50: 0,
        p90: 0,
      }
    }

    const min = expenses[0]
    const max = expenses[expenses.length - 1]
    const binCount = Math.max(5, Math.min(8, Math.round(Math.sqrt(expenses.length))))
    const width = Math.max(1, (max - min) / binCount)

    const bins = Array.from({ length: binCount }, (_, index) => {
      const from = min + (index * width)
      const to = index === binCount - 1 ? max : min + ((index + 1) * width)
      return {
        from,
        to,
        label: `${compactTick(from)}-${compactTick(to)}`,
        count: 0,
        totalAmount: 0,
      }
    })

    for (const amount of expenses) {
      const idx = Math.min(binCount - 1, Math.floor((amount - min) / width))
      const bucket = bins[idx]
      bucket.count += 1
      bucket.totalAmount += amount
    }

    const p50 = quantile(expenses, 0.5)
    const p90 = quantile(expenses, 0.9)
    const highTicketCount = expenses.filter((amount) => amount >= p90).length

    return {
      hasData: true,
      bins,
      p50,
      p90,
      highTicketCount,
    }
  }, [txnRows, showAdvancedInsights])

  const categoryBehaviorMap = useMemo(() => {
    if (!showAdvancedInsights) {
      return {
        hasData: false,
        points: [],
        shareMedian: 0,
        avgTicketMedian: 0,
        topLever: null,
      }
    }

    const expenseRows = (Array.isArray(txnRows) ? txnRows : [])
      .filter((row) => row?.type === 'expense' && Number(row?.amount || 0) > 0)

    if (!expenseRows.length) {
      return {
        hasData: false,
        points: [],
        shareMedian: 0,
        avgTicketMedian: 0,
      }
    }

    const grouped = new Map()
    let totalExpense = 0

    for (const row of expenseRows) {
      const id = row?.category || 'other'
      const amount = Number(row?.amount || 0)
      if (!Number.isFinite(amount) || amount <= 0) continue

      totalExpense += amount

      const existing = grouped.get(id) || { id, total: 0, count: 0 }
      existing.total += amount
      existing.count += 1
      grouped.set(id, existing)
    }

    const points = [...grouped.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 9)
      .map((row) => {
        const label = categoryLabelMap.get(row.id) || String(row.id).replace(/_/g, ' ')
        const avgTicket = row.count > 0 ? row.total / row.count : 0
        const sharePct = totalExpense > 0 ? (row.total / totalExpense) * 100 : 0
        return {
          ...row,
          label,
          shortLabel: shortLabel(label, 12),
          avgTicket,
          sharePct,
          bubbleSize: Math.max(18, Math.min(120, (sharePct * 2.4) + 14)),
        }
      })

    const sortedShare = points.map((point) => point.sharePct).sort((a, b) => a - b)
    const sortedAvgTicket = points.map((point) => point.avgTicket).sort((a, b) => a - b)
    const shareMedian = quantile(sortedShare, 0.5)
    const avgTicketMedian = quantile(sortedAvgTicket, 0.5)
    const topLever = points[0] || null

    return {
      hasData: points.length > 0,
      points,
      shareMedian,
      avgTicketMedian,
      topLever,
    }
  }, [txnRows, categoryLabelMap, showAdvancedInsights])

  return (
    <div className="page">
      <PageHeader title="Monthly" className="mb-3" />

      <PickerNavigator
        className="mb-3"
        label={`${MONTH_NAMES[month - 1]} ${year}`}
        onPrev={prev}
        onNext={next}
        pickerRef={monthRef}
        inputType="month"
        inputValue={`${year}-${String(month).padStart(2, '0')}`}
        onInputChange={e => {
          const [y, m] = e.target.value.split('-').map(Number)
          if (y && m) {
            setYear(y)
            setMonth(m)
          }
        }}
      />

      {loading ? (
        <SkeletonLayout
          sections={[
            { type: 'block', height: 'h-[260px]' },
            { type: 'block', height: 'h-[220px]' },
            { type: 'block', height: 'h-[180px]' },
          ]}
        />
      ) : (
        <motion.div
          key={`${year}-${month}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="page-stack"
        >
          {!hasMonthData ? (
            <EmptyState
              title="No data for this month"
              description="This month is empty right now. Add transactions to unlock month-close insights and reconciliation cues."
              actionLabel={
                year === now.getFullYear() && month === now.getMonth() + 1
                  ? 'Add transaction'
                  : 'Go to current month'
              }
              onAction={() => {
                if (year === now.getFullYear() && month === now.getMonth() + 1) {
                  navigate('/transactions')
                  return
                }
                setYear(now.getFullYear())
                setMonth(now.getMonth() + 1)
              }}
              secondaryLabel={
                year === now.getFullYear() && month === now.getMonth() + 1
                  ? undefined
                  : 'Add transaction'
              }
              onSecondaryAction={
                year === now.getFullYear() && month === now.getMonth() + 1
                  ? undefined
                  : () => navigate('/transactions')
              }
            />
          ) : (
          <>
          <div className="mb-3 md:mb-4">
            <MonthHeroCard month={month} year={year} data={data} />
          </div>

          <InsightDensityToggle
            mode={insightsMode}
            onModeChange={setInsightsMode}
            subtitle="Focus keeps month-close and allocation cards. Deep includes weekly and distribution diagnostics."
          />

          <div className="card p-4 border-0">
            <SectionHeader
              className="mb-2"
              title="Month close summary"
              subtitle="Outcome projection and runway"
              badge={{
                label: monthCloseSummary.statusLabel,
                className: monthCloseSummary.health === 'healthy' ? 'bg-income-bg text-income-text' : 'bg-warning-bg text-warning-text',
              }}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-3">
              <div className="rounded-card bg-kosha-surface-2 p-3">
                <p className="text-caption text-ink-3">Net close</p>
                <p className={`text-sm font-bold tabular-nums ${monthCloseSummary.net >= 0 ? 'text-income-text' : 'text-expense-text'}`}>
                  {monthCloseSummary.net >= 0 ? '+' : '-'}{fmt(Math.abs(monthCloseSummary.net))}
                </p>
              </div>
              <div className="rounded-card bg-kosha-surface-2 p-3">
                <p className="text-caption text-ink-3">Outflow</p>
                <p className="text-sm font-bold tabular-nums text-ink-2">{fmt(monthCloseSummary.totalOutflow)}</p>
              </div>
              <div className="rounded-card bg-kosha-surface-2 p-3">
                <p className="text-caption text-ink-3">{monthCloseSummary.timelineLabel}</p>
                <p className="text-sm font-bold tabular-nums text-ink-2">{monthCloseSummary.timelineValue}</p>
              </div>
            </div>

            <p className="text-[11px] text-ink-3">{monthCloseSummary.message}</p>
          </div>

          {heavyReady && (
            <BreakdownCard earned={inflow} spent={spent} invested={invested} totalLabel="Total inflow" />
          )}

          {heavyReady && showAdvancedInsights && weeklyFlowDiagnostics.hasData && (
            <div className="card p-4 border-0">
              <SectionHeader
                className="mb-2"
                title="Weekly cashflow cadence"
                subtitle="Grouped inflow/outflow with week-level net trend"
                badge={{
                  label: `${weeklyFlowDiagnostics.positiveWeeks}/${weeklyFlowDiagnostics.series.length} positive week${weeklyFlowDiagnostics.series.length === 1 ? '' : 's'}`,
                  className: weeklyFlowDiagnostics.positiveWeeks === weeklyFlowDiagnostics.series.length
                    ? 'bg-income-bg text-income-text'
                    : 'bg-warning-bg text-warning-text',
                }}
              />

              <div className="grid grid-cols-3 gap-2 mb-2.5">
                <div className="rounded-card bg-kosha-surface-2 p-2.5">
                  <p className="text-caption text-ink-3">Best week</p>
                  <p className="text-[12px] font-bold text-income-text">{weeklyFlowDiagnostics.bestWeek?.week || '—'}</p>
                </div>
                <div className="rounded-card bg-kosha-surface-2 p-2.5">
                  <p className="text-caption text-ink-3">Stress week</p>
                  <p className="text-[12px] font-bold text-warning-text">{weeklyFlowDiagnostics.stressWeek?.week || '—'}</p>
                </div>
                <div className="rounded-card bg-kosha-surface-2 p-2.5">
                  <p className="text-caption text-ink-3">Net swing</p>
                  <p className="text-[12px] font-bold tabular-nums text-ink">
                    {fmt(Math.abs((weeklyFlowDiagnostics.bestWeek?.Net || 0) - (weeklyFlowDiagnostics.stressWeek?.Net || 0)))}
                  </p>
                </div>
              </div>

              <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
                <ResponsiveContainer width="100%" height={218}>
                  <ComposedChart data={weeklyFlowDiagnostics.series} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(16,33,63,0.10)" />
                    <XAxis
                      dataKey="week"
                      tick={{ fontSize: 10, fill: 'rgba(94,109,143,0.95)', fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      yAxisId="amount"
                      tickFormatter={compactTick}
                      tick={{ fontSize: 10, fill: 'rgba(94,109,143,0.95)' }}
                      axisLine={false}
                      tickLine={false}
                      width={34}
                    />
                    <YAxis yAxisId="net" hide />
                    <RechartsTooltip content={<WeeklyCadenceTooltip />} />
                    <Bar yAxisId="amount" dataKey="Inflow" fill="#0E9F6E" radius={[6, 6, 0, 0]} maxBarSize={24} />
                    <Bar yAxisId="amount" dataKey="Outflow" fill="#E11D48" radius={[6, 6, 0, 0]} maxBarSize={24} />
                    <Line yAxisId="net" type="monotone" dataKey="Net" stroke="#0A67D8" strokeWidth={2.3} dot={{ r: 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <p className="text-[10px] text-ink-3 mt-1.5">Bars compare weekly flow magnitude; line tracks weekly net regime shift across the month.</p>
            </div>
          )}

          {heavyReady && showAdvancedInsights && expenseDistribution.hasData && (
            <div className="card p-4 border-0">
              <SectionHeader
                className="mb-2"
                title="Expense distribution"
                subtitle="Histogram to reveal spending size concentration and high-ticket risk"
                badge={{
                  label: `P90 ${fmt(expenseDistribution.p90)}`,
                  className: 'bg-warning-bg text-warning-text',
                }}
              />

              <div className="grid grid-cols-3 gap-2 mb-2.5">
                <div className="rounded-card bg-kosha-surface-2 p-2.5">
                  <p className="text-caption text-ink-3">Median ticket</p>
                  <p className="text-[12px] font-bold tabular-nums text-ink">{fmt(expenseDistribution.p50)}</p>
                </div>
                <div className="rounded-card bg-kosha-surface-2 p-2.5">
                  <p className="text-caption text-ink-3">P90 ticket</p>
                  <p className="text-[12px] font-bold tabular-nums text-warning-text">{fmt(expenseDistribution.p90)}</p>
                </div>
                <div className="rounded-card bg-kosha-surface-2 p-2.5">
                  <p className="text-caption text-ink-3">High-ticket txns</p>
                  <p className="text-[12px] font-bold tabular-nums text-brand">{expenseDistribution.highTicketCount}</p>
                </div>
              </div>

              <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
                <ResponsiveContainer width="100%" height={198}>
                  <BarChart data={expenseDistribution.bins} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(16,33,63,0.10)" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: 'rgba(94,109,143,0.95)', fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: 'rgba(94,109,143,0.95)' }}
                      axisLine={false}
                      tickLine={false}
                      width={24}
                    />
                    <RechartsTooltip content={<DistributionTooltip />} />
                    <Bar dataKey="count" fill="#9A7200" radius={[6, 6, 0, 0]} maxBarSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {heavyReady && showAdvancedInsights && categoryBehaviorMap.hasData && (
            <div className="card p-4 border-0">
              <SectionHeader
                className="mb-2"
                title="Category behavior map"
                subtitle="Bubble scatter for impact levers: share vs average ticket"
                badge={{
                  label: categoryBehaviorMap.topLever ? `${categoryBehaviorMap.topLever.shortLabel} leads` : 'No category lead',
                  className: 'bg-brand-container text-brand-on',
                }}
              />

              <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
                <ResponsiveContainer width="100%" height={216}>
                  <ScatterChart margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(16,33,63,0.10)" />
                    <XAxis
                      type="number"
                      dataKey="avgTicket"
                      tickFormatter={compactTick}
                      tick={{ fontSize: 10, fill: 'rgba(94,109,143,0.95)', fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      type="number"
                      dataKey="sharePct"
                      domain={[0, 'dataMax + 6']}
                      tickFormatter={(value) => `${Math.round(value)}%`}
                      tick={{ fontSize: 10, fill: 'rgba(94,109,143,0.95)' }}
                      axisLine={false}
                      tickLine={false}
                      width={34}
                    />
                    <ZAxis type="number" dataKey="bubbleSize" range={[70, 340]} />
                    <RechartsTooltip content={<CategoryBehaviorTooltip />} />
                    <ReferenceLine x={categoryBehaviorMap.avgTicketMedian} stroke="rgba(10,103,216,0.48)" strokeDasharray="4 4" />
                    <ReferenceLine y={categoryBehaviorMap.shareMedian} stroke="rgba(154,114,0,0.56)" strokeDasharray="4 4" />
                    <Scatter data={categoryBehaviorMap.points} fill="#0A67D8" fillOpacity={0.72} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              <p className="text-[10px] text-ink-3 mt-1.5">Top-right quadrant categories are the strongest improvement levers this month.</p>
            </div>
          )}

          {heavyReady && (monthlyPortfolioSnapshot.rows.length > 0 || invested > 0) && (
            <div className="card p-4 border-0">
              <SectionHeader
                className="mb-2"
                title="Portfolio snapshot"
                subtitle="Allocation ladder, concentration checks, and next action"
                badge={{
                  label: `${monthlyPortfolioSnapshot.deployRate}% deploy rate`,
                  className: monthlyPortfolioSnapshot.deployRate >= 12 && monthlyPortfolioSnapshot.deployRate <= 35
                    ? 'bg-income-bg text-income-text'
                    : 'bg-warning-bg text-warning-text',
                }}
              />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
                  <p className="text-caption text-ink-3">Allocated</p>
                  <p className="text-[13px] font-bold tabular-nums text-invest-text">{fmt(monthlyPortfolioSnapshot.total, true)}</p>
                </div>
                <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
                  <p className="text-caption text-ink-3">Top holding</p>
                  <p className={`text-[13px] font-bold tabular-nums ${monthlyPortfolioSnapshot.topPct >= 55 ? 'text-warning-text' : 'text-brand'}`}>
                    {monthlyPortfolioSnapshot.topPct}%
                  </p>
                </div>
                <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
                  <p className="text-caption text-ink-3">Diversification</p>
                  <p className={`text-[13px] font-bold tabular-nums ${monthlyPortfolioSnapshot.diversificationScore >= 70 ? 'text-income-text' : monthlyPortfolioSnapshot.diversificationScore >= 50 ? 'text-brand' : 'text-warning-text'}`}>
                    {monthlyPortfolioSnapshot.diversificationScore}/100
                  </p>
                </div>
                <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
                  <p className="text-caption text-ink-3">Primary vehicle</p>
                  <p className="text-[12px] font-bold text-ink truncate">{monthlyPortfolioSnapshot.top?.name || '—'}</p>
                </div>
              </div>

              <div className="rounded-card border border-kosha-border bg-kosha-surface-2 p-3 mb-3">
                <p className="text-[10px] text-ink-3 mb-1.5">Allocation ladder</p>
                <div className="h-3 rounded-pill bg-kosha-border overflow-hidden flex mb-2.5">
                  {monthlyPortfolioSnapshot.mixRows.map((row) => (
                    <div
                      key={`monthly-allocation-segment-${row.name}`}
                      title={`${row.name}: ${row.pct}%`}
                      style={{ width: `${Math.max(4, row.pct)}%`, background: row.color }}
                    />
                  ))}
                </div>

                <div className="space-y-2">
                  {monthlyPortfolioSnapshot.mixRows.map((row) => (
                    <div key={`monthly-allocation-row-${row.name}`}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: row.color }} />
                          <p className="text-[11px] text-ink-2 truncate">{row.name}</p>
                        </div>
                        <p className="text-[11px] tabular-nums text-ink shrink-0">{row.pct}% · {fmt(row.value, true)}</p>
                      </div>
                      <div className="h-1.5 rounded-pill bg-kosha-border overflow-hidden">
                        <div className="h-full rounded-pill" style={{ width: `${Math.max(5, row.pct)}%`, background: row.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-card border border-kosha-border bg-kosha-surface-2 p-2.5 space-y-1.5 mb-3">
                {monthlyPortfolioSnapshot.actions.slice(0, 3).map((line, index) => (
                  <div key={`monthly-portfolio-action-${index}`} className="flex items-start gap-2">
                    <span className="w-4 text-right text-[11px] font-bold text-brand shrink-0">{index + 1}</span>
                    <p className="text-[11px] text-ink-3 leading-relaxed">{line}</p>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-kosha-border flex items-center justify-between gap-2">
                <p className="text-[11px] text-ink-3 flex-1 leading-relaxed">{monthlyPortfolioSnapshot.nextAction}</p>
                <button
                  type="button"
                  onClick={() => navigate('/transactions', { state: { openAddInvestment: true } })}
                  className="btn-secondary-sm shrink-0"
                >
                  Log investment
                </button>
              </div>
            </div>
          )}

          {heavyReady && showAdvancedInsights && allCatEntries.length > 0 && (
            <CategorySpendingChart
              entries={allCatEntries}
              total={categoryTotal}
              month={month}
              year={year}
              subtitle="Ranked category share with exact spend values"
            />
          )}

          </>
          )}
        </motion.div>
      )}

    </div>
  )
}
