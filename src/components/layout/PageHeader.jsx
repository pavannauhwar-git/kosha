import ProfileMenu from '../navigation/ProfileMenu'

export default function PageHeader({ title, className = 'mb-3' }) {
  return (
    <div
      className={`sticky top-0 z-20 -mx-5 px-5 flex items-center justify-between py-4 header-frosted ${className}`}
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px), 1rem)',
      }}
    >
      <h1 className="text-[24px] sm:text-[26px] md:text-[30px] font-bold text-ink tracking-tight leading-none">{title}</h1>
      <div className="md:hidden">
        <ProfileMenu />
      </div>
    </div>
  )
}
