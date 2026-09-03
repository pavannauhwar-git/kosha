import { Archive } from '@phosphor-icons/react'
import { memo } from 'react'
import EmptyState from '../common/EmptyState'

const GroupList = memo(function GroupList({
  groupStats,
  showArchived,
  setShowArchived,
  visibleGroups,
  authUserId,
  setActiveGroupId,
  readBannerFromStorage,
  BANNERS,
  fmtDate,
  _isViewingPartner,
}) {
  return (
    <div className="page-stack">
      <div className="grid grid-cols-2 gap-2.5">
        <div className="card p-3">
          <p className="text-[10px] text-ink-3">Admin in</p>
          <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
            <p className="text-[15px] font-semibold text-ink tabular-nums">{groupStats.adminActive} active</p>
            {groupStats.adminArchived > 0 && (
              <p className="text-[11px] text-ink-3 tabular-nums">· {groupStats.adminArchived} archived</p>
            )}
          </div>
        </div>
        <div className="card p-3">
          <p className="text-[10px] text-ink-3">Member in</p>
          <div className="mt-1 flex items-baseline gap-1.5 flex-wrap">
            <p className="text-[15px] font-semibold text-ink tabular-nums">{groupStats.memberActive} active</p>
            {groupStats.memberArchived > 0 && (
              <p className="text-[11px] text-ink-3 tabular-nums">· {groupStats.memberArchived} archived</p>
            )}
          </div>
        </div>
      </div>

      <div className="card p-3.5">
        <div className="flex items-center justify-between mb-2">
          <p className="section-label">Open a trip</p>
          <button
            onClick={() => setShowArchived(p => !p)}
            className="text-[11px] font-semibold text-ink-3 border border-kosha-border rounded-pill px-2 pl-1.5 py-0.5 hover:bg-kosha-surface-2 flex items-center gap-1 transition-colors"
          >
            <Archive size={10} /> {showArchived ? 'Hide Archived' : 'Show Archived'}
          </button>
        </div>
        <div className="space-y-2">
          {visibleGroups.length === 0 ? (
            <EmptyState
              className="py-6"
              imageUrl="/illustrations/splitwise_group.webp"
              title={showArchived ? "No archived groups" : "No active groups"}
              description={showArchived ? "You don't have any archived groups." : "Create or join a new group."}
            />
          ) : visibleGroups.map((group) => {
            const isAdmin = group.my_role === 'admin' || group.user_id === authUserId
            const bgBannerId = group.banner_id || readBannerFromStorage(group.id) || 'goa'
            const bgBanner = BANNERS.find(b => b.id === bgBannerId) || BANNERS[0]
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => setActiveGroupId(group.id)}
                className="relative w-full h-24 overflow-hidden rounded-card text-left hover:scale-[1.02] transition-transform shadow-sm"
              >
                <div className="absolute inset-0 z-0">
                  <img src={bgBanner.src} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
                </div>
                <div className="relative z-10 px-3.5 py-3 h-full flex flex-col justify-between">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-bold text-white shadow-sm">{group.name}</p>
                      <p className="mt-0.5 text-[11px] font-medium text-white/80">
                        Updated {fmtDate(group.updated_at || group.created_at)}
                      </p>
                    </div>
                    <span
                      className={`rounded-pill px-2 py-0.5 text-[10px] font-semibold border ${group.is_archived
                        ? 'bg-kosha-border/60 text-white/70 border-white/10 backdrop-blur-md'
                        : isAdmin
                          ? 'bg-black/40 text-white border-white/20 backdrop-blur-md'
                          : 'bg-black/40 text-white/70 border-white/10 backdrop-blur-md'
                        }`}
                    >
                      {group.is_archived
                        ? `Archived · Was ${isAdmin ? 'Admin' : group.my_role === 'member' ? 'Member' : 'Viewer'}`
                        : (isAdmin ? 'Admin' : group.my_role === 'member' ? 'Member' : 'Viewer')}
                    </span>
                  </div>
                  <p className="text-[10px] font-medium text-white/70 shadow-sm">Tap to view balances, expenses, and settlements.</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
})

export default GroupList
