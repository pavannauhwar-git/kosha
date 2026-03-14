import { useState, useRef } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { Trash } from '@phosphor-icons/react'
import CategoryIcon from './CategoryIcon'
import { fmt, amountClass, amountPrefix, stripClass, fmtDate } from '../lib/utils'
import { getCategory } from '../lib/categories'

const SWIPE_THRESHOLD = 80  // px to reveal delete
const DELETE_THRESHOLD = 160 // px to auto-delete

export default function TransactionItem({ txn, onDelete, onTap, showDate = false }) {
  const x            = useMotionValue(0)
  const deleteOpacity= useTransform(x, [-DELETE_THRESHOLD, -SWIPE_THRESHOLD, 0], [1, 1, 0])
  const deleteScale  = useTransform(x, [-DELETE_THRESHOLD, -SWIPE_THRESHOLD], [1, 0.85])
  const [deleting, setDeleting] = useState(false)

  const cat      = getCategory(txn.category)
  const stripCls = stripClass(txn.type, txn.is_repayment)
  const amtCls   = amountClass(txn.type, txn.is_repayment)
  const prefix   = amountPrefix(txn.type)

  async function handleDragEnd(_, info) {
    if (info.offset.x < -DELETE_THRESHOLD) {
      // Auto-trigger delete
      await animate(x, -500, { duration: 0.25 })
      setDeleting(true)
      onDelete && onDelete(txn.id)
    } else if (info.offset.x < -SWIPE_THRESHOLD / 2) {
      // Snap to reveal zone
      animate(x, -SWIPE_THRESHOLD, { type: 'spring', stiffness: 400, damping: 30 })
    } else {
      // Snap back
      animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 })
    }
  }

  function handleDeleteTap() {
    setDeleting(true)
    animate(x, -500, { duration: 0.2 })
    setTimeout(() => onDelete && onDelete(txn.id), 200)
  }

  function handleTap() {
    // Reset swipe first
    if (x.get() < -10) {
      animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 })
      return
    }
    onTap && onTap(txn)
  }

  if (deleting) return null

  return (
    <div className="relative overflow-hidden">
      {/* Delete zone behind the row */}
      <motion.div
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-expense px-5 rounded-card"
        style={{ opacity: deleteOpacity, scaleX: deleteScale, transformOrigin: 'right' }}
      >
        <button onClick={handleDeleteTap} className="flex flex-col items-center gap-1">
          <Trash size={20} color="white" weight="bold" />
          <span className="text-white text-[10px] font-semibold">Delete</span>
        </button>
      </motion.div>

      {/* Swipeable row */}
      <motion.div
        className={`card flex items-center gap-3 px-3 py-3 cursor-pointer
                    active:opacity-90 select-none ${stripCls}`}
        style={{ x }}
        drag="x"
        dragConstraints={{ left: -DELETE_THRESHOLD * 1.2, right: 0 }}
        dragElastic={{ left: 0.15, right: 0.05 }}
        onDragEnd={handleDragEnd}
        onClick={handleTap}
        whileTap={{ opacity: 0.85 }}
      >
        <CategoryIcon categoryId={txn.category} size={18} />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-ink truncate">{txn.description}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-ink-3">{cat.label}</span>
            {showDate && (
              <span className="text-xs text-ink-3">· {fmtDate(txn.date)}</span>
            )}
            {txn.is_repayment && (
              <span className="chip-repay text-[10px] px-1.5 py-0.5">Repayment</span>
            )}
          </div>
        </div>

        <span className={`text-sm shrink-0 ${amtCls}`}>
          {prefix}{fmt(txn.amount)}
        </span>
      </motion.div>
    </div>
  )
}
