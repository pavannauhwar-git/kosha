export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondaryAction,
  className = '',
}) {
  return (
    <div className={`oneui-glass oneui-squircle empty-state py-10 px-6 flex flex-col items-center text-center ${className}`.trim()}>
      {icon ? (
        <div className="w-16 h-16 rounded-[20px] bg-kosha-surface-2 border border-kosha-border flex items-center justify-center mb-4">
          {icon}
        </div>
      ) : null}

      <p className="text-[17px] font-bold text-ink mb-2">{title}</p>
      <p className="text-label text-ink-3 mb-5 max-w-[240px] leading-relaxed">{description}</p>

      {(actionLabel && onAction) || (secondaryLabel && onSecondaryAction) ? (
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {actionLabel && onAction ? (
            <button
              type="button"
              onClick={onAction}
              className="px-6 py-2.5 rounded-pill bg-brand text-white text-label font-semibold active:scale-[0.97] transition-transform duration-75 shadow-glass"
            >
              {actionLabel}
            </button>
          ) : null}

          {secondaryLabel && onSecondaryAction ? (
            <button
              type="button"
              onClick={onSecondaryAction}
              className="px-4 py-2.5 rounded-pill bg-kosha-surface border border-kosha-border text-label font-semibold text-ink-2 active:scale-[0.97] transition-transform duration-75"
            >
              {secondaryLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
