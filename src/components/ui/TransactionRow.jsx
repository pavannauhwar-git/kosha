import { memo } from 'react'
import { ArrowsClockwise, ArrowUDownLeft } from '@phosphor-icons/react'
import CategoryIcon from '../categories/CategoryIcon'
import Badge from './Badge'
import { fmt, fmtDate, amountClass } from '../../lib/utils'

/**
 * TransactionRow — single transaction in list with category icon, badges, and amount
 * @param {{ transaction: object, onTap?: function, onDelete?: function, onDuplicate?: function, className?: string }} props
 */
const TransactionRow = memo(function TransactionRow({ transaction, onTap, className = '' }) {
  const { type, amount, description, category, date, is_recurring, is_repayment, investment_vehicle } = transaction
  const amountCls = amountClass(type, is_repayment)
  const prefix = type === 'income' ? '+' : type === 'expense' ? '-' : ''
  const displayCategory = type === 'investment' ? (investment_vehicle || category) : category

  return (
    <button
      type="button"
      onClick={() => onTap?.(transaction)}
      className={[
        'flex items-center gap-3 w-full px-5 py-3.5 text-left',
        'bg-[var(--ds-surface)] hover:bg-[var(--ds-surface-bright)] transition-colors duration-150',
        'min-h-[56px] active:bg-[var(--ds-surface-container)]',
        'focus-visible:outline-none',
        className,
      ].join(' ')}
      aria-label={`${description || displayCategory}: ${prefix}${fmt(amount)}`}
    >
      {/* Category icon */}
      <div className="shrink-0">
        <CategoryIcon id={displayCategory} size={36} />
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
    </button>
  )
})

export default TransactionRow
