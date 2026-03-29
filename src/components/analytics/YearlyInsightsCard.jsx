import { Sparkle } from '@phosphor-icons/react'
import { CATEGORIES } from '../../lib/categories'
import { MONTH_SHORT } from '../../lib/constants'

export default function YearlyInsightsCard({ data, catEntries }) {
  if (!data?.monthly?.length && !(data?.totalIncome || data?.totalExpense)) return null

  const text = (() => {
    const parts = []
    const inc = data?.totalIncome || 0
    const rate = inc > 0 ? Math.round(((inc - (data?.totalExpense || 0)) / inc) * 100) : 0

    if (rate > 20) parts.push(`You've had a strong year, saving ${rate}% of your earnings.`)
    else if (rate > 0) parts.push(`You saved ${rate}% of your income.`)
    else parts.push('You spent more than you earned this year.')

    if (data?.monthly) {
      let maxExp = 0
      let maxIdx = -1
      data.monthly.forEach((m, i) => {
        if (m.expense > maxExp) {
          maxExp = m.expense
          maxIdx = i
        }
      })
      if (maxIdx >= 0 && maxExp > 0) parts.push(`${MONTH_SHORT[maxIdx]} was your highest spending month.`)
    }

    if (catEntries?.length > 0) {
      const c = CATEGORIES.find(cat => cat.id === catEntries[0][0])
      const pct = Math.round((catEntries[0][1] / Math.max(data?.totalExpense || 1, 1)) * 100)
      parts.push(`Your biggest expense was ${c ? c.label : catEntries[0][0]}, making up ${pct}% of all spending.`)
    }

    return parts.join(' ')
  })()

  return (
    <div className="rounded-card p-4 relative" style={{ background: 'rgba(75,0,130,0.06)', border: '1px solid rgba(75,0,130,0.10)' }}>
      <div className="flex items-center gap-2 mb-2 relative">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(75,0,130,0.12)' }}>
          <Sparkle size={12} className="text-brand" weight="fill" />
        </div>
        <h3 className="text-[13px] font-bold text-ink">Yearly Insights</h3>
      </div>
      <p className="text-[13px] leading-relaxed relative text-ink-2">{text}</p>
    </div>
  )
}
