import { Sparkle } from '@phosphor-icons/react'
import { CATEGORIES } from '../../../lib/categories'
import { MONTH_SHORT } from '../../../lib/constants'
import { C } from '../../../lib/colors'

export default function YearlyInsightsCard({ data, catEntries }) {
  if (!data?.monthly?.length && !(data?.totalIncome || data?.totalExpense)) return null

  const text = (() => {
    const parts = []
    const inc = data?.totalIncome || 0
    const totalOutflow = (data?.totalExpense || 0) + (data?.totalInvestment || 0)
    const rate = inc > 0 ? Math.round(((inc - totalOutflow) / inc) * 100) : 0

    if (rate > 20) parts.push(`You converted ${rate}% of earnings into yearly surplus after spending and investments.`)
    else if (rate > 0) parts.push(`Your yearly surplus was ${rate}% of income after spending and investments.`)
    else parts.push('Outflow was higher than income this year after including investments.')

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
    <div
      className="card p-4 overflow-hidden relative"
      style={{
        background: C.brandContainer,
        border: `1px solid ${C.brandBorder}`,
      }}
    >
      <div className="flex items-center gap-2 mb-2 relative">
        <div className="w-6 h-6 rounded-lg bg-brand flex items-center justify-center shrink-0">
          <Sparkle size={12} className="text-white" weight="fill" />
        </div>
        <h3 className="text-[13px] font-bold text-ink">Year in plain words</h3>
      </div>
      <p className="text-[13px] text-ink-2 leading-relaxed relative">{text}</p>
    </div>
  )
}
