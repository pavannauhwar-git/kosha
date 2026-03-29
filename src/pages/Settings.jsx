import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Camera, Trash2, Pencil, Check, BellRing, ShieldAlert, Users, Link2, Copy, FileArchive, Upload, Download, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import EditProfileNameDialog from '../components/dialogs/EditProfileNameDialog'
import Divider from '../components/common/Divider'
import { createFadeUp, createStagger } from '../lib/animations'
import {
  getReminderPrefs,
  setReminderPrefs,
  getNotificationPermission,
  requestNotificationPermission,
} from '../lib/reminders'
import { buildJoinInviteUrl, createInvite, inviteStatusLabel, listInvites, MAX_ACTIVE_INVITES } from '../lib/invites'
import { fmtDate } from '../lib/utils'
import useFileUploads from '../hooks/useFileUploads'

const fadeUp = createFadeUp(6, 0.18)
const stagger = createStagger(0.05, 0.04)

function SettingRow({ icon, label, sublabel, onClick, destructive = false, disabled = false, rightElement }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
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
  const { user, profile, updateProfile } = useAuth()
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

  const { files: uploads, loading: uploadsLoading, uploadFile, deleteFile, downloadFile, refresh: refreshUploads } = useFileUploads()
  const zipInputRef = useRef(null)
  const [uploadingZip, setUploadingZip] = useState(false)
  const [uploadMsg, setUploadMsg] = useState('')
  const [uploadMsgType, setUploadMsgType] = useState('info')
  const [deletingId, setDeletingId] = useState(null)

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
          limit: MAX_ACTIVE_INVITES,
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

    try {
      await navigator.clipboard.writeText(url)
      setWalletMsg('Invite link copied.')
      setTimeout(() => setWalletMsg(''), 2200)
    } catch {
      setWalletMsg('Could not copy automatically. Share manually from this screen.')
      setTimeout(() => setWalletMsg(''), 3000)
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

  function showUploadMsg(msg, type = 'info') {
    setUploadMsg(msg)
    setUploadMsgType(type)
    setTimeout(() => setUploadMsg(''), 3000)
  }

  async function handleZipUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingZip(true)
    try {
      await uploadFile(file)
      showUploadMsg('File uploaded successfully.')
    } catch (err) {
      showUploadMsg(err.message || 'Upload failed.', 'error')
    } finally {
      setUploadingZip(false)
      if (zipInputRef.current) zipInputRef.current.value = ''
    }
  }

  async function handleDeleteUpload(upload) {
    setDeletingId(upload.id)
    try {
      await deleteFile(upload)
      showUploadMsg('File deleted.')
    } catch (err) {
      showUploadMsg(err.message || 'Could not delete file.', 'error')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleDownload(upload) {
    try {
      await downloadFile(upload)
    } catch (err) {
      showUploadMsg(err.message || 'Download failed.', 'error')
    }
  }

  function fmtSize(bytes) {
    if (!bytes) return '0 B'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} MB`
  }

  return (
    <div className="min-h-dvh bg-kosha-bg">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-20 bg-kosha-bg/90 backdrop-blur-md
                   px-4 py-3 flex items-center gap-3 border-b border-kosha-border"
        style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 0.75rem)', paddingBottom: '0.75rem' }}
      >
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-kosha-surface border border-kosha-border
                     flex items-center justify-center active:bg-kosha-surface-2"
        >
          <ArrowLeft size={16} className="text-ink-2" />
        </button>
        <h1 className="text-[17px] font-bold text-ink tracking-tight">Account Settings</h1>
      </div>

      <div className="px-4 pt-6 pb-24 max-w-[560px] mx-auto">
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">

          {/* ── Avatar ───────────────────────────────────────────────── */}
          <motion.div variants={fadeUp} className="card p-5 flex flex-col items-center gap-3">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-brand-container
                              flex items-center justify-center overflow-hidden
                              ring-4 ring-kosha-border">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-[36px] font-bold text-brand">{initial}</span>
                )}
              </div>
              {/* Camera badge */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full
                           bg-brand text-white shadow-card
                           flex items-center justify-center
                           active:scale-90 transition-transform duration-75
                           disabled:opacity-60"
              >
                <Camera size={14} />
              </button>
            </div>
            <div className="text-center">
              <p className="text-[16px] font-bold text-ink">{displayName}</p>
              <p className="text-caption text-ink-3">{user?.email}</p>
            </div>
            {photoError && (
              <p className="text-[12px] text-expense-text text-center">{photoError}</p>
            )}
          </motion.div>

          {/* ── Profile section ─────────────────────────────────────── */}
          <motion.div variants={fadeUp}>
            <p className="text-[11px] font-bold text-ink-3 uppercase tracking-[0.08em] mb-2 px-1">
              Profile
            </p>
            <div className="card overflow-hidden p-0">
              <SettingRow
                icon={<Pencil size={16} className="text-brand" />}
                label="Display Name"
                sublabel={displayName}
                onClick={() => setShowEditName(true)}
              />
              <Divider />
              <SettingRow
                icon={<Camera size={16} className="text-brand" />}
                label={uploading ? 'Updating photo…' : 'Change Photo'}
                sublabel="JPG, PNG or WebP"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              />
              {avatarUrl && (
                <>
                  <Divider />
                  <SettingRow
                    icon={<Trash2 size={16} className="text-expense-text" />}
                    label="Remove Photo"
                    onClick={handleDeletePhoto}
                    disabled={uploading}
                    destructive
                  />
                </>
              )}
            </div>
          </motion.div>

          {/* ── Reminders section ───────────────────────────────────── */}
          <motion.div variants={fadeUp}>
            <p className="text-[11px] font-bold text-ink-3 uppercase tracking-[0.08em] mb-2 px-1">
              Reminders
            </p>
            <div className="card overflow-hidden p-0">
              <SettingRow
                icon={<BellRing size={16} className="text-brand" />}
                label="Enable reminders"
                sublabel="Turn reminder notifications on or off"
                onClick={() => toggleReminderField('enabled')}
                rightElement={<span className="text-[11px] font-semibold">{reminderPrefs.enabled ? 'ON' : 'OFF'}</span>}
              />
              <Divider />
              <SettingRow
                icon={<BellRing size={16} className="text-brand" />}
                label="Bills due alerts"
                sublabel="Daily reminder when bills are near due"
                onClick={() => toggleReminderField('bill_due')}
                disabled={!reminderPrefs.enabled}
                rightElement={<span className="text-[11px] font-semibold">{reminderPrefs.bill_due ? 'ON' : 'OFF'}</span>}
              />
              <Divider />
              <SettingRow
                icon={<ShieldAlert size={16} className="text-brand" />}
                label="Spending pace alerts"
                sublabel="Warn when spending runs above month pace"
                onClick={() => toggleReminderField('spending_pace')}
                disabled={!reminderPrefs.enabled}
                rightElement={<span className="text-[11px] font-semibold">{reminderPrefs.spending_pace ? 'ON' : 'OFF'}</span>}
              />
              <Divider />
              <SettingRow
                icon={<BellRing size={16} className="text-brand" />}
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

          {/* ── Shared wallet section ───────────────────────────────── */}
          <motion.div variants={fadeUp}>
            <p className="text-[11px] font-bold text-ink-3 uppercase tracking-[0.08em] mb-2 px-1">
              Shared Wallet
            </p>
            <div className="card overflow-hidden p-0">
              <SettingRow
                icon={<Users size={16} className="text-brand" />}
                label={creatingInvite ? 'Creating invite…' : inviteCapReached ? 'Invite limit reached' : 'Create invite link'}
                sublabel={inviteCapReached ? `Only ${MAX_ACTIVE_INVITES} active links allowed. Reuse an existing link.` : 'Invite a partner to join your wallet workflow'}
                onClick={() => { void handleCreateInvite() }}
                disabled={creatingInvite || inviteCapReached}
                rightElement={<Link2 size={14} />}
              />
              <Divider />
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
                      <div key={invite.id} className="rounded-card border border-kosha-border bg-kosha-surface px-2.5 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[11px] text-ink-3">{fmtDate(invite.created_at)}</p>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${status === 'Joined' ? 'bg-income-bg text-income-text' : 'bg-warning-bg text-warning-text'}`}>
                            {status}
                          </span>
                        </div>
                        <p className="text-[11px] text-ink-2 mt-1 truncate">{buildJoinInviteUrl(invite.token)}</p>
                        <button
                          type="button"
                          className="text-[11px] mt-1.5 text-brand font-semibold inline-flex items-center gap-1"
                          onClick={() => { void copyInviteLink(invite.token) }}
                        >
                          <Copy size={12} /> Copy link
                        </button>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
            {(walletMsg || walletError) && (
              <p className={`text-[12px] mt-2 px-1 ${walletError ? 'text-expense-text' : 'text-ink-3'}`}>
                {walletError || walletMsg}
              </p>
            )}
          </motion.div>

          {/* ── File uploads section ───────────────────────────────────── */}
          <motion.div variants={fadeUp}>
            <p className="text-[11px] font-bold text-ink-3 uppercase tracking-[0.08em] mb-2 px-1">
              File Uploads
            </p>
            <div className="card overflow-hidden p-0">
              <SettingRow
              icon={uploadingZip
                ? <Loader2 size={16} className="text-brand animate-spin" />
                : <Upload size={16} className="text-brand" />}
              label={uploadingZip ? 'Uploading…' : 'Upload a zip file'}
              sublabel="Max 5 MB per file"
              onClick={() => zipInputRef.current?.click()}
              disabled={uploadingZip}
            />
            <Divider />
              <div className="px-4 py-3 space-y-2">
                <p className="text-[12px] font-semibold text-ink-3">
                  Your files {!uploadsLoading && `(${uploads.length})`}
                </p>
                {uploadsLoading ? (
                  <p className="text-[12px] text-ink-3">Loading files…</p>
                ) : uploads.length === 0 ? (
                  <p className="text-[12px] text-ink-3">No files uploaded yet.</p>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {uploads.map((u) => {
                      return (
                        <motion.div
                          key={u.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -40 }}
                          transition={{ duration: 0.2 }}
                          className="rounded-card border border-kosha-border bg-kosha-surface px-3 py-2.5"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-chip bg-brand-container flex items-center justify-center shrink-0">
                              <FileArchive size={14} className="text-brand" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium text-ink truncate">{u.file_name}</p>
                              <p className="text-[11px] text-ink-3">{fmtSize(u.size_bytes)} {fmtDate(u.created_at)}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => handleDownload(u)}
                                className="w-7 h-7 rounded-full flex items-center justify-center text-brand hover:bg-brand-container active:bg-brand-container transition-colors"
                                title="Download"
                              >
                                <Download size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteUpload(u)}
                                disabled={deletingId === u.id}
                                className="w-7 h-7 rounded-full flex items-center justify-center text-expense-text hover:bg-expense-bg active:bg-expense-bg transition-colors disabled:opacity-50"
                                title="Delete"
                              >
                                {deletingId === u.id
                                  ? <Loader2 size={14} className="animate-spin" />
                                  : <Trash2 size={14} />}
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                )}
              </div>
            </div>
            {uploadMsg && (
              <p className={`text-[12px] mt-2 px-1 ${uploadMsgType === 'error' ? 'text-expense-text' : 'text-ink-3'}`}>
                {uploadMsg}
              </p>
            )}
          </motion.div>
        </motion.div>
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={zipInputRef}
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={handleZipUpload}
      />

      {/* Edit name dialog */}
      <EditProfileNameDialog
        open={showEditName}
        onClose={() => setShowEditName(false)}
      />
    </div>
  )
}
