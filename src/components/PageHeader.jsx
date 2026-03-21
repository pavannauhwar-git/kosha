import ProfileMenu from './ProfileMenu'

//PageHeader
export default function PageHeader({ title }) {
  return (
    <>
      {/* Mobile */}
      <div
        className="sticky top-0 z-20 bg-kosha-bg/90 backdrop-blur-md
                   border-b border-kosha-border
                   flex items-center justify-between
                   px-4 py-3 md:hidden"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
      >
        <h1 className="text-[17px] font-bold text-ink tracking-tight">{title}</h1>
        <ProfileMenu />
      </div>

      {/* Desktop */}
      <div className="hidden md:flex items-center sticky top-0 z-20
                      bg-kosha-bg/90 backdrop-blur-md border-b border-kosha-border
                      px-8 h-[57px]">
        <h1 className="text-[20px] font-bold text-ink tracking-tight">{title}</h1>
      </div>
    </>
  )
}