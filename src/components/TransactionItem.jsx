import { memo, useState } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { Trash, CopySimple } from '@phosphor-icons/react'
import CategoryIcon from './CategoryIcon'
import { fmt, amountClass, amountPrefix, fmtDate } from '../lib/utils'
import { getCategory } from '../lib/categories'

// ── Thresholds ────────────────────────────────────────────────────────────
// PEEK   — row snaps here after a light swipe, revealing both action buttons
// COMMIT — dragging past this auto-triggers delete (power-user shortcut)
const PEEK_X   = 140   // px — both buttons fully visible at this offset
const COMMIT_X = 260   // px — full drag auto-deletes, no tap needed

const MODE_LABEL = {
  upi:         'UPI',
  credit_card: 'Card',
  debit_card:  'Card',
  cash:        'Cash',
  net_banking: 'Bank',
  other:       '',
}

function TransactionItem({ txn, onDelete, onDuplicate, onTap, showDate = false, isLast = false }) {
  const x = useMotionValue(0)

  // Action zone fades in as the row slides left past ~30px
  const actionOpacity = useTransform(x, [0, -30, -PEEK_X], [0, 0.5, 1])

  // Subtle scale on the action zone as it comes into full view
  const actionScale = useTransform(x, [-PEEK_X * 0.4, -PEEK_X], [0.92, 1])

  const [deleting, setDeleting] = useState(false)

  const cat    = getCategory(txn.category)
  const amtCls = amountClass(txn.type, txn.is_repayment)
  const prefix = amountPrefix(txn.type)
  const mode   = MODE_LABEL[txn.payment_mode] || ''

  // ── Snap to peek (both buttons visible) ──────────────────────────────
  function snapToPeek() {
    animate(x, -PEEK_X, { type: 'spring', stiffness: 500, damping: 36 })
  }

  // ── Snap back to rest ─────────────────────────────────────────────────
  function snapToRest() {
    animate(x, 0, { type: 'spring', stiffness: 500, damping: 36 })
  }

  async function handleDragEnd(_, info) {
    const ox = info.offset.x

    if (ox > 0) {
      // Right drag — snap back, no action
      snapToRest()
      return
    }

    if (ox < -COMMIT_X) {
      // Full drag past commit threshold — auto delete
      await animate(x, -500, { duration: 0.22 })
      setDeleting(true)
      if (navigator.vibrate) navigator.vibrate([10, 20, 10])
      onDelete && onDelete(txn.id)
    } else if (ox < -PEEK_X * 0.5) {
      // Past halfway to peek — snap to peek, show buttons
      snapToPeek()
    } else {
      // Light drag — snap back
      snapToRest()
    }
  }

  // ── Action button handlers ────────────────────────────────────────────
  function handleDeleteTap() {
    setDeleting(true)
    animate(x, -500, { duration: 0.2 })
    if (navigator.vibrate) navigator.vibrate(10)
    setTimeout(() => onDelete && onDelete(txn.id), 200)
  }

  function handleDuplicateTap() {
    snapToRest()
    if (navigator.vibrate) navigator.vibrate([6, 10, 6])
    // Small delay so the row snaps back before the sheet opens — feels cleaner
    setTimeout(() => onDuplicate && onDuplicate(txn), 120)
  }

  // ── Row tap ───────────────────────────────────────────────────────────
  function handleTap() {
    // If peeked, first tap just closes the action zone
    if (x.get() < -10) {
      snapToRest()
      return
    }
    if (navigator.vibrate) navigator.vibrate(8)
    onTap && onTap(txn)
  }

  if (deleting) return null

  return (
    <div className="relative overflow-hidden bg-kosha-surface">

      {/* ── Action zone — sits on the right, revealed by left swipe ───── */}
      <motion.div
        className="absolute inset-y-0 right-0 flex items-stretch"
        style={{ opacity: actionOpacity, scale: actionScale }}
      >
        {/* Repeat button */}
        <button
          onClick={handleDuplicateTap}
          className="flex flex-col items-center justify-center gap-1 px-5
                     bg-brand-container active:opacity-80 transition-opacity"
        >
          <CopySimple size={18} weight="bold" color="var(--c-brand)" />
          <span className="text-[10px] font-semibold" style={{ color: 'var(--c-brand)' }}>
            Repeat
          </span>
        </button>

        {/* Delete button */}
        <button
          onClick={handleDeleteTap}
          className="flex flex-col items-center justify-center gap-1 px-5
                     bg-expense active:opacity-80 transition-opacity"
        >
          <Trash size={18} weight="bold" color="white" />
          <span className="text-[10px] font-semibold text-white">Delete</span>
        </button>
      </motion.div>

      {/* ── Draggable row ─────────────────────────────────────────────── */}
      <motion.div
        className="list-row active:bg-kosha-surface-2"
        style={{ x }}
        drag="x"
        dragConstraints={{ left: -COMMIT_X * 1.1, right: 0 }}
        dragElastic={{ left: 0.12, right: 0.02 }}
        onDragEnd={handleDragEnd}
        onClick={handleTap}
        whileTap={{ scale: 0.985 }}
        transition={{ scale: { duration: 0.07 } }}
      >
        {/* Category bubble */}
        <div
          className="w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0"
          style={{ background: cat.bg }}
        >
          <CategoryIcon categoryId={txn.category} size={18} />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-medium text-ink truncate leading-snug">
            {txn.description}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {showDate
              ? <span className="text-[12px] text-ink-3">{fmtDate(txn.date)}</span>
              : <span className="text-[12px] text-ink-3">{cat.label}</span>
            }
            {mode && (
              <span className="text-[11px] font-medium text-ink-4 bg-kosha-surface-2 px-1.5 py-px rounded-[5px]">
                {mode}
              </span>
            )}
            {txn.is_repayment && (
              <span className="text-[11px] px-1.5 py-0.5 rounded-pill bg-repay-bg text-repay-text font-medium">
                Repayment
              </span>
            )}
          </div>
        </div>

        {/* Amount */}
        <span className={`text-[15px] shrink-0 tabular-nums font-semibold ${amtCls}`}>
          {prefix}{fmt(txn.amount)}
        </span>
      </motion.div>

      {!isLast && (
        <div className="absolute bottom-0 left-[60px] right-0 h-[0.5px] bg-kosha-border" />
      )}
    </div>
  )
}

export default memo(TransactionItem)
