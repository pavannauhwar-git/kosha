import ProfileMenu from './ProfileMenu'

export default function PageHeader({ title }) {
  return (
    <div
      className="sticky top-0 z-20 bg-kosha-bg/90 backdrop-blur-md
                 border-b border-kosha-border
                 flex items-center justify-between
                 px-4 md:px-8 py-3"
    >
      <h1 className="text-[17px] md:text-[20px] font-bold text-ink tracking-tight">{title}</h1>
      <div className="md:hidden">
        <ProfileMenu />
      </div>
    </div>
  )
}