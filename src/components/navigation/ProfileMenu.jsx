import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings, LogOut, Bug, Info, BookOpen, Link2, Unlink } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { getActiveWalletUserId, setActiveWalletUserId } from '../../lib/walletStore'
import { unlinkPartner } from '../../lib/walletSync'
import { useLocation, useNavigate } from 'react-router-dom'

function MenuRow({ icon, label, onClick, destructive = false, disabled = false }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-chip
                  text-label font-medium transition-colors disabled:opacity-60
                  ${destructive
          ? 'text-expense-text hover:bg-expense-bg'
          : 'text-ink hover:bg-kosha-surface-2'}`}
    >
      <span className="shrink-0 w-4 h-4 flex items-center justify-center">
        {icon}
      </span>
      {label}
    </button>
  )
}

function MenuDivider() {
  return <div className="my-1 h-px bg-kosha-border mx-1" />
}

const MENU_ITEMS = [
  { id: 'settings', icon: <Settings size={15} />, label: 'Account Settings', path: '/settings' },
  { id: 'bug', icon: <Bug size={15} />, label: 'Report a Bug', path: '/report-bug', usesState: true },
  { id: 'about', icon: <Info size={15} />, label: 'About Kosha', path: '/about' },
  { id: 'guide', icon: <BookOpen size={15} />, label: 'Setup Guide', path: '/guide' },
]

const menuItemVariants = {
  hidden: { opacity: 0, x: -6 },
  show: (i) => ({
    opacity: 1,
    x: 0,
    transition: { delay: 0.06 + i * 0.04, duration: 0.18, ease: [0.05, 0.7, 0.1, 1] },
  }),
}

export default function ProfileMenu({ className = '', dropUp = false }) {
  const { user, profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [isUnlinking, setIsUnlinking] = useState(false)

  const initial = (profile?.display_name || user?.email || 'K')[0].toUpperCase()
  const avatarUrl = profile?.avatar_url || null
  const displayName = profile?.display_name || 'My Account'
  const activeWalletUserId = getActiveWalletUserId()
  const { linkedProfiles } = useAuth()
  const isViewingPartner = !!activeWalletUserId && !!user?.id && activeWalletUserId !== user.id
  const activePartner = isViewingPartner ? (linkedProfiles || []).find(p => p.id === activeWalletUserId) : null

  function close() {
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        close()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <div className={`relative ${className}`.trim()}>
      {/* ── Avatar button ────────────────────────────────────────── */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          id="profile-menu-trigger"
          aria-label={open ? 'Close profile menu' : 'Open profile menu'}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls="profile-menu-panel"
          className={`w-9 h-9 rounded-full bg-kosha-surface-2
                     flex items-center justify-center overflow-hidden
                     active:scale-95 transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)]
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/20
                     border border-kosha-border shadow-sm hover:shadow-md transition-shadow
                     ${isViewingPartner ? 'ring-2 ring-warning-text/60 ring-offset-1 ring-offset-kosha-bg' : ''}`}
        >
          {isViewingPartner && activePartner?.avatar_url ? (
            <img src={activePartner.avatar_url} alt={activePartner.display_name} className="w-full h-full object-cover" />
          ) : avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
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

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-30" onClick={close} />

            <motion.div
              id="profile-menu-panel"
              role="menu"
              aria-labelledby="profile-menu-trigger"
              initial={{ opacity: 0, scale: 0.96, y: dropUp ? 8 : -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: dropUp ? 8 : -8 }}
              transition={{ duration: 0.15, ease: [0.05, 0.7, 0.1, 1] }}
              className={`absolute z-40 w-60 card p-1.5 ring-1 ring-black/5 shadow-card-lg ${dropUp ? 'bottom-[calc(100%+0.6rem)] left-0' : 'top-[calc(100%+0.6rem)] right-0'}`}
            >
              {/* ── Identity header ───────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04, duration: 0.18, ease: [0.05, 0.7, 0.1, 1] }}
                className="flex items-center gap-2.5 px-3 py-2.5 mb-1"
              >
                <div className="w-9 h-9 rounded-full bg-kosha-surface-2
                                flex items-center justify-center overflow-hidden shrink-0"
                  style={{ border: '1px solid var(--ds-border)' }}>
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-label font-semibold text-ink">{initial}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-label font-semibold text-ink truncate">{displayName}</p>
                  <p className="text-caption text-ink-3 truncate">{user?.email}</p>
                </div>
              </motion.div>

              {linkedProfiles && linkedProfiles.length > 0 && (
                <>
                  <MenuDivider />
                  <div className="px-3 py-1.5 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-ink-3 uppercase tracking-widest">Active Wallet</span>
                  </div>

                  <motion.div custom={0} variants={menuItemVariants} initial="hidden" animate="show">
                    <button
                      type="button"
                      onClick={() => { close(); setActiveWalletUserId(user?.id) }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-chip text-label font-medium transition-colors ${activeWalletUserId === user?.id ? 'bg-brand-container text-brand' : 'text-ink hover:bg-kosha-surface-2'}`}
                    >
                      <div className="w-4 h-4 rounded-full bg-kosha-surface-2 flex items-center justify-center shrink-0">
                        {activeWalletUserId === user?.id && <div className="w-2 h-2 rounded-full bg-brand" />}
                      </div>
                      <span className="flex-1 text-left truncate">My Wallet</span>
                    </button>
                  </motion.div>

                  {linkedProfiles.map((p, idx) => (
                    <motion.div key={p.id} custom={idx + 1} variants={menuItemVariants} initial="hidden" animate="show">
                      <div className="flex items-stretch pr-2">
                        <button
                          type="button"
                          onClick={() => { close(); setActiveWalletUserId(p.id) }}
                          className={`flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-l-chip text-label font-medium transition-colors ${activeWalletUserId === p.id ? 'bg-brand-container text-brand' : 'text-ink hover:bg-kosha-surface-2'}`}
                        >
                          <div className="w-4 h-4 rounded-full bg-kosha-surface-2 flex items-center justify-center shrink-0 overflow-hidden">
                            {activeWalletUserId === p.id ? (
                              <div className="w-2 h-2 rounded-full bg-brand" />
                            ) : p.avatar_url ? (
                              <img src={p.avatar_url} className="w-full h-full object-cover" alt="" />
                            ) : null}
                          </div>
                          <span className="flex-1 text-left truncate">{p.display_name}</span>
                        </button>
                        <button
                          type="button"
                          disabled={isUnlinking}
                          onClick={async () => {
                            if (confirm(`Are you sure you want to unlink ${p.display_name}? You will no longer be able to access their wallet.`)) {
                              setIsUnlinking(true)
                              try {
                                await unlinkPartner(user.id, p.id)
                                if (activeWalletUserId === p.id) setActiveWalletUserId(user.id)
                                window.location.reload()
                              } catch (e) {
                                alert(e.message)
                              } finally {
                                setIsUnlinking(false)
                              }
                            }
                          }}
                          className="flex items-center justify-center px-3 rounded-r-chip text-expense-text hover:bg-expense-bg transition-colors disabled:opacity-50"
                          title={`Unlink ${p.display_name}`}
                        >
                          <Unlink size={14} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </>
              )}

              <MenuDivider />

              <motion.div custom={linkedProfiles?.length ? linkedProfiles.length + 1 : 0} variants={menuItemVariants} initial="hidden" animate="show">
                <MenuRow
                  icon={<Settings size={15} />}
                  label="Account Settings"
                  onClick={() => { close(); navigate('/settings') }}
                />
              </motion.div>
              <motion.div custom={linkedProfiles?.length ? linkedProfiles.length + 2 : 1} variants={menuItemVariants} initial="hidden" animate="show">
                <MenuRow
                  icon={<Link2 size={15} />}
                  label="Reconciliation"
                  onClick={() => { close(); navigate('/reconciliation') }}
                />
              </motion.div>

              <MenuDivider />

              <motion.div custom={linkedProfiles?.length ? linkedProfiles.length + 3 : 2} variants={menuItemVariants} initial="hidden" animate="show">
                <MenuRow
                  icon={<Bug size={15} />}
                  label="Report a Bug"
                  onClick={() => {
                    close()
                    const currentPath = `${location.pathname}${location.search || ''}`
                    navigate('/report-bug', {
                      state: { source: 'profile-menu', returnTo: currentPath, reportedRoute: currentPath },
                    })
                  }}
                />
              </motion.div>
              <motion.div custom={linkedProfiles?.length ? linkedProfiles.length + 4 : 3} variants={menuItemVariants} initial="hidden" animate="show">
                <MenuRow
                  icon={<Info size={15} />}
                  label="About Kosha"
                  onClick={() => { close(); navigate('/about') }}
                />
              </motion.div>

              <MenuDivider />

              <motion.div custom={linkedProfiles?.length ? linkedProfiles.length + 5 : 4} variants={menuItemVariants} initial="hidden" animate="show">
                <MenuRow
                  icon={<BookOpen size={15} />}
                  label="Setup Guide"
                  onClick={() => { close(); navigate('/guide') }}
                />
              </motion.div>
              <motion.div custom={linkedProfiles?.length ? linkedProfiles.length + 6 : 5} variants={menuItemVariants} initial="hidden" animate="show">
                <MenuRow
                  icon={<LogOut size={15} />}
                  label="Sign Out"
                  onClick={() => { close(); signOut() }}
                  destructive
                />
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
