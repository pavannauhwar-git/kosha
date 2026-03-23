import { useMemo } from 'react'
import { queryClient } from '../../lib/queryClient'
import { fmt } from '../../lib/utils'

export default function YoYCards({ years, currentYear }) {
  const yearsWithData = useMemo(() => {
    return years.filter(y => {
      const cached = queryClient.getQueryData(['year', y])
      return cached && (cached.totalIncome > 0 || cached.totalExpense > 0)
    })
  }, [years])

  if (yearsWithData.length < 2) return null

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="section-label">Year over Year</p>
      </div>
      <div className="overflow-x-auto no-scrollbar -mx-4 px-4 mt-3">
        <div className="flex gap-3 pb-1 pr-4" style={{ minWidth: 'max-content' }}>
          {yearsWithData.map((y, idx) => {
            const d = queryClient.getQueryData(['year', y])
            const prev = queryClient.getQueryData(['year', yearsWithData[idx - 1]])
            const isCurrent = y === currentYear

            if (!d) return null

            function delta(curr, prv) {
              if (!prv || prv === 0) return null
              return Math.round(((curr - prv) / prv) * 100)
            }

            const income = d.totalIncome || 0
            const spent = d.totalExpense || 0
            const invest = d.totalInvestment || 0
            const rate = income > 0 ? Math.round(((income - spent) / income) * 100) : 0

            return (
              <div key={y} className={`card p-4 w-[155px] shrink-0 ${isCurrent ? 'border-brand' : ''}`} style={isCurrent ? { borderWidth: '1.5px' } : {}}>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-label font-bold ${isCurrent ? 'text-ink' : 'text-ink-3'}`}>{y}</span>
                  {isCurrent && (
                    <span className="text-[9px] font-bold bg-brand-container text-brand-on px-1.5 py-0.5 rounded-full">Now</span>
                  )}
                </div>

                <div className="space-y-2.5">
                  {[
                    { label: 'Earned', val: income, prevVal: prev?.totalIncome, cls: isCurrent ? 'text-income-text' : 'text-ink-2' },
                    { label: 'Spent', val: spent, prevVal: prev?.totalExpense, cls: isCurrent ? 'text-expense-text' : 'text-ink-2' },
                    { label: 'Invested', val: invest, prevVal: prev?.totalInvestment, cls: isCurrent ? 'text-invest-text' : 'text-ink-2' },
                    { label: 'Leftover', val: rate, prevVal: null, cls: isCurrent ? 'text-repay-text' : 'text-ink-2', suffix: '%' },
                  ].map(row => {
                    const d2 = row.prevVal != null ? delta(row.val, row.prevVal) : null
                    return (
                      <div key={row.label}>
                        <p className="text-[10px] text-ink-3 mb-0.5">{row.label}</p>
                        <div className="flex items-baseline gap-1">
                          <p className={`text-[12px] font-bold tabular-nums ${row.cls}`}>
                            {row.suffix ? `${row.val}%` : fmt(row.val, true)}
                          </p>
                          {d2 !== null && Math.abs(d2) >= 3 && (
                            <span className={`text-[9px] font-bold ${d2 > 0 ? 'text-income-text' : 'text-expense-text'}`}>
                              {d2 > 0 ? '↑' : '↓'}{Math.abs(d2)}%
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
