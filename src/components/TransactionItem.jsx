import { useState, useRef } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { Trash } from '@phosphor-icons/react'
import CategoryIcon from './CategoryIcon'
import { fmt, amountClass, amountPrefix, fmtDate } from '../lib/utils'
import { getCategory } from '../lib/categories'
import { ChevronRight } from 'lucide-react'

const SWIPE_THRESHOLD  = 80
const DELETE_THRESHOLD = 160

export default function TransactionItem({ txn, onDelete, onTap, showDate = false, isLast = false }) {
  const x             = useMotionValue(0)
  const deleteOpacity = useTransform(x, [-DELETE_THRESHOLD, -SWIPE_THRESHOLD, 0], [1, 1, 0])
  const [deleting, setDeleting] = useState(false)

  const cat    = getCategory(txn.category)
  const amtCls = amountClass(txn.type, txn.is_repayment)
  const prefix = amountPrefix(txn.type)

  async function handleDragEnd(_, info) {
    if (info.offset.x < -DELETE_THRESHOLD) {
      await animate(x, -500, { duration: 0.22 })
      setDeleting(true)
      onDelete && onDelete(txn.id)
    } else if (info.offset.x < -SWIPE_THRESHOLD / 2) {
      animate(x, -SWIPE_THRESHOLD, { type: 'spring', stiffness: 400, damping: 30 })
    } else {
      animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 })
    }
  }

  function handleDeleteTap() {
    setDeleting(true)
    animate(x, -500, { duration: 0.2 })
    setTimeout(() => onDelete && onDelete(txn.id), 200)
  }

  function handleTap() {
    if (x.get() < -10) {
      animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 })
      return
    }
    onTap && onTap(txn)
  }

  if (deleting) return null

  return (
    <div className="relative overflow-hidden bg-kosha-surface">
      {/* Delete zone */}
      <motion.div
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-expense px-6"
        style={{ opacity: deleteOpacity }}
      >
        <button onClick={handleDeleteTap} className="flex flex-col items-center gap-1">
          <Trash size={18} color="white" weight="bold" />
          <span className="text-white text-[10px] font-semibold">Delete</span>
        </button>
      </motion.div>

      {/* Row */}
      <motion.div
        className="list-row"
        style={{ x }}
        drag="x"
        dragConstraints={{ left: -DELETE_THRESHOLD * 1.2, right: 0 }}
        dragElastic={{ left: 0.15, right: 0.05 }}
        onDragEnd={handleDragEnd}
        onClick={handleTap}
      >
        <CategoryIcon categoryId={txn.category} size={18} />

        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-medium text-ink truncate leading-snug">
            {txn.description}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[13px] text-ink-3">{cat.label}</span>
            {showDate && (
              <span className="text-[13px] text-ink-4">· {fmtDate(txn.date)}</span>
            )}
            {txn.is_repayment && (
              <span className="text-[11px] px-1.5 py-0.5 rounded-pill bg-repay-bg text-repay-text font-medium">
                Repayment
              </span>
            )}
          </div>
        </div>

        <span className={`text-[15px] shrink-0 tabular-nums ${amtCls}`}>
          {prefix}{fmt(txn.amount)}
        </span>
      </motion.div>

      {/* Hairline separator — hidden on last item */}
      {!isLast && (
        <div className="absolute bottom-0 left-[64px] right-0 h-[0.5px] bg-kosha-border" />
      )}
    </div>
  )
}
