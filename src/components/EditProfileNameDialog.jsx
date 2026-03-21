import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from '@phosphor-icons/react'
import { useAuth } from '../context/AuthContext'

export default function EditProfileNameDialog({ open, onClose }) {
  const { profile, updateDisplayName } = useAuth()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  // Sync input with current profile name whenever dialog opens
  useEffect(() => {
    if (open) {
      setName(profile?.display_name || '')
      setError('')
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open, profile?.display_name])

  async function handleSave() {
    const trimmed = name.trim()
    if (!trimmed) { setError('Name cannot be empty.'); return }
    setSaving(true)
    setError('')
    try {
      await updateDisplayName(trimmed)
      onClose()
    } catch (e) {
      setError(e.message || 'Could not update name. Try again.')
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-ink/30"
            style={{ backdropFilter: 'blur(2px)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed left-4 right-4 bottom-6 z-50 bg-kosha-surface rounded-hero p-6 shadow-card-lg"
            style={{ maxWidth: 480, margin: '0 auto' }}
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1, transition: { type: 'spring', stiffness: 400, damping: 30 } }}
            exit={{ y: 60, opacity: 0, transition: { duration: 0.2 } }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[18px] font-bold text-ink">Edit Display Name</h2>
              <button onClick={onClose} className="close-btn">
                <X size={16} className="text-ink-3" />
              </button>
            </div>

            <input
              ref={inputRef}
              type="text"
              placeholder="Your display name"
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              onKeyDown={handleKeyDown}
              className="input mb-3"
              maxLength={50}
            />

            {error && (
              <p className="text-caption text-expense-text mb-3">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="btn-ghost flex-1 py-3 rounded-card border border-kosha-border"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !name.trim()}
                className="flex-1 py-3 rounded-card bg-brand text-white font-semibold
                           active:scale-[0.98] disabled:opacity-50 transition-all"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
