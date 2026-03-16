import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, Camera } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

export default function ProfileMenu() {
  const { user, profile, signOut, updateProfile } = useAuth()
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  const initial = (profile?.display_name || user?.email || 'K')[0].toUpperCase()
  const avatarUrl = profile?.avatar_url || null

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file || !user) return

    setError('')
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
      setError(e.message || 'Could not update photo. Try again.')
    } finally {
      setUploading(false)
      // reset the input so the same file can be selected again if needed
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="relative">
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
              initial={{ opacity:0, scale:0.95, y:-4 }}
              animate={{ opacity:1, scale:1,    y:0   }}
              exit={{    opacity:0, scale:0.95, y:-4  }}
              transition={{ duration:0.12, ease:'easeOut' }}
              className="absolute right-0 top-11 z-40 w-60 card p-2"
            >
              <div className="px-3 py-2.5 border-b border-kosha-border mb-1 flex items-center gap-3">
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
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-chip
                           text-label font-medium text-ink hover:bg-kosha-surface-2 transition-colors disabled:opacity-60"
                disabled={uploading}
              >
                <Camera size={15} />
                {uploading ? 'Updating photo…' : 'Change photo'}
              </button>

              {error && (
                <p className="px-3 pt-1 text-[11px] text-expense-text">
                  {error}
                </p>
              )}

              <button
                onClick={() => { setOpen(false); signOut() }}
                className="mt-1 w-full flex items-center gap-2.5 px-3 py-2.5 rounded-chip
                           text-label font-medium text-expense-text hover:bg-expense-bg transition-colors"
              >
                <LogOut size={15} /> Sign out
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

