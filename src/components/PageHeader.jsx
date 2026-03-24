import ProfileMenu from './ProfileMenu'

export default function PageHeader({ title }) {
  return (
    <div
      className="sticky top-0 z-20 bg-kosha-bg/92 backdrop-blur-sm border-b border-kosha-border/80 flex items-center justify-between py-3.5 mb-5"
      style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0.7rem)' }}
    >
      <h1 className="text-[24px] md:text-[27px] font-bold text-ink tracking-tight leading-none">{title}</h1>
      <div className="md:hidden">
        <ProfileMenu />
      </div>
    </div>
  )
}
