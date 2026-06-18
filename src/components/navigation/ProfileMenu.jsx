import { useState, useEffect, useCallback, useRef } from 'react'
import Popover from '@mui/material/Popover'
import Fade from '@mui/material/Fade'
import { SignOut, Bug, Info, BookOpen, LinkSimple } from '@phosphor-icons/react'
import { useAuth } from '../../context/AuthContext'
import { useActiveWallet, setActiveWalletUserId } from '../../lib/walletStore'
import { unlinkPartner } from '../../lib/walletSync'
import { useLocation, useNavigate } from 'react-router-dom'
import SecureAvatar from '../ui/SecureAvatar'
import Button from '../ui/Button'

function getAnchorPosition(anchorNode, dropUp) {
  if (!anchorNode || typeof anchorNode.getBoundingClientRect !== 'function') return null
  const rect = anchorNode.getBoundingClientRect()
  return {
    top: dropUp ? rect.top : rect.bottom,
    left: rect.right,
  }
}

function MenuItem({ icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 text-left rounded-chip
                 transition-all duration-150 text-ink hover:bg-kosha-surface-2 active:scale-[0.98] select-none"
    >
      <div className="w-8 h-8 rounded-chip flex items-center justify-center shrink-0 bg-brand-container text-brand">
        {icon}
      </div>
      <span className="text-[13px] font-semibold">{label}</span>
    </button>
  )
}

