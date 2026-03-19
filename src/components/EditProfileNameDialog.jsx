import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(resolve))
}

export default function EditProfileNameDialog({ open, onClose }) {
  const { profile, user, updateDisplayName } = useAuth()
  const [name, setName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setName(profile?.display_name || user?.user_metadata?.full_name || '')
    setError('')
  }, [open, profile?.display_name, user?.user_metadata?.full_name])

  async function handleSave(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Display name cannot be empty.')
      return
    }

    // Strict pessimistic flow: keep dialog open until write + refetch completes.
    setIsSaving(true)
    setError('')
    try {
      await updateDisplayName(trimmed)
      await nextFrame()
      onClose?.()
    } catch (e) {
      setError(e.message || 'Could not update name. Try again.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-ink/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!isSaving) onClose?.()
            }}
          />

          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 card p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[17px] font-semibold text-ink">Edit Profile Name</h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => {
                  if (!isSaving) onClose?.()
                }}
                disabled={isSaving}
                aria-label="Close"
              >
                <X size={16} className="text-ink-3" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <label className="block text-[12px] font-medium text-ink-3" htmlFor="profile-name-input">
                Display Name
              </label>
              <input
                id="profile-name-input"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                disabled={isSaving}
                maxLength={60}
                className="w-full bg-kosha-surface-2 rounded-card px-4 py-3 text-ink border border-transparent
                           focus:outline-none focus:ring-2 focus:ring-brand-container focus:border-brand-container
                           disabled:opacity-70"
                placeholder="Your name"
              />

              {error && (
                <p className="text-[12px] text-expense-text">{error}</p>
              )}

              <div className="pt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => onClose?.()}
                  disabled={isSaving}
                  className="flex-1 py-2.5 rounded-card border border-kosha-border text-label font-medium text-ink-2
                             bg-kosha-surface hover:bg-kosha-surface-2 transition-colors disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 py-2.5 rounded-card text-label font-semibold text-white bg-brand
                             hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-70
                             flex items-center justify-center gap-2"
                >
                  {isSaving && <Loader2 size={14} className="animate-spin" />}
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
