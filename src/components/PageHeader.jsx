import ProfileMenu from './ProfileMenu'

export default function PageHeader({ title }) {
  return (
    <div
      className="sticky top-0 z-20 bg-kosha-bg/90 backdrop-blur-md border-b border-kosha-border flex items-center justify-between py-3 mt-4"
      style={{ paddingTop: 'max(env(safe-area-inset-top, 0), 0.75rem)' }}
    >
      <h1 className="text-[24px] md:text-[26px] font-bold text-ink tracking-tight">{title}</h1>
      <div className="md:hidden">
        <ProfileMenu />
      </div>
    </div>
  )
}