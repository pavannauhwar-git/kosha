import ProfileMenu from '../navigation/ProfileMenu'

export default function PageHeader({
  title,
  className = 'mb-3',
  leftSlot = null,
  rightSlot = null,
}) {
  return (
    <div
      className={`app-topbar -mx-4 px-4 py-3 flex items-center gap-3 ${className}`.trim()}
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px), 0.75rem)',
        paddingBottom: '0.75rem',
      }}
    >
      {leftSlot ? <div className="shrink-0">{leftSlot}</div> : null}

      <h1 className="text-[17px] font-bold text-ink tracking-tight flex-1 truncate">{title}</h1>

      {rightSlot ? (
        <div className="shrink-0">{rightSlot}</div>
      ) : (
        <div className="shrink-0">
          <ProfileMenu />
        </div>
      )}
    </div>
  )
}
