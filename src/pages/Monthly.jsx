import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useMonthSummary, useTransactions, TRANSACTION_INSIGHTS_COLUMNS } from '../hooks/useTransactions'
import { useBudgets } from '../hooks/useBudgets'
import { useLiabilitiesByMonth } from '../hooks/useLiabilities'
import CategorySpendingChart from '../components/categories/CategorySpendingChart'
import { fmt, daysUntil } from '../lib/utils'
import { MONTH_NAMES } from '../lib/constants'
import { CATEGORIES } from '../lib/categories'
import PageHeader from '../components/layout/PageHeader'
import SkeletonLayout from '../components/common/SkeletonLayout'
import PickerNavigator from '../components/common/PickerNavigator'
import EmptyState from '../components/common/EmptyState'
import SectionHeader from '../components/common/SectionHeader'
import BudgetSheet from '../components/monthly/BudgetSheet'
import MonthHeroCard from '../components/cards/monthly/MonthHeroCard'
import BreakdownCard from '../components/cards/monthly/BreakdownCard'
import { buildReconciliationInsights, getReviewedReconciliationIds } from '../lib/reconciliation'
import { useReconciliationReviews } from '../hooks/useReconciliationReviews'

export default function Monthly() {
  const navigate = useNavigate()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [heavyReady, setHeavyReady] = useState(false)
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
  const { budgets, setBudget, removeBudget } = useBudgets({ enabled: heavyReady })
  const { rows: monthBills = [], pending: pendingBills, paid: paidBills } = useLiabilitiesByMonth(year, month, { enabled: heavyReady })
  const { reviewedIdSet: serverReviewedIds, unavailable: reviewTableUnavailable } = useReconciliationReviews({ enabled: heavyReady })

  const reviewedIds = useMemo(
    () => (reviewTableUnavailable ? getReviewedReconciliationIds() : serverReviewedIds),
    [reviewTableUnavailable, serverReviewedIds]
  )
  const reconcileQueueCount = useMemo(() => {
    const insights = buildReconciliationInsights(txnRows, reviewedIds)
    return insights.counts.queue
  }, [txnRows, reviewedIds])

  const [budgetCat, setBudgetCat] = useState(null)

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
  const catEntries = useMemo(() => allCatEntries.slice(0, 8), [allCatEntries])
  const categoryTotal = useMemo(
    () => allCatEntries.reduce((s, [, v]) => s + v, 0) || 1,
    [allCatEntries]
  )
  const vehicleEntries = useMemo(
    () => Object.entries(data?.byVehicle || {}).sort((a, b) => b[1] - a[1]),
    [data?.byVehicle]
  )
  const budgetCount = useMemo(
    () => allCatEntries.filter(([id]) => budgets[id]).length,
    [allCatEntries, budgets]
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

  const budgetAccuracy = useMemo(() => {
    const rows = allCatEntries
      .map(([id, spent]) => ({
        id,
        spent: Number(spent || 0),
        budget: Number(budgets[id] || 0),
      }))
      .filter((row) => row.budget > 0)

    if (!rows.length) {
      return {
        hasBudgets: false,
        accuracyScore: 0,
        totalBudget: 0,
        totalSpent: 0,
        rows: [],
      }
    }

    const totalBudget = rows.reduce((sum, row) => sum + row.budget, 0)
    const totalSpent = rows.reduce((sum, row) => sum + row.spent, 0)

    const scoredRows = rows
      .map((row) => {
        const ratio = row.budget > 0 ? row.spent / row.budget : 0
        const variance = row.spent - row.budget
        const variancePct = row.budget > 0 ? (variance / row.budget) * 100 : 0
        const absVariancePct = Math.abs(variancePct)
        const score = Math.max(0, Math.round(100 - Math.min(absVariancePct, 100)))
        const cat = CATEGORIES.find((item) => item.id === row.id)

        let band = 'On track'
        let bandClass = 'bg-income-bg text-income-text'
        if (variancePct > 20) {
          band = 'Overrun'
          bandClass = 'bg-expense-bg text-expense-text'
        } else if (variancePct > 8) {
          band = 'Watch'
          bandClass = 'bg-warning-bg text-warning-text'
        } else if (variancePct < -10) {
          band = 'Under'
          bandClass = 'bg-brand-container text-brand-on'
        }

        return {
          ...row,
          label: cat?.label || row.id,
          ratio,
          variance,
          variancePct,
          score,
          band,
          bandClass,
          ratioPct: Math.max(0, Math.min(100, Math.round(ratio * 100))),
        }
      })
      .sort((a, b) => Math.abs(b.variancePct) - Math.abs(a.variancePct))

    const accuracyScore = Math.round(
      scoredRows.reduce((sum, row) => sum + row.score, 0) / scoredRows.length
    )

    return {
      hasBudgets: true,
      accuracyScore,
      totalBudget,
      totalSpent,
      rows: scoredRows,
    }
  }, [allCatEntries, budgets])

  const autopilotHealth = useMemo(() => {
    const recurringBills = monthBills.filter((bill) => !!bill?.is_recurring)
    const recurringBillsPaid = recurringBills.filter((bill) => !!bill?.paid)
    const overdueRecurringBills = recurringBills.filter((bill) => !bill?.paid && daysUntil(bill?.due_date) < 0)

    const recurringInvestments = txnRows.filter((row) => row?.type === 'investment' && !!row?.is_recurring)
    const autoRecurringInvestments = recurringInvestments.filter((row) => !!row?.is_auto_generated)
    const manualRecurringInvestments = recurringInvestments.filter((row) => !row?.is_auto_generated)

    const billAutomationPct = recurringBills.length > 0
      ? Math.round((recurringBillsPaid.length / recurringBills.length) * 100)
      : 100
    const investmentAutomationPct = recurringInvestments.length > 0
      ? Math.round((autoRecurringInvestments.length / recurringInvestments.length) * 100)
      : 100

    const missedAutomations = overdueRecurringBills.length + manualRecurringInvestments.length
    const healthScore = Math.max(
      0,
      Math.min(
        100,
        Math.round((billAutomationPct * 0.55) + (investmentAutomationPct * 0.45) - (missedAutomations * 8))
      )
    )

    return {
      healthScore,
      recurringBillsCount: recurringBills.length,
      recurringBillsPaidCount: recurringBillsPaid.length,
      recurringInvestmentCount: recurringInvestments.length,
      autoRecurringInvestmentCount: autoRecurringInvestments.length,
      overdueRecurringBills,
      manualRecurringInvestments,
      missedAutomations,
    }
  }, [monthBills, txnRows])

  const monthCloseReadiness = useMemo(() => {
    const categorizedRows = txnRows.filter((row) => row?.type === 'expense' || row?.type === 'investment')
    const missingCategoryCount = categorizedRows.filter((row) => !row?.category || row?.category === 'other').length
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
    const reviewedUnusualCount = unusualRows.filter((row) => reviewedIds.has(row?.id)).length

    const items = [
      {
        key: 'reconciliation',
        done: reconcileQueueCount === 0,
        label: reconcileQueueCount === 0
          ? 'Reconciliation queue is clear.'
          : `${reconcileQueueCount} reconciliation item${reconcileQueueCount > 1 ? 's' : ''} pending.`,
        cta: 'Open reconciliation',
        route: '/reconciliation',
      },
      {
        key: 'categories',
        done: missingCategoryCount === 0,
        label: missingCategoryCount === 0
          ? 'Category completeness is clean.'
          : `${missingCategoryCount} transaction${missingCategoryCount > 1 ? 's are' : ' is'} still uncategorized.`,
        cta: 'Open transactions',
        route: '/transactions',
      },
      {
        key: 'unusual',
        done: unusualRows.length === 0 || reviewedUnusualCount === unusualRows.length,
        label: unusualRows.length === 0
          ? 'No unusual spend spikes found this month.'
          : `${reviewedUnusualCount}/${unusualRows.length} unusual transaction${unusualRows.length > 1 ? 's' : ''} reviewed.`,
        cta: 'Review unusual',
        route: '/reconciliation',
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
  }, [txnRows, reviewedIds, reconcileQueueCount])

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

  const openBudgetSheet = useCallback((cat) => setBudgetCat(cat), [])

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

      <div className="mb-3 md:mb-4">
        <MonthHeroCard month={month} year={year} data={data} />
      </div>

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
              description="This month is empty right now. Add transactions to unlock month-close insights, budgets, and reconciliation cues."
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
          <div className="card p-4">
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

          {heavyReady && (
            <div className="card p-4">
              <SectionHeader
                className="mb-2"
                title="Budget accuracy"
                subtitle="Planned vs actual with variance bands"
                badge={{
                  label: budgetAccuracy.hasBudgets ? `${budgetAccuracy.accuracyScore}/100` : 'No budgets',
                  className: budgetAccuracy.hasBudgets && budgetAccuracy.accuracyScore >= 75
                    ? 'bg-income-bg text-income-text'
                    : budgetAccuracy.hasBudgets
                      ? 'bg-warning-bg text-warning-text'
                      : 'bg-kosha-surface-2 text-ink-3 border border-kosha-border',
                }}
              />

              {budgetAccuracy.hasBudgets ? (
                <>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="rounded-card bg-kosha-surface-2 p-2.5">
                      <p className="text-caption text-ink-3">Planned</p>
                      <p className="text-base font-bold text-ink tabular-nums">{fmt(budgetAccuracy.totalBudget)}</p>
                    </div>
                    <div className="rounded-card bg-kosha-surface-2 p-2.5">
                      <p className="text-caption text-ink-3">Actual</p>
                      <p className="text-base font-bold text-expense-text tabular-nums">{fmt(budgetAccuracy.totalSpent)}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {budgetAccuracy.rows.slice(0, 6).map((row) => (
                      <div key={row.id} className="rounded-card bg-kosha-surface-2 p-2.5">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-[12px] font-semibold text-ink truncate">{row.label}</p>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-pill shrink-0 ${row.bandClass}`}>{row.band}</span>
                        </div>

                        <div className="h-1.5 rounded-pill bg-kosha-border overflow-hidden mb-1.5">
                          <div
                            className={`h-full rounded-pill ${row.variance > 0 ? 'bg-warning' : 'bg-income'}`}
                            style={{ width: `${Math.max(6, row.ratioPct)}%` }}
                          />
                        </div>

                        <div className="flex items-center justify-between gap-2 text-[10px] text-ink-3 tabular-nums">
                          <span>Planned {fmt(row.budget)} · Actual {fmt(row.spent)}</span>
                          <span className={row.variance > 0 ? 'text-expense-text' : 'text-income-text'}>
                            {row.variance > 0 ? '+' : '-'}{fmt(Math.abs(row.variance))}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-[12px] text-ink-3">Set budgets on category rows below to unlock budget accuracy scoring.</p>
              )}
            </div>
          )}

          {heavyReady && (
            <div className="card p-4">
              <SectionHeader
                className="mb-2"
                title="Autopilot health"
                subtitle="Recurring bills and recurring investments reliability"
                badge={{
                  label: `${autopilotHealth.healthScore}/100`,
                  className: autopilotHealth.healthScore >= 75
                    ? 'bg-income-bg text-income-text'
                    : autopilotHealth.healthScore >= 50
                      ? 'bg-warning-bg text-warning-text'
                      : 'bg-expense-bg text-expense-text',
                }}
              />

              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="rounded-card bg-kosha-surface-2 p-2.5">
                  <p className="text-caption text-ink-3">Recurring bills</p>
                  <p className="text-base font-bold text-ink tabular-nums">{autopilotHealth.recurringBillsPaidCount}/{autopilotHealth.recurringBillsCount}</p>
                </div>
                <div className="rounded-card bg-kosha-surface-2 p-2.5">
                  <p className="text-caption text-ink-3">Auto investments</p>
                  <p className="text-base font-bold text-brand tabular-nums">{autopilotHealth.autoRecurringInvestmentCount}/{autopilotHealth.recurringInvestmentCount}</p>
                </div>
                <div className="rounded-card bg-kosha-surface-2 p-2.5">
                  <p className="text-caption text-ink-3">Missed automations</p>
                  <p className={`text-base font-bold tabular-nums ${autopilotHealth.missedAutomations === 0 ? 'text-income-text' : 'text-warning-text'}`}>
                    {autopilotHealth.missedAutomations}
                  </p>
                </div>
              </div>

              {autopilotHealth.missedAutomations > 0 ? (
                <div className="space-y-2">
                  {autopilotHealth.overdueRecurringBills.length > 0 && (
                    <p className="text-[11px] text-warning-text">
                      {autopilotHealth.overdueRecurringBills.length} recurring bill{autopilotHealth.overdueRecurringBills.length > 1 ? 's are' : ' is'} overdue.
                    </p>
                  )}
                  {autopilotHealth.manualRecurringInvestments.length > 0 && (
                    <p className="text-[11px] text-warning-text">
                      {autopilotHealth.manualRecurringInvestments.length} recurring investment entr{autopilotHealth.manualRecurringInvestments.length > 1 ? 'ies were' : 'y was'} logged manually (automation missed).
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button type="button" onClick={() => navigate('/bills')} className="btn-secondary h-9 px-3 text-[11px] justify-center">
                      Fix bills
                    </button>
                    <button type="button" onClick={() => navigate('/transactions')} className="btn-primary h-9 px-3 text-[11px] justify-center">
                      Fix investments
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-ink-3">Autopilot routines are healthy. No broken recurring cycles detected this month.</p>
              )}
            </div>
          )}

          {heavyReady && (
            <div className="card p-4">
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
                  <div key={item.key} className="rounded-card border border-kosha-border bg-kosha-surface p-3">
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

          {heavyReady && catEntries.length > 0 && (
            <CategorySpendingChart
              entries={catEntries}
              total={categoryTotal}
              initialVisibleCount={4}
              collapseKey={`${year}-${month}`}
              budgets={budgets}
              month={month}
              year={year}
              subtitle={
                budgetCount > 0
                  ? `${budgetCount} budget${budgetCount > 1 ? 's' : ''} set · tap to edit`
                  : 'tap a row to set budget'
              }
              onCategoryClick={openBudgetSheet}
            />
          )}

          </>
          )}
        </motion.div>
      )}

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
