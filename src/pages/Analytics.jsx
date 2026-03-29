import { CATEGORIES } from '../lib/categories'
import { useState, useMemo, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CashFlowChart, NetSavingsChart } from '../components/dashboard/AnalyticsCharts'
import { useYearSummary } from '../hooks/useTransactions'
import CategorySpendingChart from '../components/CategorySpendingChart'
import { fmt } from '../lib/utils'
import PageHeader from '../components/PageHeader'
import { MONTH_SHORT } from '../lib/constants'
import { useNavigate } from 'react-router-dom'
import SkeletonLayout from '../components/common/SkeletonLayout'
import PickerNavigator from '../components/common/PickerNavigator'
import EmptyState from '../components/common/EmptyState'
import SectionHeader from '../components/common/SectionHeader'
import AnnualSummaryCard from '../components/analytics/AnnualSummaryCard'
import YoYCards from '../components/analytics/YoYCards'
import PortfolioAllocation from '../components/analytics/PortfolioAllocation'
import YearlyInsightsCard from '../components/analytics/YearlyInsightsCard'
import TopExpensesPodium from '../components/analytics/TopExpensesPodium'

const MIN_NAV_YEAR = 1900
const MAX_NAV_YEAR = 2100

function toFiniteNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function Analytics() {
  const navigate = useNavigate()
  const now = new Date()
  const currentYear = now.getFullYear()
  const [year, setYear] = useState(currentYear)
  const [yoyRange, setYoyRange] = useState(5)
  const yearRef = useRef(null)
  const [heavyReady, setHeavyReady] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setHeavyReady(true), 260)
    return () => clearTimeout(timer)
  }, [])

  const { data, loading } = useYearSummary(year)
  const { data: prevData } = useYearSummary(year - 1, { enabled: heavyReady })

  const top5 = data?.top5 || []

  const chartData = useMemo(() => (data?.monthly || [])
    .map((m, i) => ({
      name: MONTH_SHORT[i],
      Income: Math.round(toFiniteNumber(m?.income)),
      Spent: Math.round(toFiniteNumber(m?.expense)),
    })), [data?.monthly])

  const netData = useMemo(() => (data?.monthly || [])
    .map((m, i) => ({
      name: MONTH_SHORT[i],
      Net: Math.round(toFiniteNumber(m?.income) - toFiniteNumber(m?.expense) - toFiniteNumber(m?.investment)),
    })), [data?.monthly])

  const netAxisMax = useMemo(() => {
    const maxAbs = netData.reduce((m, row) => Math.max(m, Math.abs(row.Net)), 0)
    return Math.max(1000, Math.ceil(maxAbs * 1.15))
  }, [netData])

  const yoyYears = useMemo(() => {
    return Array.from({ length: yoyRange }, (_, i) => year - (yoyRange - 1) + i)
      .filter((y) => y >= MIN_NAV_YEAR && y <= MAX_NAV_YEAR)
  }, [year, yoyRange])

  const catEntries = useMemo(() => Object.entries(data?.byCategory || {})
    .map(([key, value]) => [key, toFiniteNumber(value)])
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8), [data?.byCategory])
  const categoryTotal = useMemo(() => catEntries.reduce((s, [, v]) => s + v, 0) || 1, [catEntries])

  const vehicleData = useMemo(
    () => Object.entries(data?.byVehicle || {})
      .map(([key, value]) => [key, toFiniteNumber(value)])
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1]),
    [data?.byVehicle]
  )
  const vehicleTotal = useMemo(
    () => vehicleData.reduce((sum, [, value]) => sum + (Number(value) || 0), 0),
    [vehicleData]
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
          const catLabel = CATEGORIES.find(c => c.id === topCat)?.label || topCat
          items.push(`${catLabel} contributes ${concentrationPct}% of expense concentration. Add a monthly cap and monitor variance.`)
        }
      }

    return items.slice(0, 3)
  }, [data, catEntries, categoryTotal])

  const hasYearData = useMemo(() => {
    return (
      Number(data?.totalIncome || 0) > 0 ||
      Number(data?.totalExpense || 0) > 0 ||
      Number(data?.totalInvestment || 0) > 0 ||
      catEntries.length > 0 ||
      top5.length > 0 ||
      vehicleData.length > 0
    )
  }, [
    data?.totalIncome,
    data?.totalExpense,
    data?.totalInvestment,
    catEntries.length,
    top5.length,
    vehicleData.length,
  ])

  return (
    <div className="page">
      <PageHeader title="Analytics" className="mb-1" />

      {/* ── Year navigator ────────────────────────────────────────────── */}
      <PickerNavigator
        className="mb-3"
        label={year}
        onPrev={() => setYear((y) => Math.max(MIN_NAV_YEAR, y - 1))}
        onNext={() => setYear((y) => Math.min(MAX_NAV_YEAR, y + 1))}
        pickerRef={yearRef}
        inputType="month"
        inputValue={`${year}-01`}
        onInputChange={e => {
          const y = parseInt(e.target.value?.split('-')[0], 10)
          if (!y) return
          setYear(Math.min(MAX_NAV_YEAR, Math.max(MIN_NAV_YEAR, y)))
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
          {hasYearData ? (
            <>
              {/* ── 1. Hero summary ──────────────────────────────────────── */}
              <AnnualSummaryCard
                data={data}
                prevData={prevData}
                year={year}
              />

              {/* ── 2. Insights + Recommendations ────────────────────────── */}
              {data ? <YearlyInsightsCard data={data} catEntries={catEntries} /> : null}

              {strategicRecommendations.length > 0 && (
                <div className="card p-4 relative overflow-hidden"
                  style={{
                    background: 'radial-gradient(ellipse at 90% 10%, rgba(251,191,36,0.10) 0%, transparent 55%), radial-gradient(ellipse at 10% 90%, rgba(139,92,246,0.08) 0%, transparent 55%), #ffffff',
                  }}
                >
                  <SectionHeader
                    className="mb-2"
                    title="So what now?"
                    rightText="Actionable next steps"
                  />
                  <div className="space-y-2">
                    {strategicRecommendations.map((line) => (
                      <p key={line} className="text-[12px] text-ink-2 leading-relaxed">
                        → {line}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* ── 3. Performance trends ─────────────────────────────── */}
              <div>
                <p className="section-label mb-2 px-0.5">Performance</p>
                <div className="space-y-4">
                  <CashFlowChart
                    chartData={chartData}
                    totalIncome={data?.totalIncome}
                  />
                  <NetSavingsChart
                    netData={netData}
                    netAxisMax={netAxisMax}
                  />
                </div>
              </div>

              {/* ── 4. Spending intelligence ─────────────────────────── */}
              <div>
                <p className="section-label mb-2 px-0.5">Spending Intelligence</p>
                <div className="space-y-4">
                  {catEntries.length > 0 ? (
                    <CategorySpendingChart
                      entries={catEntries}
                      total={categoryTotal}
                    />
                  ) : (
                    <div className="card p-4">
                      <p className="text-[12px] text-ink-3">No spending categories yet for this year.</p>
                    </div>
                  )}
                  {top5.length > 0 ? (
                    <TopExpensesPodium top5={top5} year={year} />
                  ) : (
                    <div className="card p-4">
                      <p className="text-[12px] text-ink-3">No high-spend transactions found for this year yet.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── 5. Allocation and year comparison ─────────────────── */}
              <div>
                <p className="section-label mb-2 px-0.5">Portfolio & Trends</p>
                <div className="space-y-4">
                  {vehicleData.length > 0 && vehicleTotal > 0 ? (
                    <PortfolioAllocation vehicleData={vehicleData} />
                  ) : (
                    <div className="card p-4">
                      <p className="text-[12px] text-ink-3">Add investments to unlock allocation breakdown.</p>
                    </div>
                  )}
                  {heavyReady ? (
                    <YoYCards years={yoyYears} currentYear={year} enabled rangeYears={yoyRange} onRangeChange={setYoyRange} />
                  ) : (
                    <div className="card p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="section-label">Year over year trends</p>
                        <span className="text-caption text-ink-3">Preparing</span>
                      </div>
                      <p className="text-[12px] text-ink-3">Preparing comparison data...</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <EmptyState
              title={`No data for ${year}`}
              description="This year is empty right now. Add transactions to unlock yearly trends, category intelligence, and YoY comparisons."
              actionLabel={year === currentYear ? 'Add transaction' : 'Go to current year'}
              onAction={() => {
                if (year === currentYear) {
                  navigate('/transactions')
                  return
                }
                setYear(currentYear)
              }}
              secondaryLabel={year === currentYear ? undefined : 'Add transaction'}
              onSecondaryAction={year === currentYear ? undefined : () => navigate('/transactions')}
            />
          )}

        </motion.div>
      )}
    </div>
  )
}

