import { useState, useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useMonthSummary, useTransactions, TRANSACTION_INSIGHTS_COLUMNS } from '../hooks/useTransactions'
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

export default function Monthly() {
  const navigate = useNavigate()
  const now = new Date()
  const currentDayOfMonth = now.getDate()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [heavyReady, setHeavyReady] = useState(false)

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
    enabled: true,
    columns: TRANSACTION_INSIGHTS_COLUMNS,
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
    const budgetRows = Object.entries(bMap || {})
      .map(([categoryId, limit]) => ({
        categoryId,
        limit: Number(limit || 0),
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
    if (!txnRows.length) return null

    const dayTotals = new Map()
    for (const row of txnRows) {
      if (row?.type !== 'expense') continue
      const amount = Number(row?.amount || 0)
      if (!Number.isFinite(amount) || amount <= 0) continue
      const key = String(row?.date || '')
      if (!key) continue
      dayTotals.set(key, (dayTotals.get(key) || 0) + amount)
    }

    const values = [...dayTotals.values()]
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
  }, [txnRows])

  const hasMonthData = useMemo(() => {
    const totalsPresent = inflow > 0 || spent > 0 || invested > 0
    const categoryPresent = allCatEntries.length > 0
    const planningPresent = txnRows.length > 0

    return totalsPresent || categoryPresent || planningPresent
  }, [
    inflow,
    spent,
    invested,
    allCatEntries.length,
    txnRows.length,
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

          {heavyReady && txnRows.length > 0 && (
            <DailySpendTrend txnRows={txnRows} year={year} month={month} />
          )}

          {heavyReady && txnRows.length > 0 && (
            <MerchantIntelCard txnRows={txnRows} />
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
