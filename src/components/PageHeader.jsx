import ProfileMenu from './ProfileMenu'

//PageHeader
// before — two divs with md:hidden / hidden md:flex split
export default function PageHeader({ title }) {
  return (
    <>
      {/* Mobile */}
      <div className="... md:hidden">...</div>
      {/* Desktop */}
      <div className="hidden md:flex ...">...</div>
    </>
  )
}

// after — single bar, always visible
export default function PageHeader({ title }) {
  return (
    <div
      className="sticky top-0 z-20 bg-kosha-bg/90 backdrop-blur-md
                 border-b border-kosha-border
                 flex items-center justify-between
                 px-4 md:px-8 py-3"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
    >
      <h1 className="text-[17px] md:text-[20px] font-bold text-ink tracking-tight">{title}</h1>
      <div className="md:hidden">
        <ProfileMenu />
      </div>
    </div>
  )
}