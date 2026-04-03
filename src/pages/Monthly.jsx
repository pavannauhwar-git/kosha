import { useState, useMemo, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useMonthSummary, useTransactions, TRANSACTION_INSIGHTS_COLUMNS } from '../hooks/useTransactions'
import { useLiabilitiesByMonth } from '../hooks/useLiabilities'
import { useBudgets, budgetMap as buildBudgetMap } from '../hooks/useBudgets'
import { CATEGORIES } from '../lib/categories'
import { C } from '../lib/colors'
import CategorySpendingChart from '../components/categories/CategorySpendingChart'
import BudgetSheet from '../components/categories/BudgetSheet'
import { fmt } from '../lib/utils'
import { MONTH_NAMES } from '../lib/constants'
import PageHeader from '../components/layout/PageHeader'
import SkeletonLayout from '../components/common/SkeletonLayout'
import PickerNavigator from '../components/common/PickerNavigator'
import EmptyState from '../components/common/EmptyState'
import SectionHeader from '../components/common/SectionHeader'
import PortfolioMixDonut from '../components/common/PortfolioMixDonut'
import MonthHeroCard from '../components/cards/monthly/MonthHeroCard'
import BreakdownCard from '../components/cards/monthly/BreakdownCard'
import DailySpendTrend from '../components/cards/monthly/DailySpendTrend'
import MonthlySpendHeatmap from '../components/cards/monthly/MonthlySpendHeatmap'
import MerchantIntelCard from '../components/cards/monthly/MerchantIntelCard'
import MonthCloseChecklist from '../components/cards/monthly/MonthCloseChecklist'
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
    const timer = setTimeout(() => setHeavyReady(true), 90)
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
  const { budgets } = useBudgets({ enabled: heavyReady })
  const bMap = useMemo(() => buildBudgetMap(budgets), [budgets])
  const [showBudgetSheet, setShowBudgetSheet] = useState(false)
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

    const palette = [C.brand, C.invest, C.income, C.bills, C.brandMid, C.brandLight]
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

    const concentrationSignal = total <= 0
      ? 'No allocation yet. Add your first vehicle-tagged investment to start mix tracking.'
      : topPct >= 55
        ? `${top?.name || 'Top holding'} holds ${topPct}% share. Route upcoming top-ups to secondary vehicles.`
        : `Largest holding is ${topPct}%. Concentration is currently controlled.`

    const deploymentSignal = deployRate < 10
      ? `Deployment is ${deployRate}% of inflow. A small top-up can improve consistency.`
      : deployRate > 35
        ? `Deployment is ${deployRate}% of inflow. Protect monthly runway before increasing further.`
        : `Deployment at ${deployRate}% is within a balanced monthly range.`

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
      concentrationSignal,
      deploymentSignal,
      nextAction,
    }
  }, [vehicleEntries, inflow, invested])

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

          {heavyReady && txnRows.length > 0 && (
            <DailySpendTrend txnRows={txnRows} year={year} month={month} />
          )}

          {heavyReady && (monthlyPortfolioSnapshot.rows.length > 0 || invested > 0) && (
            <div className="card p-4 border-0">
              <SectionHeader
                className="mb-2"
                title="Portfolio snapshot"
                subtitle="Donut mix, concentration cues, and next rebalancing move"
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

              {monthlyPortfolioSnapshot.total > 0 ? (
                <div className="rounded-card border border-kosha-border bg-kosha-surface-2 p-3 mb-3">
                  <div className="grid md:grid-cols-[168px_1fr] gap-3 items-center">
                    <div className="flex justify-center md:justify-start">
                      <PortfolioMixDonut
                        rows={monthlyPortfolioSnapshot.mixRows}
                        centerTop="Monthly"
                        centerValue={fmt(monthlyPortfolioSnapshot.total, true)}
                        centerBottom={`${monthlyPortfolioSnapshot.rows.length} vehicles`}
                        ringSize={118}
                        innerInset={17}
                      />
                    </div>

                    <div className="space-y-2">
                      {monthlyPortfolioSnapshot.mixRows.map((row) => (
                        <div key={`monthly-allocation-row-${row.name}`} className="rounded-card border border-kosha-border bg-kosha-surface px-2.5 py-2">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: row.color }} />
                              <p className="text-[11px] text-ink-2 truncate">{row.name}</p>
                            </div>
                            <p className="text-[11px] tabular-nums text-ink shrink-0" title={fmt(row.value)}>{row.pct}% · {fmt(row.value, true)}</p>
                          </div>
                          <div className="h-1.5 rounded-pill bg-kosha-border overflow-hidden">
                            <div className="h-full rounded-pill" style={{ width: `${Math.max(5, row.pct)}%`, background: row.color }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-card border border-dashed border-kosha-border bg-kosha-surface-2 p-3 mb-3">
                  <p className="text-[11px] text-ink-3">No monthly portfolio allocation is tagged yet. Add vehicle labels to investment entries to unlock this view.</p>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-2 mb-3">
                <div className="rounded-card border border-kosha-border bg-kosha-surface-2 p-2.5">
                  <p className="text-[10px] text-ink-3 mb-1">Concentration signal · {monthlyPortfolioSnapshot.concentrationBand}</p>
                  <p className="text-[11px] text-ink-2 leading-relaxed">{monthlyPortfolioSnapshot.concentrationSignal}</p>
                </div>
                <div className="rounded-card border border-kosha-border bg-kosha-surface-2 p-2.5">
                  <p className="text-[10px] text-ink-3 mb-1">Deployment signal</p>
                  <p className="text-[11px] text-ink-2 leading-relaxed">{monthlyPortfolioSnapshot.deploymentSignal}</p>
                </div>
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

          {heavyReady && txnRows.length > 0 && (
            <MonthlySpendHeatmap txnRows={txnRows} year={year} month={month} />
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
              <button
                type="button"
                onClick={() => setShowBudgetSheet(true)}
                className="btn-secondary-sm text-[11px]"
              >
                Manage budgets
              </button>
            </div>
            </>
          )}

          {heavyReady && (
            <MonthCloseChecklist
              earned={inflow}
              spent={spent}
              pendingBills={pendingBills}
              paidBills={paidBills}
              reconcileQueueCount={reconcileQueueCount}
              txnRows={txnRows}
              year={year}
              month={month}
            />
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
    </div>
  )
}
