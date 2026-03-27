import { memo, useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fmt } from '../../lib/utils'

const DashboardPulseStrip = memo(function DashboardPulseStrip({
  todaySpend,
  totalBillsAmt,
  insight,
}) {
  const navigate = useNavigate()
  const scrollRef = useRef(null)
  const [fadeRight, setFadeRight] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const check = () => setFadeRight(el.scrollWidth > el.clientWidth + el.scrollLeft + 2)
    check()
    el.addEventListener('scroll', check, { passive: true })
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', check)
      ro.disconnect()
    }
  }, [])

  return (
    <div className="relative">
      <div ref={scrollRef} className="overflow-x-auto -mx-4 px-4">
      <div className="flex gap-2 w-max pr-4">
        {/* Today */}
        <div className="shrink-0 flex flex-col gap-1 px-3 py-2.5 rounded-2xl
                        bg-kosha-surface border border-kosha-border">
          <p className="text-micro font-semibold text-ink-4 uppercase tracking-wider">
            Today
          </p>
          <p className={`text-caption font-bold tabular-nums leading-none ${
            todaySpend > 0 ? 'text-expense-text' : 'text-income-text'
          }`}>
            {todaySpend > 0 ? fmt(todaySpend, true) : 'All clear 🌿'}
          </p>
        </div>

        {/* Bills due — only if any pending */}
        {totalBillsAmt > 0 && (
          <button
            onClick={() => navigate('/bills')}
            className="shrink-0 flex flex-col gap-1 px-3 py-2.5 rounded-2xl
                       bg-repay-bg border border-repay-border text-left
                       active:opacity-75 transition-opacity"
          >
            <p className="text-micro font-semibold text-repay-text uppercase tracking-wider">
              Bills due
            </p>
            <p className="text-caption font-bold text-repay-text tabular-nums leading-none">
              {fmt(totalBillsAmt, true)}
            </p>
          </button>
        )}

        {/* Contextual insight */}
        <div className="shrink-0 min-w-[140px] max-w-[220px] flex flex-col gap-1 px-3 py-2.5 rounded-2xl
                        bg-kosha-surface-2 border border-kosha-border">
          <p className="text-micro font-semibold text-ink-4 uppercase tracking-wider">
            Insight
          </p>
          <p className="text-caption font-medium text-ink leading-snug">{insight}</p>
          </div>
        </div>
      </div>
      {fadeRight && (
        <div className="absolute top-0 right-0 bottom-0 w-6 pointer-events-none bg-gradient-to-l from-kosha-bg to-transparent" />
      )}
    </div>
  )
})

export default DashboardPulseStrip
