import { useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useMonthSummary, useTransactions, useMonthExpenseDailyTotals } from '../hooks/useTransactions'
import { useBudgets, budgetMap as buildBudgetMap } from '../hooks/useBudgets'
import { CATEGORIES } from '../lib/categories'
import CategorySpendingChart from '../components/categories/CategorySpendingChart'
import BudgetSheet from '../components/categories/BudgetSheet'
import { fmt } from '../lib/utils'
import { bandTextClass, scoreRiskBand } from '../lib/insightBands'
import { MONTH_NAMES } from '../lib/constants'
import PageHeaderPage from '../components/layout/PageHeaderPage'
import SkeletonLayout from '../components/common/SkeletonLayout'
import PickerNavigator from '../components/common/PickerNavigator'
import EmptyState from '../components/common/EmptyState'
import SectionHeader from '../components/common/SectionHeader'
import MonthHeroCard from '../components/cards/monthly/MonthHeroCard'
import DailySpendTrend from '../components/cards/monthly/DailySpendTrend'
import MerchantIntelCard from '../components/cards/monthly/MerchantIntelCard'
import { CashflowWaterfallChart } from '../components/analytics/AnalyticsCharts'
import Button from '../components/ui/Button'

const MIN_NAV_YEAR = 1900
const MAX_NAV_YEAR = 2100
const MONTHLY_MERCHANT_COLUMNS = 'id, date, type, amount, description'

function toPctDelta(current, previous) {
  const currentValue = Number(current || 0)
  const previousValue = Number(previous || 0)

  if (!Number.isFinite(currentValue) || !Number.isFinite(previousValue)) return null
  if (previousValue === 0) return currentValue === 0 ? 0 : null

  return Math.round(((currentValue - previousValue) / previousValue) * 100)
}

function formatPctDelta(value) {
  if (value == null) return 'New'
  if (value === 0) return '0%'
  return `${value > 0 ? '+' : ''}${value}%`
}

function deltaToneClass(value, { inverse = false } = {}) {
  if (value == null || value === 0) return 'text-ink-2'
  if (inverse) return value > 0 ? 'text-expense-text' : 'text-income-text'
  return value > 0 ? 'text-income-text' : 'text-expense-text'
}

