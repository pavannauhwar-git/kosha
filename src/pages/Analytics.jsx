import { useState, useMemo, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CashFlowChart, NetSavingsChart } from '../components/dashboard/AnalyticsCharts'
import { useTransactionYearBounds, useYearSummary } from '../hooks/useTransactions'
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

// ── Main page ─────────────────────────────────────────────────────────────
export default function Analytics() {
  const now = new Date()
  const currentYear = now.getFullYear()
  const [year, setYear] = useState(currentYear)
  const yearRef = useRef(null)
  const [heavyReady, setHeavyReady] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setHeavyReady(true), 260)
    return () => clearTimeout(timer)
  }, [])

  const { data: yearBounds } = useTransactionYearBounds()

  const minYear = useMemo(() => {
    const fromData = Number(yearBounds?.minYear)
    if (Number.isFinite(fromData) && fromData > 0) return fromData
    return Math.max(2020, currentYear - 3)
  }, [yearBounds?.minYear, currentYear])

  const maxYear = useMemo(() => {
    const fromData = Number(yearBounds?.maxYear)
    if (Number.isFinite(fromData) && fromData > 0) return Math.max(currentYear, fromData)
    return currentYear
  }, [yearBounds?.maxYear, currentYear])

  const availableYears = useMemo(() => {
    if (maxYear < minYear) return [currentYear]
    return Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i)
  }, [minYear, maxYear, currentYear])

  useEffect(() => {
    setYear((y) => {
      if (y < minYear) return minYear
      if (y > maxYear) return maxYear
      return y
    })
  }, [minYear, maxYear])

  const { data, loading } = useYearSummary(year)
  const { data: prevData } = useYearSummary(year - 1, { enabled: heavyReady })

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

  const yoyYears = useMemo(() => availableYears.filter((y) => y <= currentYear), [availableYears, currentYear])

  const catEntries = useMemo(() => Object.entries(data?.byCategory || {})
    .sort((a, b) => b[1] - a[1]).slice(0, 8), [data?.byCategory])
  const categoryTotal = useMemo(() => catEntries.reduce((s, [, v]) => s + v, 0) || 1, [catEntries])

  const vehicleData = useMemo(
    () => Object.entries(data?.byVehicle || {}).sort((a, b) => b[1] - a[1]),
    [data?.byVehicle]
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

    return items.slice(0, 3)
  }, [data, catEntries, categoryTotal])

  return (
    <div className="page">
      <PageHeader title="Analytics" className="mb-2" />

      {/* ── Year navigator ────────────────────────────────────────────── */}
      <PickerNavigator
        className="mb-4"
        label={year}
        onPrev={() => setYear((y) => Math.max(minYear, y - 1))}
        onNext={() => setYear((y) => Math.min(maxYear, y + 1))}
        pickerRef={yearRef}
        inputType="month"
        inputValue={`${year}-01`}
        onInputChange={e => {
          const y = parseInt(e.target.value?.split('-')[0], 10)
          if (!y) return
          setYear(Math.min(maxYear, Math.max(minYear, y)))
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
          {/* ── 1. Hero summary ──────────────────────────────────────── */}
          <AnnualSummaryCard
            data={data}
            prevData={prevData}
            year={year}
          />

          {strategicRecommendations.length > 0 && (
            <motion.div whileHover={{ y: -1 }} transition={{ duration: 0.14 }} className="card p-4">
              <SectionHeader
                className="mb-1"
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

          <YearlyInsightsCard data={data} catEntries={catEntries} />

          {/* ── 2. Performance trends ───────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4">
            <CashFlowChart
              chartData={chartData}
              totalIncome={data?.totalIncome}
            />

            <NetSavingsChart
              netData={netData}
              netAxisMax={netAxisMax}
            />
          </div>

          {/* ── 3. Spending intelligence ────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4">
            {catEntries.length > 0 ? (
              <CategorySpendingChart
                entries={catEntries}
                total={categoryTotal}
              />
            ) : (
              <div className="card p-4">
                <p className="section-label">Spent by Category</p>
                <p className="text-[12px] text-ink-3 mt-1">No spending categories yet for this year.</p>
              </div>
            )}
            <TopExpensesPodium top5={top5} year={year} />
          </div>

          {/* ── 4. Allocation and year comparison ───────────────────── */}
          <div className="grid grid-cols-1 gap-4">
            {vehicleData.length > 0 ? (
              <PortfolioAllocation vehicleData={vehicleData} />
            ) : (
              <div className="card p-4">
                <p className="section-label">Portfolio allocation</p>
                <p className="text-[12px] text-ink-3 mt-1">Add investments to unlock allocation breakdown.</p>
              </div>
            )}
            <YoYCards years={yoyYears} currentYear={year} />
          </div>

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

