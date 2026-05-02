import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { CaretRight, Warning } from '@phosphor-icons/react'
import { motion } from 'framer-motion'
import PageHeaderPage from '../components/layout/PageHeaderPage'
import { useLiabilities } from '../hooks/useLiabilities'
import { useLoans } from '../hooks/useLoans'
import { fmt, daysUntil } from '../lib/utils'
import { createFadeUp, createStagger } from '../lib/animations'
import Button from '../components/ui/Button'

const fadeUp = createFadeUp(12, 0.4)
const stagger = createStagger(0.06, 0.04)

function safeDays(dateValue) {
  if (!dateValue) return null
  try {
    const d = daysUntil(dateValue)
    return Number.isFinite(d) ? d : null
  } catch { return null }
}

export default function Obligations() {
  const navigate = useNavigate()

  const { pending, loading: billsLoading } = useLiabilities({ includePaid: false })
  const { given, taken, loading: loansLoading } = useLoans()

  // ── Bills metrics ─────────────────────────────────────────────────────
  const { totalPending, overdueCount, dueSoonCount, recurringCount, billsUrgent, billsAllClear } = useMemo(() => {
    let totalPending = 0
    let overdueCount = 0
    let dueSoonCount = 0
    let recurringCount = 0

    for (let i = 0; i < pending.length; i++) {
      const b = pending[i]
      totalPending += Number(b.amount || 0)
      if (b.is_recurring) recurringCount++
      const d = safeDays(b.due_date)
      if (d !== null) {
        if (d < 0) overdueCount++
        else if (d <= 7) dueSoonCount++
      }
    }

    const billsUrgent = overdueCount > 0
    const billsAllClear = pending.length > 0 && overdueCount === 0 && dueSoonCount === 0

    return { totalPending, overdueCount, dueSoonCount, recurringCount, billsUrgent, billsAllClear }
  }, [pending])

  // ── Loans metrics ─────────────────────────────────────────────────────
  const { totalGiven, totalTaken } = useMemo(() => {
    let totalGiven = 0
    for (let i = 0; i < given.length; i++) {
      totalGiven += (Number(given[i].amount) - Number(given[i].amount_settled))
    }
    
    let totalTaken = 0
    for (let i = 0; i < taken.length; i++) {
      totalTaken += (Number(taken[i].amount) - Number(taken[i].amount_settled))
    }

    return { totalGiven, totalTaken }
  }, [given, taken])

  const isLoading = billsLoading || loansLoading
  const allEmpty = !isLoading && pending.length === 0 && given.length === 0 && taken.length === 0

  function go(path) {
    import('../lib/haptics').then(m => m.hapticTap())
    navigate(path)
  }

  return (
    <PageHeaderPage title="Obligations">
      <motion.div
        layout
        variants={stagger}
        initial="hidden"
        animate="show"
        className="page-stack"
      >

        {/* ── All-empty hero state ───────────────────────────────────── */}
        {allEmpty && (
          <motion.div variants={fadeUp} className="card p-6 flex flex-col items-center text-center">
            <img
              src="/illustrations/coffee_chill.png"
              alt="No obligations"
              className="w-52 h-auto illustration mb-4"
            />
            <p className="text-[19px] font-bold text-ink tracking-tight mb-1">You're all clear</p>
            <p className="text-[13px] text-ink-3 leading-relaxed max-w-[260px] mb-5">
              No pending bills or active loans. Add obligations to track what you owe and what's owed to you.
            </p>
            <div className="flex gap-2 flex-wrap justify-center">
              <Button variant="primary" size="sm" onClick={() => go('/bills')}>
                Add a bill
              </Button>
              <Button variant="secondary" size="sm" onClick={() => go('/loans')}>
                Log a loan
              </Button>
            </div>
          </motion.div>
        )}

        {/* ── Bills card ─────────────────────────────────────────────── */}
        {!allEmpty && (
          <motion.div variants={fadeUp}>
            <button
              type="button"
              onClick={() => go('/bills')}
              className="card w-full text-left p-0 overflow-hidden active:scale-[0.985] transition-transform duration-150 will-change-transform"
              aria-label="Open Bills & Dues"
            >
              {/* Header with illustration */}
              <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 pt-1">
                  <p className="section-label mb-1.5">Bills &amp; Dues</p>
                  {billsLoading ? (
                    <div className="h-5 w-28 rounded-card shimmer opacity-70" />
                  ) : pending.length > 0 ? (
                    <p className={`text-[20px] font-bold tabular-nums leading-tight tracking-tight ${billsUrgent ? 'text-expense-text' : 'text-ink'}`}>
                      {fmt(totalPending)}
                    </p>
                  ) : (
                    <p className="text-[15px] font-semibold text-ink-2">No pending bills</p>
                  )}
                </div>
                <img
                  src="/illustrations/coffee_chill.png"
                  alt="Bills"
                  className="w-20 h-auto illustration shrink-0 -mt-1"
                />
              </div>

              {/* Stats — only when bills exist */}
              {!billsLoading && pending.length > 0 && (
                <div className="px-4 pb-4">
                  <div className="grid grid-cols-3 gap-2 mb-2.5">
                    <div className="mini-panel px-2.5 py-2">
                      <p className="text-[10px] text-ink-3 uppercase tracking-wide mb-1">Overdue</p>
                      <p className={`text-label font-semibold tabular-nums ${overdueCount > 0 ? 'text-expense-text' : 'text-ink-3'}`}>
                        {overdueCount}
                      </p>
                    </div>
                    <div className="mini-panel px-2.5 py-2">
                      <p className="text-[10px] text-ink-3 uppercase tracking-wide mb-1">Due soon</p>
                      <p className={`text-label font-semibold tabular-nums ${dueSoonCount > 0 ? 'text-warning-text' : 'text-ink-3'}`}>
                        {dueSoonCount}
                      </p>
                    </div>
                    <div className="mini-panel px-2.5 py-2">
                      <p className="text-[10px] text-ink-3 uppercase tracking-wide mb-1">Recurring</p>
                      <p className="text-label font-semibold tabular-nums text-ink">
                        {recurringCount}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {overdueCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-expense-bg text-expense-text border border-expense-border px-2 py-0.5 rounded-pill">
                        <Warning size={11} weight="fill" />
                        {overdueCount} overdue
                      </span>
                    )}
                    {dueSoonCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-warning-bg text-warning-text border border-warning-border px-2 py-0.5 rounded-pill">
                        {dueSoonCount} due this week
                      </span>
                    )}
                    {(!billsLoading && billsAllClear) && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-income-bg text-income-text border border-income-border px-2 py-0.5 rounded-pill">
                        All on schedule
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Empty hint */}
              {!billsLoading && pending.length === 0 && (
                <div className="px-4 pb-4">
                  <p className="text-caption text-ink-3">
                    Add bills to track due dates and cashflow.
                  </p>
                </div>
              )}

              {/* Footer row */}
              <div className="px-4 py-2.5 border-t border-kosha-border flex items-center justify-between bg-kosha-surface-2">
                {!billsLoading && (
                  <span className="text-caption font-semibold text-ink-3">
                    {pending.length} bill{pending.length !== 1 ? 's' : ''} pending
                  </span>
                )}
                <CaretRight size={15} className="text-ink-4 ml-auto" />
              </div>
            </button>
          </motion.div>
        )}

        {/* ── Loans card ─────────────────────────────────────────────── */}
        {!allEmpty && (
          <motion.div variants={fadeUp}>
            <button
              type="button"
              onClick={() => go('/loans')}
              className="card w-full text-left p-0 overflow-hidden active:scale-[0.985] transition-transform duration-150 will-change-transform"
              aria-label="Open Loans"
            >
              {/* Header with illustration */}
              <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0 pt-1">
                  <p className="section-label mb-1.5">Loans</p>
                  {loansLoading ? (
                    <div className="h-5 w-24 rounded-card shimmer opacity-70" />
                  ) : (given.length + taken.length) > 0 ? (
                    totalGiven >= totalTaken ? (
                      <p className="text-[20px] font-bold amt-income tabular-nums leading-tight tracking-tight">
                        {fmt(totalGiven)}
                        <span className="text-caption text-ink-3 font-normal ml-1.5">owed to you</span>
                      </p>
                    ) : (
                      <p className="text-[20px] font-bold amt-expense tabular-nums leading-tight tracking-tight">
                        {fmt(totalTaken)}
                        <span className="text-caption text-ink-3 font-normal ml-1.5">you owe</span>
                      </p>
                    )
                  ) : (
                    <p className="text-[15px] font-semibold text-ink-2">No active loans</p>
                  )}
                </div>
                <img
                  src="/illustrations/empty_loans.png"
                  alt="Loans"
                  className="w-20 h-auto illustration shrink-0 -mt-1"
                />
              </div>

              {/* Mini-panel grid */}
              {!loansLoading && (given.length > 0 || taken.length > 0) && (
                <div className="px-4 pb-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="mini-panel px-2.5 py-2">
                      <p className="text-caption text-ink-3 mb-1">You&apos;re owed</p>
                      <p className="text-label font-semibold amt-income tabular-nums">{fmt(totalGiven)}</p>
                      <p className="text-caption text-ink-3 mt-0.5">{given.length} loan{given.length !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="mini-panel px-2.5 py-2">
                      <p className="text-caption text-ink-3 mb-1">You owe</p>
                      <p className="text-label font-semibold amt-expense tabular-nums">{fmt(totalTaken)}</p>
                      <p className="text-caption text-ink-3 mt-0.5">{taken.length} loan{taken.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Empty hint */}
              {!loansLoading && given.length === 0 && taken.length === 0 && (
                <div className="px-4 pb-4">
                  <p className="text-caption text-ink-3">
                    Log money lent or borrowed to track repayments.
                  </p>
                </div>
              )}

              {/* Footer row */}
              <div className="px-4 py-2.5 border-t border-kosha-border flex items-center justify-between bg-kosha-surface-2">
                {!loansLoading && (
                  <span className="text-caption font-semibold text-ink-3">
                    {given.length + taken.length} active loan{(given.length + taken.length) !== 1 ? 's' : ''}
                  </span>
                )}
                <CaretRight size={15} className="text-ink-4 ml-auto" />
              </div>
            </button>
          </motion.div>
        )}

      </motion.div>
    </PageHeaderPage>
  )
}
