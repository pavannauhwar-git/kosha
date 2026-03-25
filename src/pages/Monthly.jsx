import { useState, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRightLeft } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useMonthSummary } from '../hooks/useTransactions'
import { useTransactions } from '../hooks/useTransactions'
import { useBudgets } from '../hooks/useBudgets'
import CategorySpendingChart from '../components/CategorySpendingChart'
import { fmt } from '../lib/utils'
import { MONTH_NAMES } from '../lib/constants'
import { CATEGORIES } from '../lib/categories'
import PageHeader from '../components/PageHeader'
import SkeletonLayout from '../components/common/SkeletonLayout'
import PickerNavigator from '../components/common/PickerNavigator'
import BudgetSheet from '../components/monthly/BudgetSheet'
import MonthHeroCard from '../components/monthly/MonthHeroCard'
import BreakdownCard from '../components/monthly/BreakdownCard'
import { buildReconciliationInsights, getReviewedReconciliationIds } from '../lib/reconciliation'
import { useReconciliationReviews } from '../hooks/useReconciliationReviews'

export default function Monthly() {
  const navigate = useNavigate()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const monthRef = useRef(null)

  const { data, loading } = useMonthSummary(year, month)
  const { data: txnRows = [] } = useTransactions({ limit: 250 })
  const { budgets, setBudget, removeBudget } = useBudgets()
  const { reviewedIdSet: serverReviewedIds, unavailable: reviewTableUnavailable } = useReconciliationReviews()

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
  const spent = data?.expense || 0
  const invested = data?.investment || 0

  const catEntries = useMemo(
    () => Object.entries(data?.byCategory || {}).sort((a, b) => b[1] - a[1]).slice(0, 8),
    [data?.byCategory]
  )
  const categoryTotal = useMemo(
    () => catEntries.reduce((s, [, v]) => s + v, 0) || 1,
    [catEntries]
  )
  const vehicleEntries = useMemo(
    () => Object.entries(data?.byVehicle || {}).sort((a, b) => b[1] - a[1]),
    [data?.byVehicle]
  )
  const budgetCount = useMemo(
    () => catEntries.filter(([id]) => budgets[id]).length,
    [catEntries, budgets]
  )

  const budgetVariance = useMemo(() => {
    const rows = catEntries
      .map(([id, spent]) => ({
        id,
        spent: Number(spent || 0),
        budget: Number(budgets[id] || 0),
      }))
      .filter((row) => row.budget > 0)

    if (!rows.length) {
      return {
        hasBudgets: false,
        totalBudget: 0,
        totalSpent: 0,
        projectedSpend: 0,
        projectedDelta: 0,
        overCount: 0,
        nearLimitCount: 0,
        onTrackCount: 0,
        rows: [],
      }
    }

    const today = new Date()
    const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1
    const daysInMonth = new Date(year, month, 0).getDate()
    const daysElapsed = isCurrentMonth ? Math.min(today.getDate(), daysInMonth) : daysInMonth

    const totalBudget = rows.reduce((sum, row) => sum + row.budget, 0)
    const totalSpent = rows.reduce((sum, row) => sum + row.spent, 0)
    const projectedSpend = daysElapsed > 0
      ? (isCurrentMonth ? (totalSpent / daysElapsed) * daysInMonth : totalSpent)
      : totalSpent

    const enrichedRows = rows
      .map((row) => {
        const ratio = row.budget > 0 ? row.spent / row.budget : 0
        const cat = CATEGORIES.find((item) => item.id === row.id)
        return {
          ...row,
          label: cat?.label || row.id,
          ratio,
          delta: row.budget - row.spent,
        }
      })
      .sort((a, b) => a.delta - b.delta)

    const overCount = enrichedRows.filter((row) => row.ratio > 1).length
    const nearLimitCount = enrichedRows.filter((row) => row.ratio <= 1 && row.ratio >= 0.9).length

    return {
      hasBudgets: true,
      totalBudget,
      totalSpent,
      projectedSpend,
      projectedDelta: totalBudget - projectedSpend,
      overCount,
      nearLimitCount,
      onTrackCount: Math.max(0, enrichedRows.length - overCount - nearLimitCount),
      rows: enrichedRows,
    }
  }, [catEntries, budgets, year, month])

  const monthCloseSummary = useMemo(() => {
    const totalOutflow = spent + invested
    const net = earned - totalOutflow

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
    const projectedOutflow = isCurrentMonth
      ? (daysElapsed > 0 ? (totalOutflow / daysElapsed) * daysInMonth : totalOutflow)
      : totalOutflow
    const projectedNet = earned - projectedOutflow

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
        message = `Closed the month with positive cash flow of +${fmt(Math.abs(net))}. Income was ${fmt(earned)} against outflow of ${fmt(totalOutflow)}.`
      } else if (net < 0) {
        statusLabel = 'Closed negative'
        message = `Closed the month with negative cash flow of -${fmt(Math.abs(net))}. Outflow exceeded income by ${fmt(Math.abs(net))}.`
      } else {
        statusLabel = 'Closed breakeven'
        message = `Closed the month at breakeven. Income and outflow both settled at ${fmt(earned)}.`
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
      totalOutflow,
      net,
      daysLeft,
      health,
      statusLabel,
      timelineLabel,
      timelineValue,
      message,
    }
  }, [earned, spent, invested, year, month])

  const openBudgetSheet = useCallback((cat) => setBudgetCat(cat), [])

  return (
    <div className="page">
      <PageHeader title="Monthly" />

      <PickerNavigator
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

      <div className="mb-6">
        <MonthHeroCard month={month} year={year} data={data} />
      </div>

      <button
        type="button"
        onClick={() => navigate('/reconciliation')}
        className="card p-4 mb-6 w-full text-left"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink">Reconciliation workspace</p>
            <p className="text-caption text-ink-3 mt-0.5">
              {reconcileQueueCount > 0
                ? `${reconcileQueueCount} item${reconcileQueueCount > 1 ? 's' : ''} ready for quality review`
                : 'No pending review items right now'}
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-brand-container text-brand flex items-center justify-center shrink-0">
            <ArrowRightLeft size={18} />
          </div>
        </div>
      </button>

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
          <BreakdownCard earned={earned} spent={spent} invested={invested} />

          <div className="card p-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
              <div>
                <p className="section-label">Month close summary</p>
                <p className="text-caption text-ink-3 mt-0.5">Outcome projection and runway</p>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-semibold self-start ${monthCloseSummary.health === 'healthy' ? 'bg-income-bg text-income-text' : 'bg-warning-bg text-warning-text'}`}>
                {monthCloseSummary.statusLabel}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-3">
              <div className="rounded-card bg-kosha-surface p-3 border border-kosha-border">
                <p className="text-caption text-ink-3">Net close</p>
                <p className={`text-sm font-bold tabular-nums ${monthCloseSummary.net >= 0 ? 'text-income-text' : 'text-expense-text'}`}>
                  {monthCloseSummary.net >= 0 ? '+' : '-'}{fmt(Math.abs(monthCloseSummary.net))}
                </p>
              </div>
              <div className="rounded-card bg-kosha-surface p-3 border border-kosha-border">
                <p className="text-caption text-ink-3">Outflow</p>
                <p className="text-sm font-bold tabular-nums text-ink-2">{fmt(monthCloseSummary.totalOutflow)}</p>
              </div>
              <div className="rounded-card bg-kosha-surface p-3 border border-kosha-border">
                <p className="text-caption text-ink-3">{monthCloseSummary.timelineLabel}</p>
                <p className="text-sm font-bold tabular-nums text-ink-2">{monthCloseSummary.timelineValue}</p>
              </div>
            </div>

            <p className="text-[11px] text-ink-3">{monthCloseSummary.message}</p>
          </div>

          {budgetVariance.hasBudgets && (
            <div className="card p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <p className="section-label">Budget variance</p>
                  <p className="text-caption text-ink-3 mt-0.5">
                    {budgetVariance.projectedDelta >= 0
                      ? `${fmt(Math.abs(budgetVariance.projectedDelta))} projected buffer`
                      : `${fmt(Math.abs(budgetVariance.projectedDelta))} projected overshoot`}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-semibold ${budgetVariance.projectedDelta >= 0 ? 'bg-income-bg text-income-text' : 'bg-expense-bg text-expense-text'}`}>
                  {budgetVariance.projectedDelta >= 0 ? 'On trajectory' : 'Needs correction'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-3">
                <div className="rounded-card bg-kosha-surface p-2.5 border border-kosha-border">
                  <p className="text-caption text-ink-3">Over budget</p>
                  <p className="text-lg font-bold text-expense-text tabular-nums">{budgetVariance.overCount}</p>
                </div>
                <div className="rounded-card bg-kosha-surface p-2.5 border border-kosha-border">
                  <p className="text-caption text-ink-3">Near limit</p>
                  <p className="text-lg font-bold text-warning-text tabular-nums">{budgetVariance.nearLimitCount}</p>
                </div>
                <div className="rounded-card bg-kosha-surface p-2.5 border border-kosha-border">
                  <p className="text-caption text-ink-3">On track</p>
                  <p className="text-lg font-bold text-income-text tabular-nums">{budgetVariance.onTrackCount}</p>
                </div>
              </div>

              <div className="space-y-2">
                {budgetVariance.rows.slice(0, 4).map((row) => (
                  <div key={row.id} className="flex items-center justify-between rounded-card border border-kosha-border bg-kosha-surface p-2.5">
                    <p className="text-sm text-ink-2 truncate pr-3">{row.label}</p>
                    <p className={`text-sm font-semibold tabular-nums ${row.delta >= 0 ? 'text-income-text' : 'text-expense-text'}`}>
                      {row.delta >= 0 ? `${fmt(row.delta)} left` : `${fmt(Math.abs(row.delta))} over`}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {catEntries.length > 0 && (
            <CategorySpendingChart
              entries={catEntries}
              total={categoryTotal}
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

          {earned === 0 && spent === 0 && invested === 0 && (
            <div className="card p-8 text-center">
              <p className="text-body text-ink-2">No data for this month.</p>
              <p className="text-label text-ink-3 mt-1">Navigate to a month with transactions.</p>
            </div>
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
