import Button from '../ui/Button'

export default function EmptyState({
  icon,
  imageUrl,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondaryAction,
  className = '',
}) {
  return (
    <div
      className={`card empty-state py-10 px-6 flex flex-col items-center text-center relative overflow-hidden ${className}`.trim()}
    >
      <div className="relative z-10 flex flex-col items-center">
        {imageUrl ? (
          <div className="mb-4 flex min-h-[220px] items-center justify-center fade-up fade-up-1">
            <img
              src={imageUrl}
              alt=""
              aria-hidden="true"
              className="max-h-[220px] w-auto object-contain illustration filter drop-shadow-sm"
              loading="lazy"
              decoding="async"
            />
          </div>
        ) : icon ? (
          <div className="w-16 h-16 rounded-full bg-brand-container flex items-center justify-center mb-4 border border-brand/10 fade-up fade-up-1">
            {icon}
          </div>
        ) : null}

        <p className="text-[17px] font-bold text-ink mb-1.5 leading-tight fade-up fade-up-2">
          {title}
        </p>

        <p className="text-caption text-ink-3 mb-5 max-w-[240px] leading-relaxed fade-up fade-up-3">
          {description}
        </p>

        {(actionLabel && onAction) || (secondaryLabel && onSecondaryAction) ? (
          <div className="flex items-center justify-center gap-2 flex-wrap fade-up fade-up-4">
            {actionLabel && onAction ? (
              <Button variant="primary" size="sm" onClick={onAction}>
                {actionLabel}
              </Button>
            ) : null}

            {secondaryLabel && onSecondaryAction ? (
              <Button variant="secondary" size="sm" onClick={onSecondaryAction}>
                {secondaryLabel}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
