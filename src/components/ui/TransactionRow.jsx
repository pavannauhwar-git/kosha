import { memo } from 'react'
import { motion } from 'framer-motion'
import { ArrowsClockwise, ArrowUDownLeft, Notepad } from '@phosphor-icons/react'
import CategoryIcon from '../categories/CategoryIcon'
import Badge from './Badge'
import { fmt, fmtDate, amountClass } from '../../lib/utils'

/**
 * TransactionRow — M3 strict list row.
 * Uses md3-state-overlay for standard MD3 interaction feedback.
 */
const TransactionRow = memo(function TransactionRow({ transaction, onTap, className = '' }) {
  const { type, amount, description, category, date, is_recurring, is_repayment, investment_vehicle } = transaction
  const amountCls = amountClass(type, is_repayment)
  const prefix = type === 'income' ? '+' : type === 'expense' ? '-' : ''
  const displayCategory = type === 'investment' ? (investment_vehicle || category) : category

  return (
    <motion.button
      type="button"
      onClick={() => onTap?.(transaction)}
      className={[
        'flex items-center gap-3 w-full px-5 py-3.5 text-left',
        'bg-[var(--ds-surface)]',
        'min-h-[56px]',
        'focus-visible:outline-none md3-state-overlay relative overflow-hidden',
        className,
      ].join(' ')}
      style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
      aria-label={`${description || displayCategory}: ${prefix}${fmt(amount)}`}
    >
      {/* Category icon */}
      <div className="shrink-0">
        {is_repayment ? (
          <div
            className="w-[48px] h-[48px] rounded-full flex items-center justify-center"
            style={{
              backgroundColor: 'var(--ds-repay-bg)',
              background: 'color-mix(in srgb, var(--ds-repay) 16%, var(--ds-surface))',
            }}
          >
            <ArrowUDownLeft size={20} weight="duotone" color="var(--ds-repay-text)" />
          </div>
        ) : (
          <CategoryIcon id={displayCategory} size={36} />
        )}
      </div>

      {/* Description + date + badges */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-body font-medium text-[var(--ds-text)] truncate">
            {description || displayCategory || 'Transaction'}
          </span>
          {is_recurring && (
            <Badge variant="recurring" size="sm">
              <ArrowsClockwise size={10} weight="bold" className="mr-0.5" />
              Recurring
            </Badge>
          )}
          {is_repayment && (
            <Badge variant="repayment" size="sm">
              <ArrowUDownLeft size={10} weight="bold" className="mr-0.5" />
              Repayment
            </Badge>
          )}
          {transaction.notes && (
            <Badge variant="neutral" size="sm" title={transaction.notes}>
              <Notepad size={10} weight="bold" className="mr-0.5" />
              Note
            </Badge>
          )}
        </div>
        <span className="text-caption text-[var(--ds-text-tertiary)]">
          {fmtDate(date)}
          {displayCategory && description ? ` · ${displayCategory}` : ''}
        </span>
      </div>

      {/* Amount */}
      <span className={`text-body font-semibold shrink-0 tabular-nums ${amountCls}`}>
        {prefix}{fmt(amount)}
      </span>
    </motion.button>
  )
})

export default TransactionRow
