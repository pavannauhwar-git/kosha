export default function SectionHeader({
  title,
  subtitle,
  badge,
  rightText,
  className = '',
}) {
  return (
    <div className={`flex items-start justify-between gap-2 ${className}`.trim()}>
      <div className="min-w-0">
        <p className="section-label">{title}</p>
        {subtitle ? <p className="text-[10.5px] text-ink-3 leading-tight mt-px">{subtitle}</p> : null}
      </div>

      {badge ? (
        <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 whitespace-nowrap ${badge.className || ''}`.trim()}>
          {badge.label}
        </span>
      ) : rightText ? (
        <span className="text-[11px] text-ink-4 shrink-0 whitespace-nowrap">{rightText}</span>
      ) : null}
    </div>
  )
}
