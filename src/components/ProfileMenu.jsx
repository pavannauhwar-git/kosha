import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Settings, UserPlus, LogOut, Bug, Info, BookOpen } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

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

export default function ProfileMenu({ className = '', dropUp = false }) {
  const { user, profile, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')

  const initial = (profile?.display_name || user?.email || 'K')[0].toUpperCase()
  const avatarUrl = profile?.avatar_url || null
  const displayName = profile?.display_name || 'My Account'

  function close() {
    setOpen(false)
    setInviteMsg('')
  }

  async function handleInvite() {
    if (!user || inviteLoading) return
    setInviteMsg('')
    setInviteLoading(true)
    try {
      const { data, error } = await supabase
        .from('invites')
        .insert({ created_by: user.id })
        .select('token')
        .single()

      if (error) throw error
      const joinUrl = `${window.location.origin}/join/${data.token}`

      if (navigator.share) {
        await navigator.share({ title: 'Join me on Kosha', url: joinUrl }).catch(() => {})
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(joinUrl)
        setInviteMsg('Invite link copied!')
      } else {
        window.prompt('Copy invite link:', joinUrl)
      }
    } catch (e) {
      setInviteMsg('Could not create invite. Try again.')
    } finally {
      setInviteLoading(false)
    }
  }

  return (
    <div className={`relative ${className}`.trim()}>
      {/* ── Avatar button ────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-9 h-9 rounded-full bg-brand-container border border-brand-border/70
                   shadow-card flex items-center justify-center overflow-hidden
                   active:scale-95 transition-transform duration-75"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={displayName}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-label font-bold text-brand-on">{initial}</span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div className="fixed inset-0 z-30" onClick={close} />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -8 }}
              transition={{ duration: 0.12, ease: 'easeOut' }}
              className={`absolute z-40 w-60 card p-1.5 ring-1 ring-black/5 shadow-card-lg ${dropUp ? 'bottom-[calc(100%+0.6rem)] left-0' : 'top-[calc(100%+0.6rem)] right-0'}`}
            >
              {/* ── Identity header ───────────────────────────────── */}
              <div className="flex items-center gap-2.5 px-3 py-2.5 mb-1">
                <div className="w-9 h-9 rounded-full bg-brand-container
                                flex items-center justify-center overflow-hidden shrink-0">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-label font-bold text-brand-on">{initial}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-label font-semibold text-ink truncate">{displayName}</p>
                  <p className="text-caption text-ink-3 truncate">{user?.email}</p>
                </div>
              </div>

              <MenuDivider />

              {/* ── Group 1: Account ──────────────────────────────── */}
              <MenuRow
                icon={<Settings size={15} />}
                label="Account Settings"
                onClick={() => { close(); navigate('/settings') }}
              />
              <MenuRow
                icon={<UserPlus size={15} />}
                label={inviteLoading ? 'Creating invite…' : 'Invite Friends'}
                onClick={handleInvite}
                disabled={inviteLoading}
              />
              {inviteMsg && (
                <p className="text-[11px] px-3 pb-1 text-brand">{inviteMsg}</p>
              )}

              <MenuDivider />

              {/* ── Group 2: App ──────────────────────────────────── */}
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
              <MenuRow
                icon={<BookOpen size={15} />}
                label="Setup Guide"
                onClick={() => { close(); navigate('/guide') }}
              />
              <MenuRow
                icon={<Info size={15} />}
                label="About Kosha"
                onClick={() => { close(); navigate('/about') }}
              />

              <MenuDivider />

              {/* ── Group 3: Sign out ─────────────────────────────── */}
              <MenuRow
                icon={<LogOut size={15} />}
                label="Sign Out"
                onClick={() => { close(); signOut() }}
                destructive
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
