import CategoryIcon from '../categories/CategoryIcon'
import { fmt, fmtDate } from '../../lib/utils'
import { C } from '../../lib/colors'

export default function TopExpensesPodium({ top5, year }) {
  if (!top5?.length) return null

  const rankedItems = top5.slice(0, 5)
  const top3 = rankedItems.slice(0, 3)
  const tail = rankedItems.slice(3)
  const totalTopSpend = rankedItems.reduce((sum, item) => sum + Number(item?.amount || 0), 0)

  const PODIUM = [
    { rank: 2, platformH: 56, grad: `linear-gradient(170deg,${C.brandContainer},${C.brandLight})`, rankColor: C.brand },
    { rank: 1, platformH: 80, grad: `linear-gradient(170deg,${C.brandLight},${C.brand})`, rankColor: '#FFFFFF' },
    { rank: 3, platformH: 40, grad: `linear-gradient(170deg,#F7F5FF,${C.brandBorder})`, rankColor: C.brandMid },
  ]

  const slots = PODIUM.map(p => ({ ...p, item: top3[p.rank - 1] })).filter(p => p.item)

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="section-label">Top {rankedItems.length} Expenses {year}</p>
        <span className="text-[11px] font-semibold text-expense-text tabular-nums">{fmt(totalTopSpend)}</span>
      </div>

      <div className="card mt-3 overflow-hidden">
        <div className="flex items-end gap-1.5 px-3 pt-5">
          {slots.map(({ rank, platformH, grad, rankColor, item }) => (
            <div key={rank} className="flex flex-col flex-1 items-center min-w-0">
              <div className="w-full flex flex-col items-center pb-3 px-0.5">
                <CategoryIcon categoryId={item.category} size={14} />
                <p className="text-[11px] font-medium text-ink text-center mt-1.5 leading-tight line-clamp-2">{item.description}</p>
                <p className="text-[13px] font-bold text-expense-text tabular-nums mt-1">{fmt(item.amount)}</p>
                <p className="text-[10px] text-ink-3 mt-0.5">{fmtDate(item.date)}</p>
              </div>
              <div className="w-full rounded-t-xl flex items-center justify-center" style={{ height: platformH, background: grad }}>
                <span className="text-[13px] font-extrabold" style={{ color: rankColor }}>#{rank}</span>
              </div>
            </div>
          ))}
        </div>

        {tail.length > 0 && (
          <div className="mt-1 border-t border-kosha-border px-3 py-2.5 space-y-1.5">
            {tail.map((item, idx) => {
              const rank = idx + 4
              return (
                <div key={`${rank}-${item.description}-${item.date}`} className="flex items-center gap-2.5 rounded-card bg-kosha-surface-2 px-2.5 py-2">
                  <span className="text-[11px] font-bold text-ink-3 w-6 shrink-0">#{rank}</span>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(184,196,255,0.35)' }}>
                    <CategoryIcon categoryId={item.category} size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-ink truncate">{item.description}</p>
                    <p className="text-[10px] text-ink-3">{fmtDate(item.date)}</p>
                  </div>
                  <span className="text-[12px] font-bold text-expense-text tabular-nums shrink-0">{fmt(item.amount)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
