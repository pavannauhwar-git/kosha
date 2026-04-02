import { memo, useMemo } from 'react'
import { CheckCircle2, XCircle } from 'lucide-react'

export default memo(function MonthCloseChecklist({
  earned,
  spent,
  pendingBills,
  paidBills,
  reconcileQueueCount,
  txnRows,
  year,
  month,
}) {
  const checks = useMemo(() => {
    const now = new Date()
    const isPastMonth = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1

    // 1. Income verified — at least one income transaction exists
    const hasIncome = earned > 0
    const incomeCheck = {
      key: 'income',
      label: 'Income entry verified',
      description: hasIncome ? 'At least one income transaction logged' : 'No income recorded yet — add salary or other income',
      ok: hasIncome,
    }

    // 2. All bills resolved — no pending overdue bills for this month
    const overdueBills = (pendingBills || []).filter((b) => {
      const d = new Date(`${b.due_date}T00:00:00`)
      return !isNaN(d.getTime()) && d < now
    })
    const allBillsResolved = overdueBills.length === 0
    const billCheck = {
      key: 'bills',
      label: 'Bills resolved',
      description: allBillsResolved
        ? `${(paidBills || []).length} paid, none overdue`
        : `${overdueBills.length} overdue bill${overdueBills.length > 1 ? 's' : ''} need attention`,
      ok: allBillsResolved,
    }

    // 3. No uncategorized expenses
    const uncategorized = (txnRows || []).filter(
      (r) => r.type === 'expense' && (!r.category || r.category === 'other')
    )
    const allCategorized = uncategorized.length === 0
    const categoryCheck = {
      key: 'categories',
      label: 'Expenses categorized',
      description: allCategorized
        ? 'All expense transactions have a category'
        : `${uncategorized.length} expense${uncategorized.length > 1 ? 's' : ''} still tagged "other"`,
      ok: allCategorized,
    }

    // 4. Reconciliation queue clear
    const queueClear = (reconcileQueueCount || 0) === 0
    const reconCheck = {
      key: 'recon',
      label: 'Reconciliation queue clear',
      description: queueClear
        ? 'No transactions pending review'
        : `${reconcileQueueCount} transaction${reconcileQueueCount > 1 ? 's' : ''} in reconciliation queue`,
      ok: queueClear,
    }

    const items = [incomeCheck, billCheck, categoryCheck, reconCheck]
    const passCount = items.filter((c) => c.ok).length
    const allPassed = passCount === items.length

    return {
      items,
      passCount,
      total: items.length,
      allPassed,
      isPastMonth,
      isCurrentMonth,
    }
  }, [earned, spent, pendingBills, paidBills, reconcileQueueCount, txnRows, year, month])

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div>
          <p className="text-label font-semibold text-ink">Month close checklist</p>
          <p className="text-[11px] text-ink-3 mt-0.5">Data quality gates — green means you can trust the numbers.</p>
        </div>
        <span className={`text-[11px] px-2 py-1 rounded-pill font-semibold ${
          checks.allPassed
            ? 'bg-income-bg text-income-text'
            : checks.passCount >= 3
              ? 'bg-warning-bg text-warning-text'
              : 'bg-expense-bg text-expense-text'
        }`}>
          {checks.passCount}/{checks.total} passed
        </span>
      </div>

      <div className="space-y-2">
        {checks.items.map((check) => (
          <div
            key={check.key}
            className={`rounded-card border p-2.5 flex items-start gap-2.5 ${
              check.ok
                ? 'border-income-border bg-income-bg/30'
                : 'border-warning-border bg-warning-bg/30'
            }`}
          >
            {check.ok ? (
              <CheckCircle2 size={16} className="text-income-text shrink-0 mt-0.5" />
            ) : (
              <XCircle size={16} className="text-warning-text shrink-0 mt-0.5" />
            )}
            <div className="min-w-0">
              <p className={`text-[12px] font-semibold ${check.ok ? 'text-income-text' : 'text-warning-text'}`}>
                {check.label}
              </p>
              <p className="text-[10px] text-ink-3 mt-0.5">{check.description}</p>
            </div>
          </div>
        ))}
      </div>

      {checks.allPassed && (
        <div className="mt-2.5 rounded-card border border-income-border bg-income-bg/40 p-2.5 text-center">
          <p className="text-[12px] font-semibold text-income-text">
            {checks.isPastMonth ? 'Month verified ✓' : 'All checks passing — month data is reliable ✓'}
          </p>
        </div>
      )}

      {!checks.allPassed && (
        <p className="text-[11px] text-ink-3 mt-2">
          Resolve open items to ensure analytics and close summaries reflect accurate data.
        </p>
      )}
    </div>
  )
})
