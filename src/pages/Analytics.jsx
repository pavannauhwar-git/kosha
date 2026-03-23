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

const YEARS = Array.from({ length: new Date().getFullYear() - 2022 + 1 }, (_, i) => 2023 + i)

// ── Main page ─────────────────────────────────────────────────────────────
export default function Analytics() {
  const now = new Date()
  const currentYear = now.getFullYear()
  const [year, setYear] = useState(currentYear)
  const yearRef = useRef(null)

  const { data, loading } = useYearSummary(year)
  const { data: prevData } = useYearSummary(year - 1)

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
