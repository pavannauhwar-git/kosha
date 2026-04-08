import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings, LogOut, Bug, Info, BookOpen } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useLocation, useNavigate } from 'react-router-dom'

function MenuRow({ icon, label, onClick, destructive = false, disabled = false }) {
  return (
    <button
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
    transition: { delay: 0.06 + i * 0.04, duration: 0.18, ease: [0.22, 1, 0.36, 1] },
  }),
}

export default function ProfileMenu({ className = '', dropUp = false }) {
  const { user, profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  const initial = (profile?.display_name || user?.email || 'K')[0].toUpperCase()
  const avatarUrl = profile?.avatar_url || null
  const displayName = profile?.display_name || 'My Account'

  function close() {
    setOpen(false)
  }

  return (
    <div className={`relative ${className}`.trim()}>
      {/* ── Avatar button ────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-9 h-9 rounded-full bg-kosha-surface-2
                   shadow-card flex items-center justify-center overflow-hidden
                   active:scale-95 transition-transform duration-100"
        style={{ border: '1px solid rgba(26,26,46,0.08)' }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-label font-semibold text-ink">{initial}</span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-30" onClick={close} />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: dropUp ? 8 : -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: dropUp ? 8 : -8 }}
              transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
              className={`absolute z-40 w-60 card p-1.5 ring-1 ring-black/5 shadow-card-lg ${dropUp ? 'bottom-[calc(100%+0.6rem)] left-0' : 'top-[calc(100%+0.6rem)] right-0'}`}
            >
              {/* ── Identity header ───────────────────────────────── */}
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04, duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="flex items-center gap-2.5 px-3 py-2.5 mb-1"
              >
                <div className="w-9 h-9 rounded-full bg-kosha-surface-2
                                flex items-center justify-center overflow-hidden shrink-0"
                  style={{ border: '1px solid rgba(26,26,46,0.08)' }}>
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

              <MenuDivider />

              {/* ── Menu items with stagger ───────────────────────── */}
              <motion.div custom={0} variants={menuItemVariants} initial="hidden" animate="show">
                <MenuRow
                  icon={<Settings size={15} />}
                  label="Account Settings"
                  onClick={() => { close(); navigate('/settings') }}
                />
              </motion.div>

              <MenuDivider />

              <motion.div custom={1} variants={menuItemVariants} initial="hidden" animate="show">
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
              <motion.div custom={2} variants={menuItemVariants} initial="hidden" animate="show">
                <MenuRow
                  icon={<Info size={15} />}
                  label="About Kosha"
                  onClick={() => { close(); navigate('/about') }}
                />
              </motion.div>

              <MenuDivider />

              <motion.div custom={3} variants={menuItemVariants} initial="hidden" animate="show">
                <MenuRow
                  icon={<BookOpen size={15} />}
                  label="Setup Guide"
                  onClick={() => { close(); navigate('/guide') }}
                />
              </motion.div>
              <motion.div custom={4} variants={menuItemVariants} initial="hidden" animate="show">
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
