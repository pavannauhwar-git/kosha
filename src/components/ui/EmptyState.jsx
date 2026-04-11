import { Package } from '@phosphor-icons/react'
import Button from './Button'

/**
 * EmptyState — shown when lists have no data. Includes icon, text, and CTA.
 * @param {{ icon?: React.ReactNode, title: string, description?: string, action?: { label: string, onClick: function }, secondaryAction?: { label: string, onClick: function }, className?: string }} props
 */
export default function EmptyState({ icon, title, description, action, secondaryAction, className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-16 px-6 ${className}`}>
      <div className="w-16 h-16 rounded-2xl bg-[var(--ds-primary-container)] flex items-center justify-center mb-5">
        {icon || <Package size={28} weight="duotone" className="text-[var(--ds-primary)]" />}
      </div>

      <h3 className="text-lg font-bold text-[var(--ds-text)] mb-2">
        {title}
      </h3>

      {description && (
        <p className="text-label text-[var(--ds-text-tertiary)] max-w-[280px] mb-6">
          {description}
        </p>
      )}

      {(action || secondaryAction) && (
        <div className="flex items-center gap-3">
          {action && (
            <Button
              onClick={action.onClick}
              variant="primary"
              size="md"
              type="button"
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              onClick={secondaryAction.onClick}
              variant="ghost"
              size="md"
              type="button"
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