export default function ProfileMenu({ className = '', dropUp = false }) {
  const { user, profile, signOut, linkedProfiles, reloadLinkedData } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [anchorPosition, setAnchorPosition] = useState(null)
  const [unlinkingId, setUnlinkingId] = useState('')
  const closeRafRef = useRef(null)

  const initial = (profile?.display_name || user?.email || 'K')[0].toUpperCase()
  const avatarUrl = profile?.avatar_url || null
  const displayName = profile?.display_name || 'My Account'
  const activeWalletUserId = useActiveWallet()
  const isViewingPartner = !!activeWalletUserId && !!user?.id && activeWalletUserId !== user.id
  const activePartner = isViewingPartner ? (linkedProfiles || []).find(p => p.id === activeWalletUserId) : null

  const handleOpen = (event) => {
    if (menuOpen) {
      setMenuOpen(false)
      return
    }
    const target = event.currentTarget
    setAnchorPosition(getAnchorPosition(target, dropUp))
    setMenuOpen(true)
  }

  const handleClose = () => {
    setMenuOpen(false)
  }

  const open = menuOpen
  const id = open ? 'profile-popover' : undefined
  const scheduleClose = useCallback(() => {
    if (closeRafRef.current) return
    closeRafRef.current = requestAnimationFrame(() => {
      closeRafRef.current = null
      setMenuOpen(false)
    })
  }, [])
  const closeOnViewportChange = useCallback(() => {
    scheduleClose()
  }, [scheduleClose])

  useEffect(() => {
    if (!open) return undefined

    window.addEventListener('scroll', closeOnViewportChange, { passive: true, capture: true })
    window.addEventListener('resize', closeOnViewportChange, { passive: true })

    const visualViewport = window.visualViewport
    visualViewport?.addEventListener('resize', closeOnViewportChange)
    visualViewport?.addEventListener('scroll', closeOnViewportChange)

    return () => {
      if (closeRafRef.current) {
        cancelAnimationFrame(closeRafRef.current)
        closeRafRef.current = null
      }
      window.removeEventListener('scroll', closeOnViewportChange, true)
      window.removeEventListener('resize', closeOnViewportChange)
      visualViewport?.removeEventListener('resize', closeOnViewportChange)
      visualViewport?.removeEventListener('scroll', closeOnViewportChange)
    }
  }, [open, closeOnViewportChange])

  return (
    <div className={`${className} inline-block`.trim()}>
      {/* ── Trigger Avatar Button ────────────────────────────────── */}
      <div className="relative">
        <button
          type="button"
          onClick={handleOpen}
          aria-describedby={id}
          aria-label={open ? 'Close profile menu' : 'Open profile menu'}
          className={`w-9 h-9 rounded-full bg-kosha-surface-2
                     flex items-center justify-center overflow-hidden
                     active:scale-95 transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)]
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/20
                     border border-kosha-border shadow-sm hover:shadow-md transition-shadow
                     ${isViewingPartner ? 'ring-2 ring-warning-text/60 ring-offset-1 ring-offset-kosha-bg' : ''}`}
        >
          {isViewingPartner && activePartner?.avatar_url ? (
            <SecureAvatar
              src={activePartner.avatar_url}
              alt={activePartner.display_name}
              fallbackInitial={activePartner.display_name?.[0]?.toUpperCase()}
              version={activePartner.updated_at || activePartner.avatar_url}
              className="w-full h-full object-cover"
            />
          ) : avatarUrl ? (
            <SecureAvatar
              src={avatarUrl}
              alt={displayName}
              fallbackInitial={initial}
              version={profile?.updated_at || avatarUrl}
              className="w-full h-full object-cover"
            />
          ) : isViewingPartner && activePartner?.display_name ? (
            <span className="text-label font-semibold" style={{ color: 'var(--ds-warning)' }}>
              {activePartner.display_name[0].toUpperCase()}
            </span>
          ) : (
            <span className="text-label font-semibold text-ink">{initial}</span>
          )}
        </button>
        {isViewingPartner && (
          <span
            className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-kosha-bg"
            style={{ background: 'var(--ds-warning)' }}
          />
        )}
      </div>

      {/* ── Profile popover ───────────────────────────────────────────── */}
      <Popover
        id={id}
        open={open}
        anchorReference="anchorPosition"
        anchorPosition={anchorPosition || { top: 0, left: 0 }}
        onClose={handleClose}
        disableScrollLock
        marginThreshold={0}
        slots={{ transition: Fade }}
        transformOrigin={{
          vertical: dropUp ? 'bottom' : 'top',
          horizontal: 'right',
        }}
        slotProps={{
          transition: { timeout: { enter: 200, exit: 150 } },
          paper: {
            className: 'bg-kosha-surface border border-kosha-border rounded-hero shadow-card-md overflow-hidden',
            sx: {
              mt: 1.5,
              mr: 0,
              mb: dropUp ? 1.5 : 0,
              width: '300px',
              maxWidth: 'calc(100vw - 2rem)',
              backgroundImage: 'none',
            },
          },
        }}
      >
        {/* Identity Section (Centered Header Card) */}
        <div className="pt-4 px-4 pb-4 flex flex-col items-center text-center">
          <div className="relative mb-2">
            <div className="w-16 h-16 rounded-full bg-brand-container text-brand flex items-center justify-center overflow-hidden border border-brand/15 text-[22px] font-bold shrink-0">
              {avatarUrl ? (
                <SecureAvatar
                  src={avatarUrl}
                  alt={displayName}
                  fallbackInitial={initial}
                  version={profile?.updated_at || avatarUrl}
                  className="w-full h-full object-cover"
                />
              ) : (
                initial
              )}
            </div>
          </div>
          <p className="text-[16px] font-bold text-ink leading-tight tracking-tight mt-1">
            {displayName}
          </p>
          <p className="text-[12px] text-ink-3 mt-0.5 mb-2.5 truncate w-full max-w-[240px]">
            {user?.email}
          </p>
          <Button
            variant="secondary"
            size="xs"
            onClick={() => {
              handleClose()
              navigate('/settings')
            }}
          >
            Manage your Account
          </Button>
        </div>

        <div className="border-t border-kosha-border" />

        {/* Wallets & Sync Section (if partner linked) */}
        {linkedProfiles && linkedProfiles.length > 0 && (
          <div className="px-3 py-2">
            <p className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-3">
              Active Wallet
            </p>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => {
                  handleClose()
                  setActiveWalletUserId(user?.id)
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-chip transition-colors text-left
                            ${activeWalletUserId === user?.id
                              ? 'bg-brand-container'
                              : 'text-ink hover:bg-kosha-surface-2 active:bg-kosha-border'
                            }`}
                style={{
                  color: activeWalletUserId === user?.id ? 'var(--ds-on-primary-container)' : undefined
                }}
              >
                <div className="w-4 h-4 rounded-full border border-kosha-border-strong flex items-center justify-center shrink-0">
                  {activeWalletUserId === user?.id && (
                    <div className="w-2 h-2 rounded-full bg-brand" />
                  )}
                </div>
                <span className="text-[13px] font-semibold flex-1">My Wallet</span>
              </button>

              {linkedProfiles.map((p) => (
                <div
                  key={p.id}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-chip transition-colors
                              ${activeWalletUserId === p.id
                                ? 'bg-brand-container'
                                : 'text-ink hover:bg-kosha-surface-2 active:bg-kosha-border'
                              }`}
                  style={{
                    color: activeWalletUserId === p.id ? 'var(--ds-on-primary-container)' : undefined
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      handleClose()
                      setActiveWalletUserId(p.id)
                    }}
                    className="flex-1 flex items-center gap-3 text-left min-w-0"
                  >
                    <div className="w-4 h-4 rounded-full border border-kosha-border-strong flex items-center justify-center shrink-0">
                      {activeWalletUserId === p.id && (
                        <div className="w-2 h-2 rounded-full bg-brand" />
                      )}
                    </div>
                    <div className="w-5 h-5 rounded-full overflow-hidden border border-kosha-border bg-kosha-surface-2 flex items-center justify-center shrink-0">
                      {p.avatar_url ? (
                        <SecureAvatar
                          src={p.avatar_url}
                          fallbackInitial={p.display_name?.[0]?.toUpperCase()}
                          version={p.updated_at || p.avatar_url}
                          className="w-full h-full object-cover"
                          alt={p.display_name || ''}
                        />
                      ) : (
                        <span className="text-[10px] font-bold text-ink-3">
                          {p.display_name?.[0]?.toUpperCase() || '?'}
                        </span>
                      )}
                    </div>
                    <span className="text-[13px] font-semibold truncate">{p.display_name}</span>
                  </button>

                  <Button
                    variant="ghost"
                    size="xs"
                    loading={unlinkingId === p.id}
                    onClick={async (e) => {
                      e.stopPropagation()
                      if (confirm(`Unlink ${p.display_name}? You will no longer access their wallet.`)) {
                        setUnlinkingId(p.id)
                        try {
                          await unlinkPartner(user.id, p.id)
                          if (activeWalletUserId === p.id) setActiveWalletUserId(user.id)
                          await reloadLinkedData?.()
                        } catch (e) {
                          alert(e.message)
                        } finally {
                          setUnlinkingId('')
                        }
                      }
                    }}
                    className="shrink-0 text-expense hover:bg-expense-bg h-7 px-2"
                  >
                    Unlink
                  </Button>
                </div>
              ))}
            </div>
            <div className="border-t border-kosha-border my-2" />
          </div>
        )}

        {/* Drawer Options List */}
        <div className="px-2 pb-2 flex flex-col gap-0.5">
          <MenuItem
            icon={<LinkSimple size={16} />}
            label="Reconciliation"
            onClick={() => {
              handleClose()
              navigate('/reconciliation')
            }}
          />
          <MenuItem
            icon={<Bug size={16} />}
            label="Report a Bug"
            onClick={() => {
              handleClose()
              const currentPath = `${location.pathname}${location.search || ''}`
              navigate('/report-bug', {
                state: { source: 'profile-menu', returnTo: currentPath, reportedRoute: currentPath },
              })
            }}
          />
          <MenuItem
            icon={<Info size={16} />}
            label="About Kosha"
            onClick={() => {
              handleClose()
              navigate('/about')
            }}
          />
          <MenuItem
            icon={<BookOpen size={16} />}
            label="Setup Guide"
            onClick={() => {
              handleClose()
              navigate('/guide')
            }}
          />
        </div>

        <div className="border-t border-kosha-border" />

        {/* Footer Center Signout Button */}
        <div className="p-3 flex justify-center">
          <Button
            onClick={() => {
              handleClose()
              signOut()
            }}
            variant="secondary"
            fullWidth
            icon={<SignOut size={16} />}
            style={{
              '--md-outlined-button-outline-color': 'var(--ds-border)',
              '--md-outlined-button-label-text-color': 'var(--ds-expense-text)',
              '--md-outlined-button-hover-label-text-color': 'var(--ds-expense-text)',
              '--md-outlined-button-focus-label-text-color': 'var(--ds-expense-text)',
              '--md-outlined-button-pressed-label-text-color': 'var(--ds-expense-text)',
              '--md-outlined-button-hover-state-layer-color': 'var(--ds-expense-text)',
              '--md-outlined-button-pressed-state-layer-color': 'var(--ds-expense-text)',
            }}
          >
            Sign out of your account
          </Button>
        </div>
      </Popover>
    </div>
  )
}
