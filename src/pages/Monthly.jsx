import { useState, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMonthSummary } from '../hooks/useTransactions'
import { useBudgets } from '../hooks/useBudgets'
import CategorySpendingChart from '../components/CategorySpendingChart'
import { fmt } from '../lib/utils'
import { MONTH_NAMES } from '../lib/constants'
import PageHeader from '../components/PageHeader'
import SkeletonLayout from '../components/common/SkeletonLayout'
import PickerNavigator from '../components/common/PickerNavigator'
import BudgetSheet from '../components/monthly/BudgetSheet'
import MonthHeroCard from '../components/monthly/MonthHeroCard'
import BreakdownCard from '../components/monthly/BreakdownCard'

export default function Monthly() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const monthRef = useRef(null)

  const { data, loading } = useMonthSummary(year, month)
  const { budgets, setBudget, removeBudget } = useBudgets()

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
          className="space-y-6"
        >
          <BreakdownCard earned={earned} spent={spent} invested={invested} />

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
