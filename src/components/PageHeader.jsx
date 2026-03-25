import ProfileMenu from './ProfileMenu'

export default function PageHeader({
  title,
  subtitle,
  eyebrow,
  className = 'mb-3',
  variant = 'sticky',
}) {
  if (variant === 'oneui-hero') {
    return (
      <header
        className={`relative -mx-4 px-4 pt-4 pb-7 min-h-[34vh] md:min-h-[38vh] flex flex-col justify-end ${className}`}
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 1.4rem)' }}
      >
        <div className="absolute inset-x-0 top-0 h-[70%] bg-gradient-to-b from-brand/12 via-brand-accent/6 to-transparent pointer-events-none" />
        <div className="relative z-[1] max-w-full">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              {eyebrow ? (
                <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-3 mb-3">{eyebrow}</p>
              ) : null}
              <h1 className="oneui-title text-ink m-0">{title}</h1>
              {subtitle ? <p className="text-label text-ink-3 mt-1.5 max-w-[28rem]">{subtitle}</p> : null}
            </div>
            <div className="md:hidden shrink-0 mt-1.5">
              <div className="oneui-glass oneui-squircle p-1.5">
                <ProfileMenu />
              </div>
            </div>
          </div>
        </div>
      </header>
    )
  }

  return (
    <div
      className={`sticky top-0 z-20 bg-kosha-bg border-b border-kosha-border -mx-4 px-4 flex items-center justify-between py-3 ${className}`}
      style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0.75rem)' }}
    >
      <h1 className="text-[21px] sm:text-[22px] md:text-[26px] font-bold text-ink tracking-tight leading-none">{title}</h1>
      <div className="md:hidden">
        <ProfileMenu />
      </div>
    </div>
  )
}
