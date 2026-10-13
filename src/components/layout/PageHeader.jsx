import ProfileMenu from '../navigation/ProfileMenu'

export default function PageHeader({
  title,
  className = 'mb-3',
  leftSlot = null,
  rightSlot = null,
}) {
  return (
    <div className={`app-topbar ${className}`.trim()}>
      {/* Explicit safe-area fill — paints a solid surface color behind the iOS status bar.
          This prevents iOS 17+ from applying its automatic blur/frosted treatment
          to the zone between the status bar and the first content element. */}
      <div className="app-topbar-safe-fill" aria-hidden="true" />
      <div className="app-topbar-inner">
        {leftSlot ? <div className="shrink-0">{leftSlot}</div> : null}

        <h1 className="text-[17px] font-bold leading-tight text-ink tracking-tight flex-1 truncate">{title}</h1>

        {rightSlot ? (
          <div className="shrink-0">{rightSlot}</div>
        ) : (
          <div className="shrink-0">
            <ProfileMenu />
          </div>
        )}
      </div>
    </div>
  )
}
