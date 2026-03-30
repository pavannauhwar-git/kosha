import { memo } from 'react'
import CategoryIcon from '../categories/CategoryIcon'
import { fmt, fmtDate } from '../../lib/utils'
import { C } from '../../lib/colors'

const DESKTOP_PODIUM_ORDER = [4, 2, 1, 3, 5]

const PODIUM_META = {
  1: {
    platformH: 92,
    bg: C.brand,
    rankColor: '#FFFFFF',
  },
  2: {
    platformH: 78,
    bg: C.brandLight,
    rankColor: C.brand,
  },
  3: {
    platformH: 64,
    bg: C.brandBorder,
    rankColor: C.brandMid,
  },
  4: {
    platformH: 54,
    bg: '#EAF4FF',
    rankColor: C.brand,
  },
  5: {
    platformH: 46,
    bg: '#F2F8FF',
    rankColor: C.brand,
  },
}

const TopExpensesPodium = memo(function TopExpensesPodium({ top5, year }) {
  if (!top5?.length) return null

  const rankedItems = top5.slice(0, 5)
  const totalTopSpend = rankedItems.reduce((sum, item) => sum + Number(item?.amount || 0), 0)
  const maxAmount = Math.max(...rankedItems.map((item) => Number(item?.amount || 0)), 1)

  const desktopSlots = DESKTOP_PODIUM_ORDER
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

      <div className="card mt-3 p-3 overflow-hidden">
        <div className="md:hidden space-y-2">
          {rankedItems.map((item, idx) => {
            const rank = idx + 1
            const amount = Number(item?.amount || 0)
            const width = Math.max(14, Math.round((amount / maxAmount) * 100))
            const rankTone = rank <= 2 ? 'bg-brand-container text-brand-on' : 'bg-kosha-surface-2 text-ink-3'
            return (
              <div key={`${rank}-${item.description}-${item.date}`} className="rounded-card border border-kosha-border bg-kosha-surface px-2.5 py-2.5">
                <div className="flex items-center gap-2.5">
                  <span className={`w-7 h-7 rounded-pill text-[11px] font-bold flex items-center justify-center shrink-0 ${rankTone}`}>
                    #{rank}
                  </span>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ background: 'rgba(10,103,216,0.16)' }}>
                    <CategoryIcon categoryId={item.category} size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-ink truncate">{item.description}</p>
                    <p className="text-[10px] text-ink-3 mt-0.5">{fmtDate(item.date)}</p>
                  </div>
                  <span className="text-[12px] font-bold text-expense-text tabular-nums shrink-0">{fmt(amount)}</span>
                </div>
                <div className="mt-2 h-1.5 rounded-pill bg-brand-container/45 overflow-hidden">
                  <div className="h-full rounded-pill bg-brand" style={{ width: `${width}%` }} />
                </div>
              </div>
            )
          })}
        </div>

        <div className="hidden md:flex items-end justify-center gap-2.5 pt-2">
          {desktopSlots.map(({ rank, platformH, bg, rankColor, item }) => (
            <div key={rank} className="flex flex-col items-center w-[120px]">
              <div className="w-full rounded-card border border-kosha-border bg-kosha-surface-2 px-2 py-2.5 mb-1.5">
                <div className="w-7 h-7 rounded-full mx-auto flex items-center justify-center" style={{ background: 'rgba(10,103,216,0.16)' }}>
                  <CategoryIcon categoryId={item.category} size={14} />
                </div>
                <p className="text-[11px] font-medium text-ink text-center mt-1.5 leading-tight line-clamp-2 min-h-[30px]">{item.description}</p>
                <p className="text-[13px] font-bold text-expense-text tabular-nums text-center mt-1">{fmt(item.amount)}</p>
                <p className="text-[10px] text-ink-3 text-center mt-0.5">{fmtDate(item.date)}</p>
              </div>

              <div className="w-full rounded-t-xl flex items-center justify-center" style={{ height: platformH, background: bg }}>
                <span className="text-[13px] font-extrabold" style={{ color: rankColor }}>#{rank}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
})

export default TopExpensesPodium
