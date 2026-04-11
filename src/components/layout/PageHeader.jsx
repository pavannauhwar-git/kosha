import ProfileMenu from '../navigation/ProfileMenu'

export default function PageHeader({
  title,
  className = 'mb-3',
  leftSlot = null,
  rightSlot = null,
}) {
  return (
    <div
      className={`app-topbar app-topbar--bleed ${className}`.trim()}
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px), 0px)',
      }}
    >
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
