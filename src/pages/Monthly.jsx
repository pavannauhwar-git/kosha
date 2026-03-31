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
import MonthHeroCard from '../components/cards/monthly/MonthHeroCard'
import BreakdownCard from '../components/cards/monthly/BreakdownCard'
import { buildReconciliationInsights, getReviewedReconciliationIds } from '../lib/reconciliation'
import { useReconciliationReviews } from '../hooks/useReconciliationReviews'
import useCompactViewport from '../hooks/useCompactViewport'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts'

function compactTick(value) {
  const n = Number(value || 0)
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${Math.round((n / 1_000_000) * 10) / 10}M`
  if (abs >= 1_000) return `${Math.round(n / 1_000)}k`
  return `${Math.round(n)}`
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

function PortfolioMixTooltip({ active, payload, total }) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload || {}
  const value = Number(row?.value || 0)
  const pct = total > 0 ? Math.round((value / total) * 100) : 0

  return (
    <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5 shadow-card min-w-[170px]">
      <p className="text-[11px] font-semibold text-ink mb-1">{row?.name || 'Vehicle'}</p>
      <div className="space-y-0.5 text-[11px]">
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-3">Allocated</span>
          <span className="font-semibold tabular-nums text-invest-text">{fmt(value)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-ink-3">Share</span>
          <span className="font-semibold tabular-nums text-ink">{pct}%</span>
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
  const isCompact = useCompactViewport()
  const isTiny = useCompactViewport(360)
  const monthRef = useRef(null)

  useEffect(() => {
    const timer = setTimeout(() => setHeavyReady(true), 260)
    return () => clearTimeout(timer)
  }, [])

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

  const monthCloseReadiness = useMemo(() => {
    const queueRows = reconciliationInsights.queue
      .map((item) => item?.txn)
      .filter(Boolean)
    const firstQueueTxnId = queueRows[0]?.id || null

    const categorizedRows = txnRows.filter((row) => row?.type === 'expense' || row?.type === 'investment')
    const missingCategoryRows = categorizedRows.filter((row) => !row?.category || row?.category === 'other')
    const missingCategoryCount = missingCategoryRows.length
    const firstMissingCategoryTxnId = missingCategoryRows[0]?.id || null
    const categoryCompletenessPct = categorizedRows.length > 0
      ? Math.round(((categorizedRows.length - missingCategoryCount) / categorizedRows.length) * 100)
      : 100

    const expenseAmounts = txnRows
      .filter((row) => row?.type === 'expense')
      .map((row) => Number(row?.amount || 0))
      .filter((value) => value > 0)
      .sort((a, b) => a - b)
    const midIndex = Math.floor(expenseAmounts.length / 2)
    const medianExpense = expenseAmounts.length
      ? (expenseAmounts.length % 2 === 0
          ? (expenseAmounts[midIndex - 1] + expenseAmounts[midIndex]) / 2
          : expenseAmounts[midIndex])
      : 0
    const unusualThreshold = Math.max(2500, medianExpense * 2)

    const unusualRows = txnRows.filter((row) => (
      row?.type === 'expense' && Number(row?.amount || 0) >= unusualThreshold
    ))
    const unresolvedUnusualRows = unusualRows.filter((row) => !reviewedIds.has(row?.id))
    const reviewedUnusualCount = unusualRows.length - unresolvedUnusualRows.length
    const firstUnusualTxnId = unresolvedUnusualRows[0]?.id || unusualRows[0]?.id || null

    const reconciliationRoute = firstQueueTxnId
      ? `/reconciliation?view=queue&quality=all&focus=${encodeURIComponent(firstQueueTxnId)}`
      : '/reconciliation?view=queue&quality=all'
    const missingCategoryRoute = firstMissingCategoryTxnId
      ? `/transactions?focus=${encodeURIComponent(firstMissingCategoryTxnId)}`
      : '/transactions'
    const unusualRoute = firstUnusualTxnId
      ? `/transactions?focus=${encodeURIComponent(firstUnusualTxnId)}`
      : '/transactions'

    const items = [
      {
        key: 'reconciliation',
        done: reconcileQueueCount === 0,
        label: reconcileQueueCount === 0
          ? 'Reconciliation queue is clear.'
          : `${reconcileQueueCount} reconciliation item${reconcileQueueCount > 1 ? 's' : ''} pending.`,
        cta: 'Open reconciliation',
        route: reconciliationRoute,
      },
      {
        key: 'categories',
        done: missingCategoryCount === 0,
        label: missingCategoryCount === 0
          ? 'Category completeness is clean.'
          : `${missingCategoryCount} transaction${missingCategoryCount > 1 ? 's are' : ' is'} still uncategorized.`,
        cta: missingCategoryCount > 0 ? 'Fix first issue' : 'Open transactions',
        route: missingCategoryRoute,
      },
      {
        key: 'unusual',
        done: unusualRows.length === 0 || reviewedUnusualCount === unusualRows.length,
        label: unusualRows.length === 0
          ? 'No unusual spend spikes found this month.'
          : `${reviewedUnusualCount}/${unusualRows.length} unusual transaction${unusualRows.length > 1 ? 's' : ''} reviewed.`,
        cta: unusualRows.length > 0 ? 'Review in transactions' : 'Open transactions',
        route: unusualRoute,
      },
    ]

    const completedCount = items.filter((item) => item.done).length
    const completionPct = Math.round((completedCount / items.length) * 100)

    return {
      items,
      completionPct,
      categoryCompletenessPct,
      unusualCount: unusualRows.length,
      reviewedUnusualCount,
    }
  }, [txnRows, reviewedIds, reconcileQueueCount, reconciliationInsights])

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
  }, [txnRows, year, month])

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

          {heavyReady && weeklyFlowDiagnostics.hasData && (
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
                <ResponsiveContainer width="100%" height={isTiny ? 184 : isCompact ? 196 : 218}>
                  <ComposedChart data={weeklyFlowDiagnostics.series} margin={{ top: 8, right: isTiny ? 2 : isCompact ? 4 : 10, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(16,33,63,0.10)" />
                    <XAxis
                      dataKey="week"
                      tick={{ fontSize: isTiny ? 9 : 10, fill: 'rgba(94,109,143,0.95)', fontWeight: 600 }}
                      axisLine={false}
                      tickLine={false}
                      interval={isTiny ? 2 : isCompact ? 1 : 0}
                    />
                    <YAxis
                      yAxisId="amount"
                      tickFormatter={compactTick}
                      tick={{ fontSize: isTiny ? 9 : 10, fill: 'rgba(94,109,143,0.95)' }}
                      axisLine={false}
                      tickLine={false}
                      width={isTiny ? 24 : isCompact ? 28 : 34}
                    />
                    <YAxis yAxisId="net" hide />
                    <RechartsTooltip content={<WeeklyCadenceTooltip />} />
                    <Bar yAxisId="amount" dataKey="Inflow" fill="#0E9F6E" radius={[6, 6, 0, 0]} maxBarSize={isTiny ? 18 : 24} />
                    <Bar yAxisId="amount" dataKey="Outflow" fill="#E11D48" radius={[6, 6, 0, 0]} maxBarSize={isTiny ? 18 : 24} />
                    <Line yAxisId="net" type="monotone" dataKey="Net" stroke="#0A67D8" strokeWidth={2.3} dot={{ r: isTiny ? 2.2 : 3 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>

              <p className="text-[10px] text-ink-3 mt-1.5">Bars compare weekly flow magnitude; line tracks weekly net regime shift across the month.</p>
            </div>
          )}

          {heavyReady && (monthlyPortfolioSnapshot.rows.length > 0 || invested > 0) && (
            <div className="card p-4 border-0">
              <SectionHeader
                className="mb-2"
                title="Portfolio snapshot"
                subtitle="Current month allocation and deployment cues"
                badge={{
                  label: monthlyPortfolioSnapshot.total > 0 ? fmt(monthlyPortfolioSnapshot.total, true) : 'No allocation',
                  className: 'bg-invest-bg text-invest-text',
                }}
              />

              <div className="rounded-card border border-kosha-border bg-kosha-surface-2 p-3 mb-3">
                <div className="grid md:grid-cols-[1.05fr_0.95fr] gap-3">
                  <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
                    {monthlyPortfolioSnapshot.mixRows.length > 0 ? (
                      <div className={`relative ${isTiny ? 'h-[164px]' : isCompact ? 'h-[176px]' : 'h-[196px]'}`}>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={monthlyPortfolioSnapshot.mixRows}
                              dataKey="value"
                              nameKey="name"
                              innerRadius={isTiny ? 38 : isCompact ? 44 : 52}
                              outerRadius={isTiny ? 62 : isCompact ? 72 : 82}
                              paddingAngle={2}
                              stroke="#FFFFFF"
                              strokeWidth={2}
                            >
                              {monthlyPortfolioSnapshot.mixRows.map((row) => (
                                <Cell key={`monthly-vehicle-slice-${row.name}`} fill={row.color} />
                              ))}
                            </Pie>
                            <RechartsTooltip content={<PortfolioMixTooltip total={monthlyPortfolioSnapshot.total} />} />
                          </PieChart>
                        </ResponsiveContainer>

                        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                          <p className={isTiny ? 'text-[9px] text-ink-3' : 'text-[10px] text-ink-3'}>Allocated</p>
                          <p className={isTiny ? 'text-[14px] font-bold tabular-nums text-ink' : 'text-[16px] font-bold tabular-nums text-ink'}>{fmt(monthlyPortfolioSnapshot.total, true)}</p>
                          <p className={isTiny ? 'text-[9px] text-ink-3' : 'text-[10px] text-ink-3'}>{monthlyPortfolioSnapshot.rows.length} vehicle{monthlyPortfolioSnapshot.rows.length === 1 ? '' : 's'}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="h-[196px] flex items-center justify-center">
                        <p className="text-[11px] text-ink-3 text-center max-w-[220px]">Investments are logged, but no vehicle tags are present yet. Add a vehicle tag to unlock allocation intelligence.</p>
                      </div>
                    )}

                    {monthlyPortfolioSnapshot.top && (
                      <p className="text-[11px] text-ink-3 mt-1">
                        Largest vehicle is <span className="font-semibold text-ink">{monthlyPortfolioSnapshot.top.name}</span> at <span className="font-semibold text-ink">{monthlyPortfolioSnapshot.topPct}%</span>.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-card bg-kosha-surface p-2.5 border border-kosha-border">
                        <p className="text-caption text-ink-3">Deploy rate</p>
                        <p className={`text-[13px] font-bold tabular-nums ${monthlyPortfolioSnapshot.deployRate >= 12 && monthlyPortfolioSnapshot.deployRate <= 35 ? 'text-income-text' : 'text-warning-text'}`}>
                          {monthlyPortfolioSnapshot.deployRate}%
                        </p>
                      </div>
                      <div className="rounded-card bg-kosha-surface p-2.5 border border-kosha-border">
                        <p className="text-caption text-ink-3">Concentration</p>
                        <p className={`text-[13px] font-bold tabular-nums ${monthlyPortfolioSnapshot.topPct >= 55 ? 'text-warning-text' : 'text-brand'}`}>
                          {monthlyPortfolioSnapshot.topPct}%
                        </p>
                        <p className="text-[10px] text-ink-3 mt-0.5">{monthlyPortfolioSnapshot.concentrationBand}</p>
                      </div>
                      <div className="rounded-card bg-kosha-surface p-2.5 border border-kosha-border">
                        <p className="text-caption text-ink-3">Diversification</p>
                        <p className={`text-[13px] font-bold tabular-nums ${monthlyPortfolioSnapshot.diversificationScore >= 70 ? 'text-income-text' : monthlyPortfolioSnapshot.diversificationScore >= 50 ? 'text-brand' : 'text-warning-text'}`}>
                          {monthlyPortfolioSnapshot.diversificationScore}/100
                        </p>
                      </div>
                      <div className="rounded-card bg-kosha-surface p-2.5 border border-kosha-border">
                        <p className="text-caption text-ink-3">Primary vehicle</p>
                        <p className="text-[12px] font-bold text-ink truncate">{monthlyPortfolioSnapshot.top?.name || '—'}</p>
                      </div>
                    </div>

                    {monthlyPortfolioSnapshot.rows.length > 0 && (
                      <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5 space-y-1.5">
                        {monthlyPortfolioSnapshot.rows.slice(0, 3).map((row) => {
                          const pct = monthlyPortfolioSnapshot.total > 0
                            ? Math.round((row.value / monthlyPortfolioSnapshot.total) * 100)
                            : 0
                          const color = monthlyPortfolioSnapshot.mixRows.find((slice) => slice.name === row.name)?.color || C.brand

                          return (
                            <div key={`monthly-portfolio-row-${row.name}`} className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                                <p className="text-[11px] text-ink-2 truncate">{row.name}</p>
                              </div>
                              <p className="text-[11px] tabular-nums text-ink shrink-0">{pct}% · {fmt(row.value, true)}</p>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
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

          {heavyReady && (
            <div className="card p-4 border-0">
              <SectionHeader
                className="mb-2"
                title="Month-close readiness"
                subtitle="Checklist for reconciliation quality and close confidence"
                badge={{
                  label: `${monthCloseReadiness.completionPct}% complete`,
                  className: monthCloseReadiness.completionPct >= 80
                    ? 'bg-income-bg text-income-text'
                    : 'bg-warning-bg text-warning-text',
                }}
              />

              <div className="h-2 rounded-pill bg-kosha-border overflow-hidden mb-3">
                <div className="h-full rounded-pill bg-brand" style={{ width: `${Math.max(6, monthCloseReadiness.completionPct)}%` }} />
              </div>

              <div className="space-y-2.5">
                {monthCloseReadiness.items.map((item) => (
                  <div key={item.key} className="rounded-card bg-kosha-surface p-3">
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="min-w-0 flex items-center gap-2.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded-pill font-semibold shrink-0 ${item.done ? 'bg-income-bg text-income-text' : 'bg-warning-bg text-warning-text'}`}>
                          {item.done ? 'Complete' : 'Attention'}
                        </span>
                        <p className="text-[12px] text-ink-2 truncate">{item.label}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(item.route)}
                        className="btn-secondary-sm shrink-0"
                      >
                        {item.cta}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {heavyReady && allCatEntries.length > 0 && (
            <CategorySpendingChart
              entries={allCatEntries}
              total={categoryTotal}
              month={month}
              year={year}
              subtitle="Treemap view with exact category spend values"
            />
          )}

          </>
          )}
        </motion.div>
      )}

    </div>
  )
}
