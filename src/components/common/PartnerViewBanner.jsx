import { Eye } from '@phosphor-icons/react'
import { useActiveWallet } from '../../lib/walletStore'
import { getAuthUserId } from '../../lib/authStore'
import { useAuth } from '../../context/AuthContext'

export default function PartnerViewBanner() {
  const activeWalletUserId = useActiveWallet()
  const isViewingPartner = !!activeWalletUserId && activeWalletUserId !== getAuthUserId()
  const { linkedProfiles } = useAuth()
  const activePartnerProfile = isViewingPartner
    ? (linkedProfiles || []).find(p => p.id === activeWalletUserId)
    : null

  if (!isViewingPartner || !activePartnerProfile) return null

  return (
    <div
      className="fixed bottom-safe-bottom-nav left-0 right-0 mx-auto max-w-md px-4 pb-4 z-20 pointer-events-none"
      style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}
    >
      <div className="flex items-center justify-center gap-2 px-4 py-2 rounded-pill bg-warning-bg border border-warning-border shadow-md pointer-events-auto">
        <Eye size={13} className="text-warning-text shrink-0" />
        <span className="text-[11px] font-semibold text-warning-text">
          Viewing {activePartnerProfile.display_name}&apos;s wallet — read only
        </span>
      </div>
    </div>
  )
}
