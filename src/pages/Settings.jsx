import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Camera, Trash2, Pencil, BellRing, ShieldAlert, Users, User, Copy, Moon, Sun, Home } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import EditProfileNameDialog from '../components/dialogs/EditProfileNameDialog'
import Divider from '../components/common/Divider'
import { createFadeUp, createStagger } from '../lib/animations'
import PageBackHeaderPage from '../components/layout/PageBackHeaderPage'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import {
  getReminderPrefs,
  setReminderPrefs,
  getNotificationPermission,
  requestNotificationPermission,
} from '../lib/reminders'
import { buildJoinInviteUrl, createInvite, deleteInvite, inviteStatusLabel, listInvites, MAX_ACTIVE_INVITES } from '../lib/invites'
import { fmtDate } from '../lib/utils'
import { shareLink } from '../lib/share'

const fadeUp = createFadeUp(6, 0.18)
const stagger = createStagger(0.05, 0.04)
const MAX_AVATAR_BYTES = 5 * 1024 * 1024

function SettingRow({ icon, label, sublabel, onClick, destructive = false, disabled = false, rightElement, toggleState = null }) {
  const toggleA11yProps = typeof toggleState === 'boolean'
    ? {
      role: 'switch',
      'aria-checked': toggleState,
      'aria-pressed': toggleState,
    }
    : {}

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      {...toggleA11yProps}
      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left
                  transition-colors active:bg-kosha-surface-2
                  disabled:opacity-50
                  ${destructive ? 'text-expense-text' : 'text-ink'}`}
    >
      <div className={`w-9 h-9 rounded-chip flex items-center justify-center shrink-0
                       ${destructive ? 'bg-expense-bg' : 'bg-brand-container'}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-[15px] font-medium leading-snug
                       ${destructive ? 'text-expense-text' : 'text-ink'}`}>
          {label}
        </p>
        {sublabel && (
          <p className="text-[12px] text-ink-3 mt-0.5 truncate">{sublabel}</p>
        )}
      </div>
      {rightElement && (
        <div className="shrink-0 text-ink-3">{rightElement}</div>
      )}
    </button>
  )
}

export default function Settings() {
  const navigate = useNavigate()
  const { user, profile, updateProfile, updatePassword, linkedProfiles } = useAuth()
  const fileInputRef = useRef(null)

  const [uploading, setUploading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [showEditName, setShowEditName] = useState(false)
  const [reminderPrefs, setReminderPrefsState] = useState(() => getReminderPrefs())
  const [notificationPermission, setNotificationPermission] = useState(() => getNotificationPermission())
  const [reminderMsg, setReminderMsg] = useState('')
  const [walletInvites, setWalletInvites] = useState([])
  const [walletLoading, setWalletLoading] = useState(false)
  const [walletError, setWalletError] = useState('')
  const [walletMsg, setWalletMsg] = useState('')
  const [creatingInvite, setCreatingInvite] = useState(false)
  const [revokingId, setRevokingId] = useState('')
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'))
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordMsg, setPasswordMsg] = useState('')

  useEffect(() => {
    setReminderPrefs(reminderPrefs)
  }, [reminderPrefs])

  useEffect(() => {
    let cancelled = false

    async function loadWalletInvites() {
      if (!user?.id) return
      setWalletLoading(true)
      setWalletError('')
      try {
        const rows = await listInvites({
          supabaseClient: supabase,
          userId: user.id,
          limit: 50,
        })
        if (!cancelled) setWalletInvites(rows)
      } catch (error) {
        if (!cancelled) setWalletError(error?.message || 'Could not load shared wallet invites.')
      } finally {
        if (!cancelled) setWalletLoading(false)
      }
    }

    void loadWalletInvites()
    return () => { cancelled = true }
  }, [user?.id])

  const initial = (profile?.display_name || user?.email || 'K')[0].toUpperCase()
  const avatarUrl = profile?.avatar_url || null
  const displayName = profile?.display_name || 'My Account'
  const pendingInviteCount = walletInvites.filter((invite) => !invite?.used_by).length
  const inviteCapReached = pendingInviteCount >= MAX_ACTIVE_INVITES

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file || !user) return

    setPhotoError('')

    if (file.size > MAX_AVATAR_BYTES) {
      setPhotoError('Image must be under 5 MB.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `avatars/${user.id}-${Date.now()}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { cacheControl: '3600', upsert: true })
      if (uploadError) throw uploadError

      const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(path)

      const publicUrl = publicUrlData?.publicUrl
      if (!publicUrl) throw new Error('Could not get public URL for avatar.')

      await updateProfile({ avatar_url: publicUrl })
    } catch (e) {
      setPhotoError(e.message || 'Could not update photo. Try again.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleDeletePhoto() {
    setPhotoError('')
    setUploading(true)
    try {
      await updateProfile({ avatar_url: null })
    } catch (e) {
      setPhotoError(e.message || 'Could not remove photo. Try again.')
    } finally {
      setUploading(false)
    }
  }

  function toggleReminderField(field) {
    setReminderPrefsState(prev => ({ ...prev, [field]: !prev[field] }))
  }

  function toggleDarkMode() {
    const next = !isDark
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('kosha-theme', next ? 'dark' : 'light')
    setIsDark(next)
  }

  async function enableNotifications() {
    const permission = await requestNotificationPermission()
    setNotificationPermission(permission)
    if (permission === 'granted') {
      setReminderMsg('Notifications enabled for reminder alerts.')
      setTimeout(() => setReminderMsg(''), 2500)
      return
    }

    if (permission === 'denied') {
      setReminderMsg('Notifications blocked. Enable them from browser settings.')
      setTimeout(() => setReminderMsg(''), 3200)
    }
  }

  async function copyInviteLink(token) {
    const url = buildJoinInviteUrl(token)
    if (!url) return

    const result = await shareLink({
      title: 'Join Wallet on Kosha',
      url: url,
    })

    if (result.success) {
      if (result.method === 'share') {
        // Shared via native sheet
      } else {
        setWalletMsg('Invite link copied.')
        setTimeout(() => setWalletMsg(''), 2200)
      }
    } else if (!result.aborted) {
      setWalletMsg(url)
      setTimeout(() => setWalletMsg(''), 5000)
    }
  }

  async function handleCreateInvite() {
    if (!user?.id || creatingInvite || inviteCapReached) return
    setCreatingInvite(true)
    setWalletError('')
    try {
      const row = await createInvite({ supabaseClient: supabase, userId: user.id })
      setWalletInvites((prev) => [row, ...prev].slice(0, MAX_ACTIVE_INVITES))
      await copyInviteLink(row.token)
    } catch (error) {
      setWalletError(error?.message || 'Could not create invite link.')
    } finally {
      setCreatingInvite(false)
    }
  }

  async function handleRevokeInvite(inviteId) {
    if (!inviteId || revokingId) return
    setRevokingId(inviteId)
    setWalletError('')
    try {
      await deleteInvite({ supabaseClient: supabase, inviteId })
      setWalletInvites((prev) => prev.filter(i => i.id !== inviteId))
    } catch (error) {
      setWalletError(error?.message || 'Could not revoke invite link.')
    } finally {
      setRevokingId('')
    }
  }

  async function handlePasswordUpdate(e) {
    e.preventDefault()
    setPasswordError('')
    setPasswordMsg('')

    if (!newPassword.trim()) {
      setPasswordError('Enter a new password.')
      return
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.')
      return
    }

    setPasswordSaving(true)
    try {
      await updatePassword(newPassword)
      setPasswordMsg('Password updated successfully.')
      setNewPassword('')
      setConfirmPassword('')
      setShowPasswordForm(false)
    } catch (error) {
      setPasswordError(error?.message || 'Could not update password. Try again.')
    } finally {
      setPasswordSaving(false)
    }
  }

  return (
    <PageBackHeaderPage
      title="Account Settings"
      onBack={() => navigate(-1)}
      rightSlot={(
        <button
          type="button"
          onClick={() => navigate('/')}
          className="w-9 h-9 rounded-pill flex items-center justify-center bg-kosha-surface-2 active:bg-kosha-border"
          aria-label="Go to home"
        >
          <Home size={16} className="text-ink-2" />
        </button>
      )}
    >
      <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-4">

        <motion.div variants={fadeUp} className="card p-0 overflow-hidden">
          <div className="px-4 py-4 bg-kosha-surface-2 border-b border-kosha-border">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-brand-container
                                  flex items-center justify-center overflow-hidden
                                  ring-4 ring-kosha-border">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[30px] font-bold text-ink">{initial}</span>
                  )}
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full
                               bg-brand text-white shadow-card
                               flex items-center justify-center
                               active:scale-90 transition-transform duration-75
                               disabled:opacity-60"
                  aria-label="Change photo"
                >
                  <Camera size={14} />
                </button>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[17px] font-bold text-ink truncate">{displayName}</p>
                <p className="text-[12px] text-ink-3 truncate mt-0.5">{user?.email}</p>
                <div className="mt-2 inline-flex items-center gap-2 text-[10px] font-semibold px-2 py-0.5 rounded-pill bg-brand-container text-brand border border-brand/15">
                  <ShieldAlert size={12} /> Private profile
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 space-y-2.5">
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="tonal"
                size="md"
                fullWidth
                icon={<Pencil size={14} />}
                onClick={() => setShowEditName(true)}
              >
                Edit name
              </Button>

              <Button
                variant="primary"
                size="md"
                fullWidth
                icon={<Camera size={14} />}
                onClick={() => fileInputRef.current?.click()}
                loading={uploading}
              >
                Change photo
              </Button>
            </div>

            {avatarUrl && (
              <Button
                variant="danger"
                size="md"
                fullWidth
                icon={<Trash2 size={15} />}
                onClick={handleDeletePhoto}
                loading={uploading}
              >
                Remove photo
              </Button>
            )}

            {photoError && (
              <p className="text-[12px] text-expense-text">{photoError}</p>
            )}
          </div>
        </motion.div>

        {/* ── Appearance section ──────────────────────────────────── */}
        <motion.div variants={fadeUp}>
          <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-[0.08em] mb-2 px-1">
            Appearance
          </p>
          <div className="card overflow-hidden p-0">
            <SettingRow
              icon={isDark ? <Moon size={16} className="text-accent-text" /> : <Sun size={16} className="text-accent-text" />}
              label="Dark mode"
              sublabel={isDark ? 'Currently dark' : 'Currently light'}
              onClick={toggleDarkMode}
              toggleState={isDark}
              rightElement={<span className={`text-[10px] font-semibold px-2 py-0.5 rounded-pill ${isDark ? 'bg-brand-container text-brand' : 'bg-kosha-surface-2 text-ink-3'}`}>{isDark ? 'ON' : 'OFF'}</span>}
            />
          </div>
        </motion.div>

        {/* ── Security section ────────────────────────────────────── */}
        <motion.div variants={fadeUp}>
          <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-[0.08em] mb-2 px-1">
            Security
          </p>
          <div className="card overflow-hidden p-0">
            <SettingRow
              icon={<ShieldAlert size={16} className="text-accent-text" />}
              label="Change password"
              sublabel="Update the password used for sign in"
              onClick={() => {
                setShowPasswordForm((prev) => !prev)
                setPasswordError('')
                setPasswordMsg('')
              }}
              rightElement={(
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-pill ${showPasswordForm ? 'bg-brand-container text-brand' : 'bg-kosha-surface-2 text-ink-3'}`}>
                  {showPasswordForm ? 'OPEN' : 'CLOSED'}
                </span>
              )}
            />

            {showPasswordForm && (
              <>
                <Divider />
                <form onSubmit={handlePasswordUpdate} className="px-4 py-3 space-y-3">
                  <input
                    type="email"
                    name="username"
                    autoComplete="username"
                    value={user?.email || ''}
                    readOnly
                    tabIndex={-1}
                    aria-hidden="true"
                    className="sr-only"
                  />

                  <Input
                    label="New password"
                    name="new-password"
                    type="password"
                    placeholder="At least 8 characters"
                    helperText="Min 8 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    disabled={passwordSaving}
                  />

                  <Input
                    label="Confirm new password"
                    name="confirm-new-password"
                    type="password"
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    disabled={passwordSaving}
                  />

                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    fullWidth
                    loading={passwordSaving}
                  >
                    Update password
                  </Button>
                </form>
              </>
            )}
          </div>

          {(passwordError || passwordMsg) && (
            <p className={`text-[12px] mt-2 px-1 ${passwordError ? 'text-expense-text' : 'text-ink-3'}`}>
              {passwordError || passwordMsg}
            </p>
          )}
        </motion.div>

        {/* ── Reminders section ───────────────────────────────────── */}
        <motion.div variants={fadeUp}>
          <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-[0.08em] mb-2 px-1">
            Reminders
          </p>
          <div className="card overflow-hidden p-0">
            <div className="px-4 py-3 bg-kosha-surface-2 border-b border-kosha-border flex items-center justify-between gap-2">
              <div>
                <p className="text-[13px] font-semibold text-ink">Reminder engine</p>
                <p className="text-[11px] text-ink-3 mt-0.5">Controls for due alerts and pace warnings</p>
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-pill ${reminderPrefs.enabled ? 'bg-income-bg text-income-text' : 'bg-kosha-surface text-ink-3 border border-kosha-border'}`}>
                {reminderPrefs.enabled ? 'Active' : 'Paused'}
              </span>
            </div>

            <SettingRow
              icon={<BellRing size={16} className="text-accent-text" />}
              label="Enable reminders"
              sublabel="Turn reminder notifications on or off"
              onClick={() => toggleReminderField('enabled')}
              toggleState={reminderPrefs.enabled}
              rightElement={<span className="text-[11px] font-semibold">{reminderPrefs.enabled ? 'ON' : 'OFF'}</span>}
            />
            <Divider />
            <SettingRow
              icon={<BellRing size={16} className="text-accent-text" />}
              label="Bills due alerts"
              sublabel="Daily reminder when bills are near due"
              onClick={() => toggleReminderField('bill_due')}
              disabled={!reminderPrefs.enabled}
              toggleState={reminderPrefs.bill_due}
              rightElement={<span className="text-[11px] font-semibold">{reminderPrefs.bill_due ? 'ON' : 'OFF'}</span>}
            />
            <Divider />
            <SettingRow
              icon={<ShieldAlert size={16} className="text-accent-text" />}
              label="Spending pace alerts"
              sublabel="Warn when spending runs above month pace"
              onClick={() => toggleReminderField('spending_pace')}
              disabled={!reminderPrefs.enabled}
              toggleState={reminderPrefs.spending_pace}
              rightElement={<span className="text-[11px] font-semibold">{reminderPrefs.spending_pace ? 'ON' : 'OFF'}</span>}
            />
            <Divider />
            <SettingRow
              icon={<BellRing size={16} className="text-accent-text" />}
              label="Notification permission"
              sublabel={`Current: ${notificationPermission}`}
              onClick={enableNotifications}
              rightElement={<span className="text-[11px] font-semibold">Request</span>}
            />
          </div>
          {reminderMsg && (
            <p className="text-[12px] text-ink-3 mt-2 px-1">{reminderMsg}</p>
          )}
        </motion.div>

        {/* ── Linked wallets section ────────────────────────────────── */}
        <motion.div variants={fadeUp}>
          <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-[0.08em] mb-2 px-1">
            Linked Wallets
          </p>
          <div className="card overflow-hidden p-0 mb-6">
            {linkedProfiles.length === 0 ? (
              <div className="px-4 py-8 text-center bg-kosha-surface-2">
                <div className="w-10 h-10 rounded-full bg-kosha-surface flex items-center justify-center mx-auto mb-3">
                  <Users size={18} className="text-ink-3" />
                </div>
                <p className="text-[13px] font-semibold text-ink">No linked wallets yet</p>
                <p className="text-[11px] text-ink-3 mt-1 px-4">
                  Pair with a partner or family member to sync your transactions and balances.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-kosha-border bg-white">
                {linkedProfiles.map((lp) => (
                  <div key={lp.id} className="px-4 py-3.5 flex items-center justify-between gap-3 bg-kosha-surface-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-brand-container flex items-center justify-center overflow-hidden border border-brand-border">
                        {lp.avatar_url ? (
                          <img src={lp.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User size={16} className="text-brand" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold text-ink leading-tight truncate">{lp.display_name}</p>
                        <p className="text-[10px] text-ink-3 mt-1 flex items-center gap-1.5 uppercase font-bold tracking-wider">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                          Live Sync Active
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Invite to link section ───────────────────────────────── */}
        <motion.div variants={fadeUp}>
          <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-[0.08em] mb-2 px-1">
            Invite to Link Wallet
          </p>
          <div className="card overflow-hidden p-0 mb-6">
            <div className="px-4 py-3.5 bg-kosha-surface-2 border-b border-kosha-border flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-ink">Generate link</p>
                <p className="text-[11px] text-ink-3 mt-0.5">Invite others to sync their wallet with yours.</p>
              </div>
              <Button
                variant="primary"
                size="sm"
                icon={<Users size={14} />}
                onClick={() => { void handleCreateInvite() }}
                disabled={inviteCapReached}
                loading={creatingInvite}
                className="shrink-0"
              >
                Invite
              </Button>
            </div>

            <div className="px-4 py-3 space-y-2">
              <p className="text-[12px] font-semibold text-ink-3">Recent invites ({pendingInviteCount}/{MAX_ACTIVE_INVITES} active)</p>
              {walletLoading ? (
                <p className="text-[12px] text-ink-3">Loading invites…</p>
              ) : walletInvites.length === 0 ? (
                <p className="text-[12px] text-ink-3">No invite links yet.</p>
              ) : (
                walletInvites.map((invite) => {
                  const status = inviteStatusLabel(invite)
                  return (
                    <div key={invite.id} className="mini-panel px-2.5 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] text-ink-3">{fmtDate(invite.created_at)}</p>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${status === 'Joined' ? 'bg-income-bg text-income-text' : 'bg-warning-bg text-warning-text'}`}>
                          {status}
                        </span>
                      </div>
                      <p className="text-[11px] text-ink-2 mt-1 truncate">{buildJoinInviteUrl(invite.token)}</p>
                      <div className="flex items-center gap-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-1.5 px-0 h-auto text-[11px] text-brand font-semibold"
                          icon={<Copy size={12} />}
                          onClick={() => { void copyInviteLink(invite.token) }}
                        >
                          Copy link
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-1.5 px-0 h-auto text-[11px] text-expense-text font-semibold"
                          icon={<Trash2 size={12} />}
                          onClick={() => { void handleRevokeInvite(invite.id) }}
                          loading={revokingId === invite.id}
                        >
                          Remove link
                        </Button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
          {inviteCapReached && (
            <p className="text-[12px] text-ink-3 mt-2 px-1">
              Revoke or use existing invite links to create new ones. Maximum {MAX_ACTIVE_INVITES} active invites are allowed.
            </p>
          )}
          {(walletMsg || walletError) && (
            <p className={`text-[12px] mt-2 px-1 ${walletError ? 'text-expense-text' : 'text-ink-3'}`}>
              {walletError || walletMsg}
            </p>
          )}
        </motion.div>

        {/* ── Share Kosha section ─────────────────────────────────── */}
        <motion.div variants={fadeUp}>
          <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-[0.08em] mb-2 px-1">
            Share Kosha
          </p>
          <div className="card p-4 flex items-center justify-between gap-4 mb-6">
            <div>
              <p className="text-[13px] font-semibold text-ink">Invite Friends</p>
              <p className="text-[11px] text-ink-3 mt-0.5">Help others track their finances with Kosha.</p>
            </div>
            <Button 
              variant="primary" 
              size="sm" 
              className="h-8 px-4"
              onClick={async () => {
                try {
                  await shareLink({
                    url: window.location.origin
                  })
                } catch (e) {
                  console.error('Share failed', e)
                }
              }}
            >
              Share App
            </Button>
          </div>
        </motion.div>
      </motion.div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        name="avatar-upload"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Edit name dialog */}
      <EditProfileNameDialog
        open={showEditName}
        onClose={() => setShowEditName(false)}
      />
    </PageBackHeaderPage>
  )
}
