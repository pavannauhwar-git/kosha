import ProfileMenu from './ProfileMenu'

export default function PageHeader({ title }) {
  return (
    <div
      className="sticky top-0 z-20 bg-kosha-bg/82 backdrop-blur-md border border-kosha-border/70 rounded-card px-4 flex items-center justify-between py-3.5 mb-5 shadow-card"
      style={{ marginTop: 'max(env(safe-area-inset-top, 0px), 0.35rem)' }}
    >
      <h1 className="text-[24px] md:text-[28px] font-bold text-ink tracking-tight leading-none">{title}</h1>
      <div className="md:hidden">
        <ProfileMenu />
      </div>
    </div>
  )
}
