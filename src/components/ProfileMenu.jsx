import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, Camera, Trash2, Pencil, UserPlus, Info, Bug, Heart } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import EditProfileNameDialog from './EditProfileNameDialog'

export default function ProfileMenu({ className = '' }) {
  const { user, profile, signOut, updateProfile } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [inviteLoading, setInviteLoading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [inviteInfo, setInviteInfo] = useState('')
  const [showEditName, setShowEditName] = useState(false)
  const fileInputRef = useRef(null)

  const initial = (profile?.display_name || user?.email || 'K')[0].toUpperCase()
  const avatarUrl = profile?.avatar_url || null

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
      // reset the input so the same file can be selected again if needed
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

  async function handleInvite() {
    if (!user || uploading || inviteLoading) return

    setInviteError('')
    setInviteInfo('')
    setInviteLoading(true)

    try {
      const { data, error: createInviteError } = await supabase
        .from('invites')
        .insert({ created_by: user.id })
        .select('token')
        .single()

      if (createInviteError) throw createInviteError

      const token = data?.token
      if (!token) throw new Error('Could not create invite link. Try again.')

      const joinUrl = `${window.location.origin}/join/${token}`

      if (navigator.share) {
        try {
          await navigator.share({
            title: 'Join me on Kosha',
            text: 'Use my invite link to join Kosha.',
            url: joinUrl,
          })
          setInviteInfo('Invite sent successfully.')
        } catch (shareError) {
          if (shareError?.name === 'AbortError') {
            setInviteInfo('Share cancelled.')
          } else {
            throw shareError
          }
        }
        return
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(joinUrl)
        setInviteInfo('Invite link copied to clipboard.')
      } else {
        window.prompt('Copy this invite link:', joinUrl)
        setInviteInfo('Invite link ready to share.')
      }
    } catch (e) {
      setInviteError(e.message || 'Could not create invite right now. Please try again.')
    } finally {
      setInviteLoading(false)
    }
  }

  return (
    <div className={`relative ${className}`.trim()}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-9 h-9 rounded-full bg-brand-container flex items-center
                   justify-center overflow-hidden active:scale-95 transition-transform duration-75"
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={profile?.display_name || user?.email || 'Profile'}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-label font-bold text-brand-on">{initial}</span>
        )}
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.12, ease: 'easeOut' }}
              className="absolute right-0 top-11 z-40 w-56 card p-1.5"
            >
              <div className="px-2.5 py-2 border-b border-kosha-border mb-1 flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-brand-container flex items-center justify-center overflow-hidden shrink-0">
                  {avatarUrl ? (
                    <img
                      src={avatarUrl}
                      alt={profile?.display_name || user?.email || 'Profile'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-label font-bold text-brand-on">{initial}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-label font-semibold text-ink truncate">
                    {profile?.display_name || 'My Account'}
                  </p>
                  <p className="text-caption text-ink-3 truncate">{user?.email}</p>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowEditName(true)
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-chip
                           text-label font-medium text-ink hover:bg-kosha-surface-2 transition-colors"
              >
                <Pencil size={15} />
                Edit profile name
              </button>

              <button
                onClick={handleInvite}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-chip
                           text-label font-medium text-ink hover:bg-kosha-surface-2 transition-colors disabled:opacity-60"
                disabled={uploading || inviteLoading}
              >
                <UserPlus size={15} />
                {inviteLoading ? 'Creating invite...' : 'Invite friends'}
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-chip
                           text-label font-medium text-ink hover:bg-kosha-surface-2 transition-colors disabled:opacity-60"
                disabled={uploading}
              >
                <Camera size={15} />
                {uploading ? 'Updating photo…' : 'Change photo'}
              </button>

              {avatarUrl && (
                <button
                  onClick={handleDeletePhoto}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-chip
               text-label font-medium text-expense-text hover:bg-expense-bg transition-colors disabled:opacity-60"
                  disabled={uploading}
                >
                  <Trash2 size={15} />
                  {uploading ? 'Removing…' : 'Remove photo'}
                </button>
              )}

              {photoError && (
                <p className="px-2.5 pt-1 text-[11px] text-expense-text">
                  {photoError}
                </p>
              )}

              {inviteError && (
                <p className="px-2.5 pt-1 text-[11px] text-expense-text">
                  {inviteError}
                </p>
              )}

              {inviteInfo && (
                <p className="px-2.5 pt-1 text-[11px] text-brand">
                  {inviteInfo}
                </p>
              )}

              <button
                onClick={() => {
                  setOpen(false)
                  const currentPath = `${location.pathname || '/'}${location.search || ''}` || '/'
                  navigate('/report-bug', {
                    state: {
                      source: 'profile-menu',
                      returnTo: currentPath,
                      reportedRoute: currentPath,
                    },
                  })
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-chip
                           text-label font-medium text-ink hover:bg-kosha-surface-2 transition-colors"
              >
                <Bug size={15} />
                Report bug
              </button>

              <button
                onClick={() => {
                  setOpen(false)
                  navigate('/about', { state: { backgroundLocation: location } })
                }}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-chip
                           text-label font-medium text-ink hover:bg-kosha-surface-2 transition-colors"
              >
                <Info size={15} />
                <span className="inline-flex items-center gap-1">
                  About Kosha
                  <Heart size={13} weight="fill" className="text-expense-text" />
                </span>
              </button>

              <button
                onClick={() => { setOpen(false); signOut() }}
                className="mt-1 w-full flex items-center gap-2 px-2.5 py-2 rounded-chip
                           text-label font-medium text-expense-text hover:bg-expense-bg transition-colors"
              >
                <LogOut size={15} /> Sign out
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <EditProfileNameDialog
        open={showEditName}
        onClose={() => setShowEditName(false)}
      />
    </div>
  )
}