export default function SectionHeader({
  title,
  subtitle,
  badge,
  rightText,
  className = '',
}) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-start sm:justify-between gap-0 ${className}`.trim()}>
      <div className="min-w-0">
        <p className="section-label">{title}</p>
        {subtitle ? <p className="text-micro text-ink-3 leading-tight mt-px">{subtitle}</p> : null}
      </div>

      {badge ? (
        <span className={`text-caption px-1.5 py-0.5 rounded-full font-semibold self-start ${badge.className || ''}`.trim()}>
          {badge.label}
        </span>
      ) : rightText ? (
        <span className="text-caption text-ink-4 self-start">{rightText}</span>
      ) : null}
    </div>
  )
}
