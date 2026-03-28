import ProfileMenu from './ProfileMenu'

export default function PageHeader({ title, className = 'mb-4' }) {
  return (
    <div
      className={`sticky top-0 z-20 bg-kosha-bg/85 backdrop-blur-xl border-b border-kosha-border -mx-4 px-4 flex items-center justify-between py-3.5 transition-all ${className}`}
      style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0.75rem)' }}
    >
      <h1 className="text-[22px] sm:text-[24px] font-bold text-ink tracking-tight">{title}</h1>
      <div className="md:hidden">
        <ProfileMenu />
      </div>
    </div>
  )
}
