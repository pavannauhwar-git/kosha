import { memo, useState, useCallback, useEffect, useRef } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { Trash, CopySimple, CircleNotch } from '@phosphor-icons/react'
import { ArrowUDownLeft } from '@phosphor-icons/react'
import CategoryIcon, { ICON_MAP } from '../categories/CategoryIcon'
import { fmt, amountClass, amountPrefix, fmtDate } from '../../lib/utils'
import { getCategory, INVESTMENT_VEHICLES } from '../../lib/categories'

const PEEK_X = 140
const SWIPE_OPEN_THRESHOLD = PEEK_X * 0.42
const AUTO_NUDGE_X = 22
const ACTIONS_ENABLE_X = -36

const MODE_LABEL = {
  upi:         'UPI',
  credit_card: 'Card',
  debit_card:  'Card',
  cash:        'Cash',
  net_banking: 'Bank',
  wallet:      'Wallet',
  other:       '',
}

function TransactionItem({
  txn,
  onDelete,
  onDuplicate,
  onTap,
  showDate = false,
  compact = false,
  isLast = false,
  isHighlighted = false,
  autoNudge = false,
  onAutoNudgeDone,
  onSwipeHintLearned,
}) {
  const x = useMotionValue(0)

  const actionOpacity = useTransform(x, [0, -30, -PEEK_X], [0, 0.5, 1])
  const actionScale   = useTransform(x, [-PEEK_X * 0.4, -PEEK_X], [0.92, 1])
  const deleteBg = 'rgba(232,69,60,0.96)'
  const deleteFg = 'rgba(255,255,255,1)'

  const [deleting, setDeleting] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [actionsEnabled, setActionsEnabled] = useState(false)
  const swipeLearnedRef = useRef(false)
  const nudgePlayedRef = useRef(false)

  const markSwipeLearned = useCallback(() => {
    if (swipeLearnedRef.current) return
    swipeLearnedRef.current = true
    if (typeof onSwipeHintLearned === 'function') {
      onSwipeHintLearned()
    }
  }, [onSwipeHintLearned])

  const cat    = getCategory(txn.category)
  const investmentVehicle = txn.type === 'investment'
    ? INVESTMENT_VEHICLES.find((vehicle) => (
      vehicle.label === txn.investment_vehicle || vehicle.id === txn.investment_vehicle
    ))
    : null
  const investmentChipStyle = investmentVehicle
    ? {
        backgroundColor: investmentVehicle.bg,
        background: `color-mix(in srgb, ${investmentVehicle.color} 18%, var(--ds-surface))`,
      }
    : undefined
  const amtCls = amountClass(txn.type, txn.is_repayment)
  const prefix = amountPrefix(txn.type)
  const mode   = MODE_LABEL[txn.payment_mode] || ''
  const isOptimistic = Boolean(txn?.__optimistic || String(txn?.id || '').startsWith('optimistic-'))
  const rowLabel = txn.type === 'investment'
    ? (investmentVehicle?.label || txn.investment_vehicle || 'Other')
    : (txn.is_repayment ? 'Loan Repayment' : cat.label)

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
    import('../../lib/haptics').then(m => m.hapticHeavy())
    animate(x, -PEEK_X, { type: 'spring', stiffness: 600, damping: 45 })
  }, [x])

  const snapToRest = useCallback(() => {
    animate(x, 0, { type: 'spring', stiffness: 600, damping: 45 })
  }, [x])

  useEffect(() => {
    if (!autoNudge || isOptimistic || nudgePlayedRef.current) return undefined

    nudgePlayedRef.current = true
    let backTimer = null

    const startTimer = setTimeout(() => {
      const nudgeIn = animate(x, -AUTO_NUDGE_X, { duration: 0.2, ease: [0.05, 0.7, 0.1, 1] })
      backTimer = setTimeout(() => {
        nudgeIn.stop()
        animate(x, 0, { type: 'spring', stiffness: 620, damping: 45 })
        if (typeof onAutoNudgeDone === 'function') {
          onAutoNudgeDone()
        }
      }, 220)
    }, 220)

    return () => {
      clearTimeout(startTimer)
      if (backTimer) clearTimeout(backTimer)
    }
  }, [autoNudge, isOptimistic, onAutoNudgeDone, x])

  useEffect(() => {
    const unsubscribe = x.on('change', (latest) => {
      const nextEnabled = latest <= ACTIONS_ENABLE_X
      setActionsEnabled((prev) => (prev === nextEnabled ? prev : nextEnabled))
    })

    return () => unsubscribe()
  }, [x])

  const handleDragEnd = useCallback((_, info) => {
    const ox = info.offset.x
    if (ox > 0) {
      snapToRest()
      return
    }
    if (ox < -SWIPE_OPEN_THRESHOLD) {
      markSwipeLearned()
      snapToPeek()
    } else {
      snapToRest()
    }
  }, [markSwipeLearned, snapToPeek, snapToRest])

  const handleDeleteTap = useCallback(async () => {
    markSwipeLearned()
    setDeleting(true)
    setHidden(true)
    animate(x, 0, { duration: 0.2 })
    import('../../lib/haptics').then(m => m.hapticTap())

    if (!onDelete) {
      setDeleting(false)
      setHidden(false)
      return
    }

    try {
      const didDelete = await onDelete(txn.id)
      if (didDelete === false) {
        setDeleting(false)
        setHidden(false)
        return
      }
    } catch {
      // Keep UI responsive even if delete fails.
      setDeleting(false)
      setHidden(false)
      return
    }

    setDeleting(false)
  }, [markSwipeLearned, onDelete, txn.id, x])

  const handleDuplicateTap = useCallback(() => {
    markSwipeLearned()
    snapToRest()
    import('../../lib/haptics').then(m => m.hapticSuccess())
    setTimeout(() => onDuplicate && onDuplicate(txn), 120)
  }, [markSwipeLearned, onDuplicate, snapToRest, txn])

  const handleTap = useCallback(() => {
    if (x.get() < -10) {
      snapToRest()
      return
    }
    import('../../lib/haptics').then(m => m.hapticTap())
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
          style={{
            opacity: actionOpacity,
            scale: actionScale,
            pointerEvents: actionsEnabled ? 'auto' : 'none',
          }}
          aria-hidden={!actionsEnabled}
        >
          <button
            onClick={handleDuplicateTap}
            className="w-[70px] flex flex-col items-center justify-center gap-1 px-5
                     bg-brand-container active:scale-[0.96] active:opacity-80 transition-all duration-150"
          >
            <CopySimple size={18} weight="bold" color="var(--c-brand)" />
            <span className="text-[10px] font-semibold" style={{ color: 'var(--c-brand)' }}>
              Repeat
            </span>
          </button>

          <motion.button
            onClick={handleDeleteTap}
            className="w-[70px] flex flex-col items-center justify-center gap-1 px-5
                     active:scale-[0.96] active:opacity-80 transition-all duration-150"
            style={{ backgroundColor: deleteBg, color: deleteFg }}
          >
            <span>
              <Trash size={18} weight="bold" color="currentColor" />
            </span>
            <span className="text-[10px] font-semibold" style={{ color: deleteFg }}>Delete</span>
          </motion.button>
        </motion.div>
      )}

      {/* Draggable row */}
      <motion.div
        className={`${compact
          ? 'flex items-center gap-3 px-4 py-3 bg-kosha-surface active:bg-kosha-surface-2'
          : 'list-row py-3 sm:py-3.5 active:bg-kosha-surface-2'
          }`}
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
          className={`${compact ? 'w-8 h-8' : 'w-9 h-9'} rounded-full flex items-center justify-center shrink-0`}
          style={txn.type === 'investment' ? investmentChipStyle : undefined}
        >
          {txn.is_repayment ? (
            <div
              className="w-8 h-8 rounded-chip flex items-center justify-center shrink-0"
              style={{
                backgroundColor: 'var(--ds-repay-bg)',
                background: 'color-mix(in srgb, var(--ds-repay) 16%, var(--ds-surface))',
              }}
            >
              <ArrowUDownLeft size={compact ? 16 : 18} weight="duotone" color="var(--ds-repay-text)" />
            </div>
          ) : txn.type === 'investment' && investmentVehicle ? (
            (() => {
              const Icon = ICON_MAP[investmentVehicle.icon]
              return Icon
                ? <Icon size={compact ? 16 : 18} weight="duotone" color={investmentVehicle.color} />
                : <CategoryIcon categoryId={txn.category} size={compact ? 16 : 18} />
            })()
          ) : (
            <CategoryIcon categoryId={txn.category} size={compact ? 16 : 18} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className={`${compact ? 'text-[13px]' : 'text-[13px] sm:text-[14px]'} font-semibold text-ink truncate leading-snug`}>
            {txn.description}
          </p>
          {compact ? (
            <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
              <span className="text-[11px] text-ink-3 truncate">
                {showDate ? fmtDate(txn.date) : rowLabel}
              </span>
              {txn.is_repayment && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-pill bg-repay-bg text-repay-text font-medium shrink-0">
                  Repayment
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              {showDate
                ? <span className="text-[10px] sm:text-[11px] text-ink-3">{fmtDate(txn.date)}</span>
                : <span className="text-[10px] sm:text-[11px] text-ink-3">{rowLabel}</span>
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
                <span className="text-[10px] px-1.5 py-0.5 rounded-pill bg-ink/[0.06] text-ink font-medium capitalize">
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
          )}
        </div>

        <span className={`${compact ? 'text-[13px]' : 'text-[13px] sm:text-[14px]'} shrink-0 tabular-nums font-semibold ${amtCls}`}>
          {prefix}{fmt(txn.amount)}
        </span>
      </motion.div>

      {deleting && (
        <div className="absolute inset-0 bg-kosha-surface/60 backdrop-blur-[1px] z-10 flex items-center justify-center">
          <CircleNotch size={24} className="animate-spin" weight="bold"
            style={{ color: 'var(--c-brand)' }} />
        </div>
      )}

      {!isLast && (
        <div className={`absolute bottom-0 right-0 h-[0.5px] bg-kosha-border ${compact ? 'left-0' : 'left-[60px]'}`} />
      )}
    </div>
  )
}

export default memo(TransactionItem)
