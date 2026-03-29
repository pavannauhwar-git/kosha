import CategoryIcon from '../categories/CategoryIcon'
import { fmt, fmtDate } from '../../lib/utils'
import { C } from '../../lib/colors'

const PODIUM_ORDER = [4, 2, 1, 3, 5]

const PODIUM_META = {
  1: {
    platformH: 94,
    grad: `linear-gradient(170deg,${C.brandLight},${C.brand})`,
    rankColor: '#FFFFFF',
  },
  2: {
    platformH: 80,
    grad: `linear-gradient(170deg,${C.brandContainer},${C.brandLight})`,
    rankColor: C.brand,
  },
  3: {
    platformH: 68,
    grad: `linear-gradient(170deg,#F7F5FF,${C.brandBorder})`,
    rankColor: C.brandMid,
  },
  4: {
    platformH: 56,
    grad: `linear-gradient(170deg,#F8FAFF,#DCE5FF)`,
    rankColor: C.brand,
  },
  5: {
    platformH: 48,
    grad: `linear-gradient(170deg,#F9FBFF,#E7EDFF)`,
    rankColor: C.brand,
  },
}

export default function TopExpensesPodium({ top5, year }) {
  if (!top5?.length) return null

  const rankedItems = top5.slice(0, 5)
  const totalTopSpend = rankedItems.reduce((sum, item) => sum + Number(item?.amount || 0), 0)
  const slots = PODIUM_ORDER
    .map((rank) => {
      const item = rankedItems[rank - 1]
      if (!item) return null
      return {
        rank,
        item,
        ...PODIUM_META[rank],
      }
    })
    .filter(Boolean)

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="section-label">Top {rankedItems.length} Expenses {year}</p>
        <span className="text-[11px] font-semibold text-expense-text tabular-nums">{fmt(totalTopSpend)}</span>
      </div>

      <div className="card mt-3 overflow-hidden">
        <div className="overflow-x-auto no-scrollbar pb-1">
          <div className="min-w-[620px] sm:min-w-0 flex items-end justify-center gap-2 px-3 pt-4">
            {slots.map(({ rank, platformH, grad, rankColor, item }) => (
              <div key={rank} className="flex flex-col items-center w-[116px] shrink-0">
                <div className="w-full rounded-card border border-kosha-border bg-kosha-surface-2 px-2 py-2.5 mb-1.5">
                  <div className="w-7 h-7 rounded-full mx-auto flex items-center justify-center" style={{ background: 'rgba(184,196,255,0.35)' }}>
                    <CategoryIcon categoryId={item.category} size={14} />
                  </div>
                  <p className="text-[11px] font-medium text-ink text-center mt-1.5 leading-tight line-clamp-2 min-h-[30px]">{item.description}</p>
                  <p className="text-[13px] font-bold text-expense-text tabular-nums text-center mt-1">{fmt(item.amount)}</p>
                  <p className="text-[10px] text-ink-3 text-center mt-0.5">{fmtDate(item.date)}</p>
                </div>

                <div className="w-full rounded-t-xl flex items-center justify-center" style={{ height: platformH, background: grad }}>
                  <span className="text-[13px] font-extrabold" style={{ color: rankColor }}>#{rank}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
