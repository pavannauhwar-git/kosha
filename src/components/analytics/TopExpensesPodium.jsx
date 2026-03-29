import CategoryIcon from '../CategoryIcon'
import { fmt, fmtDate } from '../../lib/utils'
import { C } from '../../lib/colors'

export default function TopExpensesPodium({ top5, year }) {
  if (!top5?.length) return null

  const top3 = top5.slice(0, 3)
  const PODIUM = [
    { rank: 2, platformH: 56, grad: `linear-gradient(170deg,${C.brandContainer},${C.brandLight})`, rankColor: C.brand },
    { rank: 1, platformH: 80, grad: `linear-gradient(170deg,${C.brandLight},${C.brand})`, rankColor: '#FFFFFF' },
    { rank: 3, platformH: 40, grad: `linear-gradient(170deg,#F7F5FF,${C.brandBorder})`, rankColor: C.brandMid },
  ]
  const slots = PODIUM.map(p => ({ ...p, item: top3[p.rank - 1] })).filter(p => p.item)

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="section-label">Top Expenses {year}</p>
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
      </div>
    </div>
  )
}
