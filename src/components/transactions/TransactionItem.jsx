import { memo, useState, useCallback, useEffect, useRef } from 'react'
import { AnimatePresence, motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { Trash, CopySimple, CircleNotch } from '@phosphor-icons/react'
import { ArrowUDownLeft, ArrowSquareOut, X, Notepad } from '@phosphor-icons/react'
import { useNavigate } from 'react-router-dom'
import CategoryIcon, { ICON_MAP } from '../categories/CategoryIcon'
import { fmt, amountClass, amountPrefix, fmtDate } from '../../lib/utils'
import { getCategory, INVESTMENT_VEHICLES } from '../../lib/categories'
import { supabase } from '../../lib/supabase'

const PEEK_X = 140
const SWIPE_OPEN_THRESHOLD = PEEK_X * 0.42
const AUTO_NUDGE_X = 22
const ACTIONS_ENABLE_X = -36

const MODE_LABEL = {
  upi: 'UPI',
  credit_card: 'Card',
  debit_card: 'Card',
  cash: 'Cash',
  net_banking: 'Bank',
  wallet: 'Wallet',
  other: '',
}

// ─── Splitwise Info Sheet ──────────────────────────────────────────────────────
function LinkedTransactionInfoSheet({ txn, onClose }) {
  const navigate = useNavigate()
  const [navigating, setNavigating] = useState(false)

  const isSplitwise = Boolean(txn.linked_split_expense_id || txn.linked_split_settlement_id)
  const isBill = Boolean(txn.linked_bill_id)
  const isLoan = Boolean(txn.linked_loan_id)

  const handleGoToSource = useCallback(async () => {
    setNavigating(true)
    try {
      if (isSplitwise) {
        const linkedId = txn.linked_split_expense_id || txn.linked_split_settlement_id
        let groupId = null

        if (txn.linked_split_expense_id) {
          const { data } = await supabase
            .from('split_expenses')
            .select('group_id')
            .eq('id', txn.linked_split_expense_id)
            .single()
          groupId = data?.group_id
        } else if (txn.linked_split_settlement_id) {
          const { data } = await supabase
            .from('split_settlements')
            .select('group_id')
            .eq('id', txn.linked_split_settlement_id)
            .single()
          groupId = data?.group_id
        }

        onClose()
        navigate('/splitwise', {
          state: { openGroupId: groupId, highlightId: linkedId },
        })
      } else if (isBill) {
        onClose()
        navigate(`/obligations?focus=${txn.linked_bill_id}`)
      } else if (isLoan) {
        onClose()
        navigate(`/loans?repaymentLoan=${txn.linked_loan_id}&repaymentTxn=${txn.id}`)
      }
    } catch {
      onClose()
      if (isSplitwise) navigate('/splitwise')
      else if (isBill) navigate('/obligations')
      else if (isLoan) navigate('/loans')
    } finally {
      setNavigating(false)
    }
  }, [txn, navigate, onClose, isSplitwise, isBill, isLoan])

  const title = isSplitwise ? 'Splitwise Transaction' : isBill ? 'Bill Payment' : 'Loan Repayment'
  const typeLabel = isSplitwise
    ? (txn.linked_split_settlement_id ? 'Group settlement' : 'Group expense')
    : isBill ? 'Automated bill payment' : 'Loan settlement payment'

  const infoMessage = isSplitwise
    ? 'This transaction is managed by Splitwise. To edit its amount, description, or delete it, please make the changes directly from the Splitwise group page.'
    : isBill
      ? 'This transaction was automatically created from a bill. To manage or delete it, please go to the Bills & Dues page.'
      : 'This transaction is linked to a loan repayment. To edit or delete it, please manage it from the Loans page.'

  const buttonLabel = isSplitwise ? 'Go to Splitwise Group' : isBill ? 'Go to Bills & Dues' : 'Go to Loans'

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[200] flex items-end justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.div
          className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        <motion.div
          className="relative w-full max-w-lg bg-kosha-surface rounded-t-[28px] px-5 pb-10 pt-2 z-10 shadow-apple-card"
          initial={{ y: '100%' }}
          animate={{ y: 0, transition: { type: 'spring', stiffness: 480, damping: 40 } }}
          exit={{ y: '100%', transition: { duration: 0.22, ease: [0.2, 0, 0, 1] } }}
        >
          <div className="w-10 h-1 bg-kosha-border rounded-full mx-auto mb-5" />

          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full bg-kosha-surface-2 text-ink-3 active:opacity-70"
          >
            <X size={16} weight="bold" />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-2xl bg-brand-container flex items-center justify-center shrink-0">
              <ArrowSquareOut size={20} weight="duotone" color="var(--ds-primary)" />
            </div>
            <div>
              <p className="text-[16px] font-bold text-ink leading-snug">{title}</p>
              <p className="text-[12px] text-ink-3 mt-0.5">{typeLabel}</p>
            </div>
          </div>

          <div className="bg-kosha-surface-2 rounded-2xl px-4 py-3 mb-5">
            <p className="text-[14px] font-semibold text-ink mb-0.5 truncate">{txn.description}</p>
            <p className={`text-[13px] font-medium ${amountClass(txn.type, txn.is_repayment)}`}>
              {amountPrefix(txn.type)}{fmt(txn.amount)}
            </p>
            {txn.date && (
              <p className="text-[12px] text-ink-3 mt-1">{fmtDate(txn.date)}</p>
            )}
          </div>

          <div className="rounded-2xl border border-brand-container bg-brand-container/40 p-4 mb-5">
            <p className="text-[13px] text-ink leading-relaxed">
              {infoMessage}
            </p>
          </div>

          <button
            onClick={handleGoToSource}
            disabled={navigating}
            className="w-full h-12 rounded-2xl bg-brand text-white font-semibold text-[15px] flex items-center justify-center gap-2 active:opacity-80 disabled:opacity-60 transition-opacity"
          >
            {navigating ? (
              <CircleNotch size={18} className="animate-spin" />
            ) : (
              <ArrowSquareOut size={18} weight="bold" />
            )}
            {navigating ? 'Opening…' : buttonLabel}
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
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
  const actionScale = useTransform(x, [-PEEK_X * 0.4, -PEEK_X], [0.92, 1])
  const deleteBg = 'rgba(232,69,60,0.96)'
  const deleteFg = 'rgba(255,255,255,1)'

  const [deleting, setDeleting] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [actionsEnabled, setActionsEnabled] = useState(false)
  const [showLinkedInfo, setShowLinkedInfo] = useState(false)
  const swipeLearnedRef = useRef(false)
  const nudgePlayedRef = useRef(false)

  const markSwipeLearned = useCallback(() => {
    if (swipeLearnedRef.current) return
    swipeLearnedRef.current = true
    if (typeof onSwipeHintLearned === 'function') {
      onSwipeHintLearned()
    }
  }, [onSwipeHintLearned])

  const cat = getCategory(txn.category)
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
  const mode = MODE_LABEL[txn.payment_mode] || ''
  const isOptimistic = Boolean(txn?.__optimistic || String(txn?.id || '').startsWith('optimistic-'))
  const rowLabel = txn.type === 'investment'
    ? (investmentVehicle?.label || txn.investment_vehicle || 'Other')
    : txn.linked_split_settlement_id
      ? 'Settlement'
      : txn.linked_bill_id
        ? 'Bill Payment'
        : (txn.is_repayment ? 'Loan Repayment' : cat.label)

  const isSplitwiseLinked = Boolean(txn.linked_split_expense_id || txn.linked_split_settlement_id)
  const isBillLinked = Boolean(txn.linked_bill_id)
  const isLoanLinked = Boolean(txn.linked_loan_id)
  const isExternalLinked = isSplitwiseLinked || isBillLinked || isLoanLinked

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
    if (isExternalLinked) {
      import('../../lib/haptics').then(m => m.hapticTap())
      setShowLinkedInfo(true)
      return
    }
    import('../../lib/haptics').then(m => m.hapticTap())
    onTap && onTap(txn)
  }, [onTap, snapToRest, txn, x, isExternalLinked])

  if (hidden) return null

  return (
    <>
      <div
        id={`txn-${txn.id}`}
        className={`relative overflow-hidden bg-kosha-surface ${isHighlighted ? 'txn-focus-highlight' : ''}`}
      >

        {/* Action zone */}
        {!isOptimistic && !isExternalLinked && (
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
                       bg-brand-container active:scale-[0.96] active:opacity-80 transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] will-change-transform"
            >
              <CopySimple size={18} weight="bold" color="var(--c-brand)" />
              <span className="text-[10px] font-semibold" style={{ color: 'var(--c-brand)' }}>
                Repeat
              </span>
            </button>

            <motion.button
              onClick={handleDeleteTap}
              className="w-[70px] flex flex-col items-center justify-center gap-1 px-5
                       active:scale-[0.96] active:opacity-80 transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] will-change-transform"
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
          drag={isOptimistic || isExternalLinked ? false : 'x'}
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
                {txn.notes && (
                  <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-pill bg-kosha-surface-2 text-ink border border-kosha-border font-medium shrink-0" title={txn.notes}>
                    <Notepad size={10} weight="bold" className="text-ink-3" />
                    Note
                  </span>
                )}
                {isSplitwiseLinked && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-pill bg-brand-container text-brand font-medium shrink-0">
                    Splitwise
                  </span>
                )}
                {isBillLinked && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-pill bg-brand-container text-brand font-medium shrink-0">
                    Bill
                  </span>
                )}
                {isLoanLinked && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-pill bg-brand-container text-brand font-medium shrink-0">
                    Loan
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
                {txn.notes && (
                  <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-pill bg-kosha-surface-2 text-ink border border-kosha-border font-medium shrink-0" title={txn.notes}>
                    <Notepad size={10} weight="bold" className="text-ink-3" />
                    Note
                  </span>
                )}
                {txn.is_recurring && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-pill bg-kosha-surface-2 text-ink border border-kosha-border font-medium capitalize">
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
                {isSplitwiseLinked && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-pill bg-brand-container text-brand font-medium shrink-0">
                    Splitwise
                  </span>
                )}
                {isBillLinked && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-pill bg-brand-container text-brand font-medium shrink-0">
                    Bill
                  </span>
                )}
                {isLoanLinked && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-pill bg-brand-container text-brand font-medium shrink-0">
                    Loan
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

      {/* Splitwise info sheet — rendered outside the overflow-hidden parent */}
      {showLinkedInfo && (
        <LinkedTransactionInfoSheet
          txn={txn}
          onClose={() => setShowLinkedInfo(false)}
        />
      )}
    </>
  )
}

export default memo(TransactionItem)