function normalizeMerchantQuery(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

export default function Monthly() {
  const navigate = useNavigate()
  const now = new Date()
  const currentDayOfMonth = now.getDate()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const monthParam = `${year}-${String(month).padStart(2, '0')}`

  const previousPeriod = useMemo(() => {
    if (month === 1) {
      return { year: year - 1, month: 12 }
    }
    return { year, month: month - 1 }
  }, [year, month])

  const { data, loading } = useMonthSummary(year, month)
  const { data: previousMonthData } = useMonthSummary(previousPeriod.year, previousPeriod.month)
  const { data: monthlyExpenseDailyTotals = {}, loading: monthlyExpenseTotalsLoading } = useMonthExpenseDailyTotals(year, month)
  const heavyReady = !loading
  const monthStartDate = `${year}-${String(month).padStart(2, '0')}-01`
  const monthEndDate = `${year}-${String(month).padStart(2, '0')}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`
  const { data: merchantRows = [] } = useTransactions({
    type: 'expense',
    startDate: monthStartDate,
    endDate: monthEndDate,
    enabled: true,
    columns: MONTHLY_MERCHANT_COLUMNS,
  })
  const { budgets } = useBudgets()
  const bMap = useMemo(() => buildBudgetMap(budgets), [budgets])
  const [showBudgetSheet, setShowBudgetSheet] = useState(false)

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
  const categoryTotal = useMemo(
    () => allCatEntries.reduce((s, [, v]) => s + v, 0) || 1,
    [allCatEntries]
  )
  const categoryLabelById = useMemo(
    () => new Map(CATEGORIES.map((category) => [category.id, category.label])),
    []
  )

  const daysInSelectedMonth = new Date(year, month, 0).getDate()
  const isCurrentMonthView = year === now.getFullYear() && month === now.getMonth() + 1

  const categoryVelocitySignal = useMemo(() => {
    if (!allCatEntries.length || spent <= 0) return null

    const daysElapsed = isCurrentMonthView
      ? Math.max(1, Math.min(currentDayOfMonth, daysInSelectedMonth))
      : daysInSelectedMonth

    const [categoryId, categorySpend] = allCatEntries[0]
    const monthAvgDaily = spent / Math.max(1, daysElapsed)
    const topDaily = categorySpend / Math.max(1, daysElapsed)
    const ratio = monthAvgDaily > 0 ? topDaily / monthAvgDaily : 0
    const tone = scoreRiskBand(ratio, { high: 1.4, watch: 1.15 })

    return {
      label: categoryLabelById.get(categoryId) || categoryId,
      spend: categorySpend,
      daily: topDaily,
      sharePct: Math.round((categorySpend / spent) * 100),
      tone,
    }
  }, [allCatEntries, spent, isCurrentMonthView, currentDayOfMonth, daysInSelectedMonth, categoryLabelById])

  const budgetPressureSignal = useMemo(() => {
    const budgetRows = [...(bMap?.entries?.() || [])]
      .map(([categoryId, budgetRow]) => ({
        categoryId,
        limit: Number(budgetRow?.monthly_limit || 0),
      }))
      .filter((row) => Number.isFinite(row.limit) && row.limit > 0)

    if (!budgetRows.length) return null

    const scored = budgetRows
      .map((row) => {
        const spentValue = Number(data?.byCategory?.[row.categoryId] || 0)
        const utilization = row.limit > 0 ? Math.round((spentValue / row.limit) * 100) : 0
        return {
          ...row,
          spentValue,
          utilization,
          label: categoryLabelById.get(row.categoryId) || row.categoryId,
        }
      })
      .sort((a, b) => b.utilization - a.utilization)

    const overrunCount = scored.filter((row) => row.utilization > 100).length
    const warningCount = scored.filter((row) => row.utilization >= 80 && row.utilization <= 100).length
    const top = scored[0] || null

    if (!top) return null

    const tone = scoreRiskBand(top.utilization, { high: 95, watch: 75 })

    return {
      top,
      overrunCount,
      warningCount,
      tone,
    }
  }, [bMap, data?.byCategory, categoryLabelById])

  const dailyVariabilitySignal = useMemo(() => {
    const values = Object.values(monthlyExpenseDailyTotals)
      .map((value) => Number(value || 0))
      .filter((value) => Number.isFinite(value) && value > 0)

    if (values.length < 7) return null

    const avg = values.reduce((sum, value) => sum + value, 0) / values.length
    const variance = values.reduce((sum, value) => sum + ((value - avg) ** 2), 0) / values.length
    const std = Math.sqrt(variance)
    const cvPct = avg > 0 ? Math.round((std / avg) * 100) : 0
    const tone = scoreRiskBand(cvPct, { high: 50, watch: 25 })

    return {
      avg,
      std,
      cvPct,
      activeDays: values.length,
      tone,
    }
  }, [monthlyExpenseDailyTotals])

  const peakExpenseDay = useMemo(() => {
    const ranked = Object.entries(monthlyExpenseDailyTotals)
      .map(([dateKey, total]) => [dateKey, Number(total || 0)])
      .filter(([dateKey, total]) => !!dateKey && Number.isFinite(total) && total > 0)
      .sort((a, b) => b[1] - a[1])

    if (!ranked.length) return null

    const [dateKey, total] = ranked[0]
    return {
      date: dateKey,
      amount: Number(total || 0),
    }
  }, [monthlyExpenseDailyTotals])

  const merchantConcentrationSignal = useMemo(() => {
    if (!merchantRows.length) return null

    const merchants = new Map()
    let totalExpense = 0

    for (const row of merchantRows) {
      if (row?.type !== 'expense') continue
      const amount = Number(row?.amount || 0)
      if (!Number.isFinite(amount) || amount <= 0) continue

      const queryText = normalizeMerchantQuery(row?.description)
      if (!queryText) continue

      totalExpense += amount

      const key = queryText.toLowerCase()
      const existing = merchants.get(key)
      if (existing) {
        existing.total += amount
        existing.count += 1
        continue
      }

      merchants.set(key, {
        key,
        label: queryText,
        queryText,
        total: amount,
        count: 1,
      })
    }

    if (!merchants.size || totalExpense <= 0) return null

    const ranked = [...merchants.values()]
      .filter((merchant) => merchant.count >= 2)
      .sort((a, b) => b.total - a.total)

    if (!ranked.length) return null

    const top = ranked[0]
    const sharePct = Math.round((top.total / totalExpense) * 100)
    const tone = scoreRiskBand(sharePct, { high: 28, watch: 18 })

    return {
      ...top,
      sharePct,
      tone,
    }
  }, [merchantRows])

  const hasMonthData = useMemo(() => {
    const totalsPresent = inflow > 0 || spent > 0 || invested > 0
    const categoryPresent = allCatEntries.length > 0
    const planningPresent = Object.keys(monthlyExpenseDailyTotals).length > 0 || merchantRows.length > 0

    return totalsPresent || categoryPresent || planningPresent
  }, [
    inflow,
    spent,
    invested,
    allCatEntries.length,
    monthlyExpenseDailyTotals,
    merchantRows.length,
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
    let confidenceLabel = 'Confidence'
    let confidenceHint = 'Projection confidence updates as the month progresses.'

    if (isPastMonth) {
      timelineLabel = 'Status'
      timelineValue = 'Closed'
      confidenceLabel = 'Final'
      confidenceHint = 'Month is closed; values are final.'
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

      if (daysElapsed < 7) {
        confidenceLabel = 'Low confidence'
        confidenceHint = 'Early-month pace can change quickly with a few large transactions.'
      } else if (daysElapsed < 15) {
        confidenceLabel = 'Medium confidence'
        confidenceHint = 'Projection is stabilizing but still sensitive to large spends.'
      } else {
        confidenceLabel = 'High confidence'
        confidenceHint = 'Trend is stable enough to use for corrective planning.'
      }

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
      confidenceLabel = 'Planning view'
      confidenceHint = 'Based on currently planned entries only.'
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
      confidenceLabel,
      confidenceHint,
    }
  }, [inflow, spent, invested, year, month])

  const monthOverMonthSignal = useMemo(() => {
    if (!previousMonthData) return null

    const currentOutflow = spent + invested
    const previousInflow = Number(previousMonthData.earned || 0) + Number(previousMonthData.repayments || 0)
    const previousOutflow = Number(previousMonthData.expense || 0) + Number(previousMonthData.investment || 0)
    const currentNet = monthCloseSummary.net
    const previousNet = previousInflow - previousOutflow

    return {
      previousLabel: `${MONTH_NAMES[previousPeriod.month - 1].slice(0, 3)} ${previousPeriod.year}`,
      inflowPct: toPctDelta(inflow, previousInflow),
      outflowPct: toPctDelta(currentOutflow, previousOutflow),
      netDelta: currentNet - previousNet,
    }
  }, [previousMonthData, inflow, spent, invested, monthCloseSummary.net, previousPeriod.month, previousPeriod.year])

  const monthlyActionQueue = useMemo(() => {
    if (!isCurrentMonthView) return []

    const expenseRoute = `/transactions?month=${monthParam}&type=expense`
    const items = []

    if (monthCloseSummary.health === 'at-risk') {
      items.push({
        id: 'close-risk',
        priority: 100,
        tone: 'high',
        title: 'Projected month close is negative',
        message: 'Prioritize optional-expense cuts to recover the close trajectory.',
        actionLabel: 'Review outflows',
        route: expenseRoute,
      })
    }

    if (budgetPressureSignal?.overrunCount > 0 || (budgetPressureSignal?.top?.utilization || 0) >= 80) {
      const categoryRoute = budgetPressureSignal?.top?.categoryId
        ? `${expenseRoute}&category=${encodeURIComponent(budgetPressureSignal.top.categoryId)}`
        : expenseRoute

      items.push({
        id: 'budget-pressure',
        priority: 90,
        tone: budgetPressureSignal?.overrunCount > 0 ? 'high' : 'watch',
        title: budgetPressureSignal?.overrunCount > 0
          ? `${budgetPressureSignal.overrunCount} budget overrun${budgetPressureSignal.overrunCount === 1 ? '' : 's'}`
          : 'Budget utilization is nearing limit',
        message: budgetPressureSignal?.top
          ? `${budgetPressureSignal.top.label} is at ${budgetPressureSignal.top.utilization}% utilization.`
          : 'One or more categories are above safe budget pace.',
        actionLabel: 'Review category',
        route: categoryRoute,
      })
    }

    if (categoryVelocitySignal && categoryVelocitySignal.sharePct >= 35) {
      const velocityRoute = allCatEntries[0]?.[0]
        ? `${expenseRoute}&category=${encodeURIComponent(allCatEntries[0][0])}`
        : expenseRoute

      items.push({
        id: 'category-velocity',
        priority: 75,
        tone: categoryVelocitySignal.tone,
        title: `${categoryVelocitySignal.label} is dominating spend`,
        message: `${categoryVelocitySignal.sharePct}% share this month at ${fmt(categoryVelocitySignal.daily)}/active day.`,
        actionLabel: 'Inspect category',
        route: velocityRoute,
      })
    }

    if (dailyVariabilitySignal?.tone === 'high') {
      items.push({
        id: 'daily-volatility',
        priority: 65,
        tone: 'watch',
        title: 'Daily spending pattern is volatile',
        message: `Daily variability is ${dailyVariabilitySignal.cvPct}% (CV).`,
        actionLabel: peakExpenseDay?.date ? 'Inspect spike day' : 'Open month expenses',
        route: peakExpenseDay?.date
          ? `${expenseRoute}&day=${encodeURIComponent(peakExpenseDay.date)}`
          : expenseRoute,
      })
    }

    if (merchantConcentrationSignal && merchantConcentrationSignal.sharePct >= 25) {
      items.push({
        id: 'merchant-concentration',
        priority: 70,
        tone: merchantConcentrationSignal.tone,
        title: `${merchantConcentrationSignal.label} is driving repeat spend`,
        message: `${merchantConcentrationSignal.sharePct}% of expense spend across ${merchantConcentrationSignal.count} transactions.`,
        actionLabel: 'Inspect merchant',
        route: `${expenseRoute}&q=${encodeURIComponent(merchantConcentrationSignal.queryText)}`,
      })
    }

    return items.sort((a, b) => b.priority - a.priority).slice(0, 3)
  }, [
    isCurrentMonthView,
    monthParam,
    monthCloseSummary.health,
    budgetPressureSignal,
    categoryVelocitySignal,
    dailyVariabilitySignal,
    peakExpenseDay,
    merchantConcentrationSignal,
    allCatEntries,
  ])

  const trackMonthlyActionClick = useCallback((actionId) => {
    try {
      const storageKey = 'kosha:monthly-action-queue-clicks-v1'
      const parsed = JSON.parse(localStorage.getItem(storageKey) || '{}')
      const monthBucket = String(monthParam)
      const monthClicks = parsed[monthBucket] || {}

      monthClicks[actionId] = Number(monthClicks[actionId] || 0) + 1
      parsed[monthBucket] = monthClicks

      localStorage.setItem(storageKey, JSON.stringify(parsed))
    } catch {
      // no-op
    }
  }, [monthParam])

  return (
    <PageHeaderPage title="Monthly">

      <PickerNavigator
        className="mb-3"
        label={`${MONTH_NAMES[month - 1]} ${year}`}
        onPrev={prev}
        onNext={next}
        mode="month"
        month={month}
        year={year}
        minYear={MIN_NAV_YEAR}
        maxYear={MAX_NAV_YEAR}
        onSelectMonthYear={({ month: selectedMonth, year: selectedYear }) => {
          setYear(selectedYear)
          setMonth(selectedMonth)
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
              className="py-10"
              imageUrl="/illustrations/monthly_empty.png"
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
          <div className="mb-3">
            <MonthHeroCard month={month} year={year} data={data} />
          </div>

          {monthOverMonthSignal && (
            <div className="card p-3.5 border-0">
              <SectionHeader
                className="mb-2"
                title="Month-over-month snapshot"
                subtitle={`Compared to ${monthOverMonthSignal.previousLabel}`}
              />

              <div className="grid grid-cols-3 gap-2">
                <div className="mini-panel p-2.5">
                  <p className="text-caption text-ink-3">Inflow</p>
                  <p className={`text-[13px] font-semibold tabular-nums ${deltaToneClass(monthOverMonthSignal.inflowPct)}`}>
                    {formatPctDelta(monthOverMonthSignal.inflowPct)}
                  </p>
                </div>
                <div className="mini-panel p-2.5">
                  <p className="text-caption text-ink-3">Outflow</p>
                  <p className={`text-[13px] font-semibold tabular-nums ${deltaToneClass(monthOverMonthSignal.outflowPct, { inverse: true })}`}>
                    {formatPctDelta(monthOverMonthSignal.outflowPct)}
                  </p>
                </div>
                <div className="mini-panel p-2.5">
                  <p className="text-caption text-ink-3">Net</p>
                  <p className={`text-[13px] font-semibold tabular-nums ${deltaToneClass(monthOverMonthSignal.netDelta)}`}>
                    {monthOverMonthSignal.netDelta >= 0 ? '+' : '-'}{fmt(Math.abs(monthOverMonthSignal.netDelta))}
                  </p>
                </div>
              </div>
            </div>
          )}

          {monthlyActionQueue.length > 0 && (
            <div className="card p-3.5 border-0">
              <SectionHeader
                className="mb-2"
                title="Monthly action queue"
                subtitle="Top fixes to improve your month-end outcome"
                rightText={`${monthlyActionQueue.length} open`}
              />

              <div className="space-y-2">
                {monthlyActionQueue.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-card border border-kosha-border bg-kosha-surface-2 px-3 py-2.5 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className={`text-[12px] font-semibold ${item.tone === 'high' ? 'text-warning-text' : item.tone === 'watch' ? 'text-brand' : 'text-ink'}`}>
                        {item.title}
                      </p>
                      <p className="text-[10px] text-ink-3 mt-0.5 leading-relaxed">{item.message}</p>
                    </div>
                    <Button
                      variant={item.tone === 'high' ? 'primary' : 'secondary'}
                      size="xs"
                      onClick={() => {
                        trackMonthlyActionClick(item.id)
                        navigate(item.route)
                      }}
                      className="shrink-0 whitespace-nowrap"
                    >
                      {item.actionLabel}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

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

            <div className="grid grid-cols-3 gap-2 mb-2.5">
              <div className="mini-panel p-2.5">
                <p className="text-caption text-ink-3">Net close</p>
                <p className={`text-[clamp(0.72rem,2.3vw,0.9rem)] font-semibold tabular-nums whitespace-nowrap ${monthCloseSummary.net >= 0 ? 'text-income-text' : 'text-expense-text'}`}>
                  {monthCloseSummary.net >= 0 ? '+' : '-'}{fmt(Math.abs(monthCloseSummary.net))}
                </p>
              </div>
              <div className="mini-panel p-2.5">
                <p className="text-caption text-ink-3">Outflow</p>
                <p className="text-[clamp(0.72rem,2.3vw,0.9rem)] font-semibold tabular-nums whitespace-nowrap text-ink-2">{fmt(monthCloseSummary.totalOutflow)}</p>
              </div>
              <div className="mini-panel p-2.5">
                <p className="text-caption text-ink-3">{monthCloseSummary.timelineLabel}</p>
                <p className="text-[clamp(0.72rem,2.3vw,0.9rem)] font-semibold tabular-nums whitespace-nowrap text-ink-2">{monthCloseSummary.timelineValue}</p>
              </div>
            </div>

            <p className="text-[11px] text-ink-3">{monthCloseSummary.message}</p>
            <p className="text-[10px] text-ink-3 mt-1.5">
              {monthCloseSummary.confidenceLabel}: {monthCloseSummary.confidenceHint}
            </p>

            <div className="flex flex-wrap gap-2 mt-2.5">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate(`/transactions?month=${monthParam}`)}
              >
                Open month transactions
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate(`/transactions?month=${monthParam}&type=expense`)}
              >
                Review expenses
              </Button>
            </div>
          </div>

          {heavyReady && (inflow > 0 || spent > 0 || invested > 0) && (
            <CashflowWaterfallChart
              totalIncome={inflow}
              totalExpense={spent}
              totalInvestment={invested}
              periodLabel="Monthly"
            />
          )}

          {heavyReady && (categoryVelocitySignal || budgetPressureSignal || dailyVariabilitySignal) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {categoryVelocitySignal && (
                <div className="card p-3.5 border-0">
                  <p className="text-[10px] text-ink-3 tracking-wide">Highest category velocity</p>
                  <p className="text-[14px] font-semibold text-ink mt-1 truncate" title={categoryVelocitySignal.label}>
                    {categoryVelocitySignal.label}
                  </p>
                  <p className={`text-[12px] mt-1 tabular-nums ${bandTextClass(categoryVelocitySignal.tone)}`}>
                    {categoryVelocitySignal.sharePct}% of spend · {fmt(categoryVelocitySignal.spend)}
                  </p>
                  <p className="text-[10px] text-ink-3 mt-1 tabular-nums">
                    {fmt(categoryVelocitySignal.daily)} per active day
                  </p>
                </div>
              )}

              {budgetPressureSignal && (
                <div className="card p-3.5 border-0">
                  <p className="text-[10px] text-ink-3 tracking-wide">Budget pressure</p>
                  <p className={`text-[14px] font-semibold mt-1 ${bandTextClass(budgetPressureSignal.tone)}`}>
                    {budgetPressureSignal.tone === 'high' ? 'Overrun detected' : budgetPressureSignal.tone === 'watch' ? 'Near limit' : 'Within limits'}
                  </p>
                  <p className="text-[12px] text-ink-2 mt-1 truncate" title={budgetPressureSignal.top.label}>
                    {budgetPressureSignal.top.label}
                  </p>
                  <p className="text-[10px] text-ink-3 mt-1 tabular-nums">
                    {budgetPressureSignal.top.utilization}% utilization · {budgetPressureSignal.overrunCount} overrun, {budgetPressureSignal.warningCount} warning
                  </p>
                </div>
              )}

              {dailyVariabilitySignal && (
                <div className="card p-3.5 border-0">
                  <p className="text-[10px] text-ink-3 tracking-wide">Daily variability</p>
                  <p className={`text-[14px] font-semibold mt-1 ${bandTextClass(dailyVariabilitySignal.tone)}`}>
                    {dailyVariabilitySignal.tone === 'high' ? 'Chaotic pattern' : dailyVariabilitySignal.tone === 'watch' ? 'Volatile pattern' : 'Stable pattern'}
                  </p>
                  <p className="text-[12px] text-ink-2 mt-1 tabular-nums">
                    Avg {fmt(dailyVariabilitySignal.avg)} / day
                  </p>
                  <p className="text-[10px] text-ink-3 mt-1 tabular-nums">
                    CV {dailyVariabilitySignal.cvPct}% · {dailyVariabilitySignal.activeDays} active days
                  </p>
                </div>
              )}
            </div>
          )}

          {heavyReady && !monthlyExpenseTotalsLoading && Object.keys(monthlyExpenseDailyTotals).length > 0 && (
            <DailySpendTrend
              dailyTotals={monthlyExpenseDailyTotals}
              year={year}
              month={month}
              onReviewExpenses={() => navigate(`/transactions?month=${monthParam}&type=expense`)}
              onReviewPeakDay={(dateISO) => navigate(`/transactions?month=${monthParam}&type=expense&day=${encodeURIComponent(dateISO)}`)}
            />
          )}

          {heavyReady && merchantRows.length > 0 && (
            <MerchantIntelCard
              txnRows={merchantRows}
              onReviewExpenses={() => navigate(`/transactions?month=${monthParam}&type=expense`)}
              onReviewMerchant={(merchant) => navigate(`/transactions?month=${monthParam}&type=expense&q=${encodeURIComponent(merchant?.queryText || merchant?.label || '')}`)}
            />
          )}

          {heavyReady && allCatEntries.length > 0 && (
            <>
            <CategorySpendingChart
              entries={allCatEntries}
              total={categoryTotal}
              month={month}
              year={year}
              subtitle="Ranked category share with exact spend values"
              budgetMap={bMap}
            />
            <div className="flex justify-end -mt-1 mb-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowBudgetSheet(true)}
              >
                Manage budgets
              </Button>
            </div>
            </>
          )}

          </>
          )}
        </motion.div>
      )}

      <BudgetSheet
        open={showBudgetSheet}
        onClose={() => setShowBudgetSheet(false)}
        budgets={budgets}
        byCategory={data?.byCategory || {}}
      />
    </PageHeaderPage>
  )
}
