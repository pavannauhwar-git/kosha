import ProfileMenu from './ProfileMenu'

/**
 * PageHeader
 *
 * Sticky top bar used on all main authenticated pages.
 * Replaces the floating GlobalHeader — ProfileMenu now lives here,
 * anchored to the page rather than floating independently.
 *
 * Usage:
 *   <PageHeader title="Dashboard" />
 */
export default function PageHeader({ title }) {
  return (
    <div
      className="sticky top-0 z-20 bg-kosha-bg/90 backdrop-blur-md
                 border-b border-kosha-border
                 flex items-center justify-between
                 px-4 py-3
                 md:hidden"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
    >
      <h1 className="text-[17px] font-bold text-ink tracking-tight">{title}</h1>
      <ProfileMenu />
    </div>
  )
}
