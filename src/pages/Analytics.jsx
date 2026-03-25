import { useState, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle } from 'lucide-react'
import { CashFlowChart, NetSavingsChart, ConfidenceTrendChart } from '../components/dashboard/AnalyticsCharts'
import { useYearSummary } from '../hooks/useTransactions'
import CategorySpendingChart from '../components/CategorySpendingChart'
import { fmt } from '../lib/utils'
import PageHeader from '../components/PageHeader'
import { MONTH_SHORT } from '../lib/constants'
import SkeletonLayout from '../components/common/SkeletonLayout'
import PickerNavigator from '../components/common/PickerNavigator'
import EmptyState from '../components/common/EmptyState'
import SectionHeader from '../components/common/SectionHeader'
import AnnualSummaryCard from '../components/analytics/AnnualSummaryCard'
import YoYCards from '../components/analytics/YoYCards'
import PortfolioAllocation from '../components/analytics/PortfolioAllocation'
import YearlyInsightsCard from '../components/analytics/YearlyInsightsCard'
import TopExpensesPodium from '../components/analytics/TopExpensesPodium'
import { useReconciliationReviews } from '../hooks/useReconciliationReviews'
import { detectConfidenceDrift, calculateConfidenceTrend } from '../lib/reconciliationMetrics'

const YEARS = Array.from({ length: new Date().getFullYear() - 2022 + 1 }, (_, i) => 2023 + i)

