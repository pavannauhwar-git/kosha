import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Camera, Trash2, Pencil, Check } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import EditProfileNameDialog from '../components/EditProfileNameDialog'
import Divider from '../components/common/Divider'
import { createFadeUp, createStagger } from '../lib/animations'

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

  const initial = (profile?.display_name || user?.email || 'K')[0].toUpperCase()
  const avatarUrl = profile?.avatar_url || null
  const displayName = profile?.display_name || 'My Account'

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

  return (
    <div className="min-h-dvh bg-kosha-bg">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-20 bg-kosha-bg/90 backdrop-blur-md
                   px-4 py-3 flex items-center gap-3 border-b border-kosha-border"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 0.75rem)', paddingBottom: '0.75rem' }}
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
          <motion.div variants={fadeUp} className="flex flex-col items-center gap-3 py-4">
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
            <p className="text-caption font-semibold text-ink-3 uppercase tracking-wider mb-2 px-1">
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

        </motion.div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Edit name dialog */}
      <EditProfileNameDialog
        open={showEditName}
        onClose={() => setShowEditName(false)}
      />
    </div>
  )
}
