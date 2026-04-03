import ProfileMenu from '../navigation/ProfileMenu'

export default function PageHeader({ title, className = 'mb-3' }) {
  return (
    <div
      className={`sticky top-0 z-20 bg-kosha-bg border-b border-kosha-border -mx-4 px-4 flex items-center justify-between py-3 ${className}`}
      style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0.75rem)' }}
    >
      <h1 className="text-[21px] sm:text-[22px] md:text-[26px] font-bold text-ink tracking-tight leading-none">{title}</h1>
      <div className="md:hidden">
        <ProfileMenu />
      </div>
    </div>
  )
}
