import ProfileMenu from './ProfileMenu'

export default function PageHeader({ title }) {
  return (
    <div
      className="sticky top-0 z-20 bg-kosha-bg border-b border-kosha-border -mx-4 flex items-center justify-between py-4 mb-6"
      style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0.75rem)' }}
    >
      <h1 className="text-[25px] md:text-[28px] font-bold text-ink tracking-tight leading-none">{title}</h1>
      <div className="md:hidden">
        <ProfileMenu />
      </div>
    </div>
  )
}
