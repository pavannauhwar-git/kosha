export default function SectionHeader({
  title,
  subtitle,
  badge,
  rightText,
  className = '',
}) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 ${className}`.trim()}>
      <div className="min-w-0">
        <p className="section-label">{title}</p>
        {subtitle ? <p className="text-caption text-ink-3 mt-0.5">{subtitle}</p> : null}
      </div>

      {badge ? (
        <span className={`text-xs px-2 py-1 rounded-full font-semibold self-start ${badge.className || ''}`.trim()}>
          {badge.label}
        </span>
      ) : rightText ? (
        <span className="text-caption text-ink-4 self-start">{rightText}</span>
      ) : null}
    </div>
  )
}