// ── Main page ─────────────────────────────────────────────────────────────
export default function Analytics() {
  const now = new Date()
  const currentYear = now.getFullYear()
  const [year, setYear] = useState(currentYear)
  const yearRef = useRef(null)

  const { data, loading } = useYearSummary(year)
  const { data: prevData } = useYearSummary(year - 1)
  const { rows: reconciliationRows } = useReconciliationReviews()

  const top5 = data?.top5 || []

  const chartData = useMemo(() => (data?.monthly || [])
    .map((m, i) => ({
      name: MONTH_SHORT[i],
      Income: Math.round(m.income),
      Spent: Math.round(m.expense),
    }))
    .filter(m => m.Income > 0 || m.Spent > 0), [data?.monthly])

  const netData = useMemo(() => (data?.monthly || [])
    .map((m, i) => ({
      name: MONTH_SHORT[i],
      Net: Math.round(m.income - m.expense - m.investment),
    }))
    .filter(m => m.Net !== 0), [data?.monthly])

  const netAxisMax = useMemo(() => {
    const maxAbs = netData.reduce((m, row) => Math.max(m, Math.abs(row.Net)), 0)
    return Math.max(1000, Math.ceil(maxAbs * 1.15))
  }, [netData])

  const yoyYears = useMemo(() => YEARS.filter(y => y <= currentYear), [currentYear])

  const catEntries = useMemo(() => Object.entries(data?.byCategory || {})
    .sort((a, b) => b[1] - a[1]).slice(0, 8), [data?.byCategory])
  const categoryTotal = useMemo(() => catEntries.reduce((s, [, v]) => s + v, 0) || 1, [catEntries])

  const vehicleData = useMemo(
    () => Object.entries(data?.byVehicle || {}).sort((a, b) => b[1] - a[1]),
    [data?.byVehicle]
  )

  const spendTrend = useMemo(() => {
    const recentMonths = (data?.monthly || []).filter(m => m.expense > 0)
    const lastTwo = recentMonths.slice(-2)
    return lastTwo.length === 2
      ? { current: lastTwo[1].expense, previous: lastTwo[0].expense }
      : null
  }, [data?.monthly])

  const reconciliationStats = useMemo(() => {
    const rows = reconciliationRows || []
    const linked = rows.filter((row) => row.status === 'linked').length
    const rejected = rows.filter((row) => String(row.statement_line || '').startsWith('REJECTED:')).length
    const reviewed = rows.filter((row) => row.status === 'reviewed').length

    const now = Date.now()
    const recentWindowMs = 7 * 24 * 60 * 60 * 1000
    const recentRows = rows.filter((row) => {
      const ts = new Date(row.updated_at || 0).getTime()
      return Number.isFinite(ts) && now - ts <= recentWindowMs
    })
    const recentLinked = recentRows.filter((row) => row.status === 'linked').length
    const recentRejected = recentRows.filter((row) => String(row.statement_line || '').startsWith('REJECTED:')).length
    const netConfidence = recentLinked + recentRejected > 0
      ? Math.round((recentLinked / (recentLinked + recentRejected)) * 100)
      : null

    const drift = detectConfidenceDrift(rows)

    return {
      linked,
      rejected,
      reviewed,
      recentLinked,
      recentRejected,
      netConfidence,
      drift,
    }
  }, [reconciliationRows])

  const confidenceTrend = useMemo(
    () => calculateConfidenceTrend(reconciliationRows, 30),
    [reconciliationRows]
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

    if (catEntries.length > 0) {
      const [topCat, topValue] = catEntries[0]
      const concentrationPct = Math.round((Number(topValue || 0) / categoryTotal) * 100)
      if (concentrationPct >= 35) {
        items.push(`${topCat} contributes ${concentrationPct}% of expense concentration. Add a monthly cap and monitor variance.`)
      }
    }

    if (reconciliationStats.netConfidence != null && reconciliationStats.netConfidence < 70) {
      items.push(`Reconciliation confidence is ${reconciliationStats.netConfidence}%. Run a cleanup pass to improve dashboard trust.`)
    }

    return items.slice(0, 3)
  }, [data, catEntries, categoryTotal, reconciliationStats.netConfidence])

  return (
    <div className="page">
      <PageHeader title="Analytics" />

      {/* ── Year navigator ────────────────────────────────────────────── */}
      <PickerNavigator
        label={year}
        onPrev={() => setYear(y => y - 1)}
        onNext={() => setYear(y => y + 1)}
        pickerRef={yearRef}
        inputType="month"
        inputValue={`${year}-01`}
        onInputChange={e => {
          const y = parseInt(e.target.value?.split('-')[0], 10)
          if (y) setYear(y)
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
          {/* ── 1. Annual Summary card ───────────────────────────────── */}
          <AnnualSummaryCard
            data={data}
            prevData={prevData}
            spendTrend={spendTrend}
            year={year}
          />

          {/* ── 2. Cash Flow chart ──────────────────────────────────── */}
          <CashFlowChart
            chartData={chartData}
            totalIncome={data?.totalIncome}
          />

          <YearlyInsightsCard data={data} catEntries={catEntries} />

          {/* ── 3. Net Savings ──────────────────────────────────────── */}
          <NetSavingsChart
            netData={netData}
            netAxisMax={netAxisMax}
          />

          {/* ── 4. Year-over-year stacked cards ─────────────────────── */}
          <YoYCards years={yoyYears} currentYear={year} />

          <motion.div
            whileHover={{ y: -1 }}
            transition={{ duration: 0.14 }}
            className="card p-4"
          >
            <SectionHeader
              className="mb-3"
              title="Reconciliation confidence"
              rightText="Last 7 days signal"
            />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
              <StatMini label="Linked" value={reconciliationStats.linked} tone="text-income-text" />
              <StatMini label="Mismatch reports" value={reconciliationStats.rejected} tone="text-expense-text" />
              <StatMini label="Recent linked" value={reconciliationStats.recentLinked} tone="text-brand" />
              <StatMini
                label="Confidence"
                value={reconciliationStats.netConfidence == null ? '—' : `${reconciliationStats.netConfidence}%`}
                tone={reconciliationStats.netConfidence != null && reconciliationStats.netConfidence >= 70 ? 'text-income-text' : 'text-warning-text'}
              />
            </div>

            {reconciliationStats.drift?.drifting && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -1 }}
                className="rounded-card border border-warning-border bg-warning-bg p-2.5 flex items-start gap-2"
              >
                <AlertCircle size={14} className="text-warning-text shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-warning-text">Confidence below baseline</p>
                  <p className="text-[10px] text-ink-3 mt-0.5">
                    7d: {reconciliationStats.drift.recent.confidence}% vs 30d: {reconciliationStats.drift.baseline.confidence}%
                  </p>
                </div>
              </motion.div>
            )}
          </motion.div>

          <ConfidenceTrendChart trendData={confidenceTrend} />

          {strategicRecommendations.length > 0 && (
            <motion.div whileHover={{ y: -1 }} transition={{ duration: 0.14 }} className="card p-4">
              <SectionHeader
                className="mb-2"
                title="So what now?"
                rightText="Actionable next steps"
              />
              <div className="space-y-2">
                {strategicRecommendations.map((line) => (
                  <p key={line} className="text-[12px] text-ink-2 leading-relaxed">
                    - {line}
                  </p>
                ))}
              </div>
            </motion.div>
          )}

          <TopExpensesPodium top5={top5} year={year} />

          {/* ── 6. Portfolio allocation ──────────────────────────────── */}
          {vehicleData.length > 0 && (
            <PortfolioAllocation vehicleData={vehicleData} />
          )}

          {/* ── 7. Spending by Category ──────────────────────────────── */}
          {catEntries.length > 0 && (
            <CategorySpendingChart
              entries={catEntries}
              total={categoryTotal}
            />
          )}

          {!data?.totalIncome && !data?.totalExpense && (
            <EmptyState
              title={`No data for ${year}`}
              description="Pick a different year or add transactions to unlock yearly analytics and trends."
              actionLabel="Go to current year"
              onAction={() => {
                const now = new Date()
                setYear(now.getFullYear())
              }}
            />
          )}

        </motion.div>
      )}
    </div>
  )
}

function StatMini({ label, value, tone = 'text-ink' }) {
  return (
    <div className="rounded-card border border-kosha-border bg-kosha-surface p-2.5">
      <p className="text-caption text-ink-3">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${tone}`}>{value}</p>
    </div>
  )
}
