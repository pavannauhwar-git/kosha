import { useState, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import { CashFlowChart, NetSavingsChart } from '../components/dashboard/AnalyticsCharts'
import { useYearSummary } from '../hooks/useTransactions'
import CategorySpendingChart from '../components/CategorySpendingChart'
import { fmt } from '../lib/utils'
import PageHeader from '../components/PageHeader'
import { MONTH_SHORT } from '../lib/constants'
import SkeletonLayout from '../components/common/SkeletonLayout'
import PickerNavigator from '../components/common/PickerNavigator'
import AnnualSummaryCard from '../components/analytics/AnnualSummaryCard'
import YoYCards from '../components/analytics/YoYCards'
import PortfolioAllocation from '../components/analytics/PortfolioAllocation'
import YearlyInsightsCard from '../components/analytics/YearlyInsightsCard'
import TopExpensesPodium from '../components/analytics/TopExpensesPodium'
import { useReconciliationReviews } from '../hooks/useReconciliationReviews'

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

    return {
      linked,
      rejected,
      reviewed,
      recentLinked,
      recentRejected,
      netConfidence,
    }
  }, [reconciliationRows])

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
          className="space-y-6"
        >

          <YearlyInsightsCard data={data} catEntries={catEntries} />

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

          {/* ── 3. Net Savings ──────────────────────────────────────── */}
          <NetSavingsChart
            netData={netData}
            netAxisMax={netAxisMax}
          />

          {/* ── 4. Year-over-year stacked cards ─────────────────────── */}
          <YoYCards years={yoyYears} currentYear={year} />

          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="section-label">Reconciliation confidence</p>
              <span className="text-caption text-ink-4">Last 7 days signal</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <StatMini label="Linked" value={reconciliationStats.linked} tone="text-income-text" />
              <StatMini label="Mismatch reports" value={reconciliationStats.rejected} tone="text-expense-text" />
              <StatMini label="Recent linked" value={reconciliationStats.recentLinked} tone="text-brand" />
              <StatMini
                label="Confidence"
                value={reconciliationStats.netConfidence == null ? '—' : `${reconciliationStats.netConfidence}%`}
                tone={reconciliationStats.netConfidence != null && reconciliationStats.netConfidence >= 70 ? 'text-income-text' : 'text-warning-text'}
              />
            </div>
          </div>

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
            <div className="card p-8 text-center">
              <p className="text-body text-ink-3">No data for {year}.</p>
            </div>
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
