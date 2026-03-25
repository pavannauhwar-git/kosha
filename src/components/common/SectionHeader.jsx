export default function SectionHeader({
  title,
  subtitle,
  badge,
  rightText,
  className = '',
}) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1 ${className}`.trim()}>
      <div className="min-w-0">
        <p className="text-[12px] font-bold tracking-[0.1em] uppercase text-ink-3">{title}</p>
        {subtitle ? <p className="text-[11px] text-ink-3 leading-tight mt-1">{subtitle}</p> : null}
      </div>

      {badge ? (
        <span className={`text-[11px] px-2 py-1 rounded-pill font-semibold self-start ${badge.className || ''}`.trim()}>
          {badge.label}
        </span>
      ) : rightText ? (
        <span className="text-[11px] text-ink-4 self-start">{rightText}</span>
      ) : null}
    </div>
  )
}
