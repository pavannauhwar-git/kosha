import { memo, useState, useCallback } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { Trash, CopySimple, CircleNotch } from '@phosphor-icons/react'
import CategoryIcon, { ICON_MAP } from './CategoryIcon'
import { fmt, amountClass, amountPrefix, fmtDate } from '../lib/utils'
import { getCategory, INVESTMENT_VEHICLES } from '../lib/categories'

const PEEK_X = 140

const MODE_LABEL = {
  upi:         'UPI',
  credit_card: 'Card',
  debit_card:  'Card',
  cash:        'Cash',
  net_banking: 'Bank',
  wallet:      'Wallet',
  other:       '',
}

function TransactionItem({ txn, onDelete, onDuplicate, onTap, showDate = false, isLast = false, isHighlighted = false }) {
  const x = useMotionValue(0)

  const actionOpacity = useTransform(x, [0, -30, -PEEK_X], [0, 0.5, 1])
  const actionScale   = useTransform(x, [-PEEK_X * 0.4, -PEEK_X], [0.92, 1])

  const [deleting, setDeleting] = useState(false)
  const [hidden, setHidden] = useState(false)

  const cat    = getCategory(txn.category)
  const investmentVehicle = txn.type === 'investment'
    ? INVESTMENT_VEHICLES.find((vehicle) => (
      vehicle.label === txn.investment_vehicle || vehicle.id === txn.investment_vehicle
    ))
    : null
  const amtCls = amountClass(txn.type, txn.is_repayment)
  const prefix = amountPrefix(txn.type)
  const mode   = MODE_LABEL[txn.payment_mode] || ''
  const isOptimistic = Boolean(txn?.__optimistic || String(txn?.id || '').startsWith('optimistic-'))
  const rowLabel = txn.type === 'investment'
    ? (investmentVehicle?.label || txn.investment_vehicle || 'Other')
    : cat.label

  // FIX (defect 5.5): All 6 handlers are now wrapped in useCallback.
  // Previously they were plain functions recreated on every render.
  // TransactionItem is wrapped in memo, which prevents re-renders from
  // parent prop changes. But any internal setState (e.g. setDeleting(true))
  // still triggered a re-render, causing all 6 functions to be reallocated
  // before React could bail out. With useCallback and empty dep arrays
  // (all deps are stable: motion values, txn prop handled via closure on
  // initial render, or accessed via current ref pattern below), the
  // functions are allocated once per component mount.
  //
  // Note: txn is in the dep array where the callback reads txn properties
  // at call-time. Since TransactionItem is memoized, txn only changes when
  // the parent provides a genuinely new object reference.

  const snapToPeek = useCallback(() => {
    animate(x, -PEEK_X, { type: 'spring', stiffness: 500, damping: 36 })
  }, [x])

  const snapToRest = useCallback(() => {
    animate(x, 0, { type: 'spring', stiffness: 500, damping: 36 })
  }, [x])

  const handleDragEnd = useCallback((_, info) => {
    const ox = info.offset.x
    if (ox > 0) {
      snapToRest()
      return
    }
    if (ox < -PEEK_X * 0.5) {
      snapToPeek()
    } else {
      snapToRest()
    }
  }, [snapToPeek, snapToRest])

  const handleDeleteTap = useCallback(async () => {
    setDeleting(true)
    setHidden(true)
    animate(x, 0, { duration: 0.2 })
    if (navigator.vibrate) navigator.vibrate(10)

    if (!onDelete) {
      setDeleting(false)
      setHidden(false)
      return
    }

    try {
      await onDelete(txn.id)
    } catch {
      // Keep UI responsive even if delete fails.
      setDeleting(false)
      setHidden(false)
      return
    }

    setDeleting(false)
  }, [onDelete, txn.id, x])

  const handleDuplicateTap = useCallback(() => {
    snapToRest()
    if (navigator.vibrate) navigator.vibrate([6, 10, 6])
    setTimeout(() => onDuplicate && onDuplicate(txn), 120)
  }, [onDuplicate, snapToRest, txn])

  const handleTap = useCallback(() => {
    if (x.get() < -10) {
      snapToRest()
      return
    }
    if (navigator.vibrate) navigator.vibrate(8)
    onTap && onTap(txn)
  }, [onTap, snapToRest, txn, x])

  if (hidden) return null

  return (
    <div
      id={`txn-${txn.id}`}
      className={`relative overflow-hidden bg-kosha-surface ${isHighlighted ? 'txn-focus-highlight' : ''}`}
    >

      {/* Action zone */}
      {!isOptimistic && (
        <motion.div
          className="absolute inset-y-0 right-0 flex items-stretch"
          style={{ opacity: actionOpacity, scale: actionScale }}
        >
          <button
            onClick={handleDuplicateTap}
            className="flex flex-col items-center justify-center gap-1 px-5
                     bg-brand-container active:opacity-80 transition-opacity duration-100"
          >
            <CopySimple size={18} weight="bold" color="var(--c-brand)" />
            <span className="text-[10px] font-semibold" style={{ color: 'var(--c-brand)' }}>
              Repeat
            </span>
          </button>

          <button
            onClick={handleDeleteTap}
            className="flex flex-col items-center justify-center gap-1 px-5
                     bg-expense active:opacity-80 transition-opacity duration-100"
          >
            <Trash size={18} weight="bold" color="white" />
            <span className="text-[10px] font-semibold text-white">Delete</span>
          </button>
        </motion.div>
      )}

      {/* Draggable row */}
      <motion.div
        className="list-row active:bg-kosha-surface-2"
        style={{ x }}
        drag={isOptimistic ? false : 'x'}
        dragConstraints={{ left: -PEEK_X * 1.5, right: 0 }}
        dragElastic={{ left: 0.12, right: 0.02 }}
        onDragEnd={handleDragEnd}
        onClick={handleTap}
        whileTap={{ scale: 0.992 }}
        transition={{ scale: { duration: 0.08 } }}
      >
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{ background: investmentVehicle?.bg || cat.bg }}
        >
          {txn.type === 'investment' && investmentVehicle ? (
            (() => {
              const Icon = ICON_MAP[investmentVehicle.icon]
              return Icon
                ? <Icon size={18} weight="duotone" color={investmentVehicle.color} />
                : <CategoryIcon categoryId={txn.category} size={18} />
            })()
          ) : (
            <CategoryIcon categoryId={txn.category} size={18} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-ink truncate leading-snug">
            {txn.description}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {showDate
              ? <span className="text-[11px] text-ink-3">{fmtDate(txn.date)}</span>
              : <span className="text-[11px] text-ink-3">{rowLabel}</span>
            }
            {mode && (
              <span className="text-[10px] font-medium text-ink-3 bg-kosha-surface-2 px-1.5 py-px rounded-md">
                {mode}
              </span>
            )}
            {txn.is_repayment && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-pill bg-repay-bg text-repay-text font-medium">
                Repayment
              </span>
            )}
            {txn.is_recurring && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-pill bg-brand-container text-brand-on font-medium capitalize">
                {txn.recurrence || 'Recurring'}
              </span>
            )}
            {txn.is_auto_generated && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-pill bg-kosha-surface-2 text-ink-3 font-medium">
                Auto
              </span>
            )}
            {isOptimistic && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-pill bg-warning-bg text-warning-text font-medium">
                Syncing...
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 pl-1 shrink-0">
          <span className={`text-[14px] tabular-nums font-semibold ${amtCls}`}>
            {prefix}{fmt(txn.amount)}
          </span>
        </div>
      </motion.div>

      {deleting && (
        <div className="absolute inset-0 bg-kosha-surface/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
          <CircleNotch size={24} className="animate-spin" weight="bold"
            style={{ color: 'var(--c-brand)' }} />
        </div>
      )}

      {!isLast && (
        <div className="absolute bottom-0 left-[60px] right-0 h-[0.5px] bg-kosha-border" />
      )}
    </div>
  )
}

export default memo(TransactionItem)
