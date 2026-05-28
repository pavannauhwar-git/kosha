import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from '@phosphor-icons/react'
import { useAuth } from '../../context/AuthContext'
import Button from '../ui/Button'
import Input from '../ui/Input'

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
      await updateDisplayName(trimmed) // must strictly await mutation+refetch
      onClose()
    } catch (e) {
      setError(e.message || 'Could not update name. Try again.')
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape' && !saving) onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-black/40"
            style={{ backdropFilter: 'blur(2px)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={saving ? undefined : onClose}
          />
          <motion.div
            className="fixed left-4 right-4 bottom-6 z-50 bg-kosha-surface rounded-hero p-6 shadow-card-lg"
            style={{
              maxWidth: 480,
              margin: '0 auto',
              bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))',
            }}
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1, transition: { type: 'spring', stiffness: 500, damping: 40 } }}
            exit={{ y: 60, opacity: 0, transition: { duration: 0.2 } }}
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[18px] font-bold text-ink">Edit Display Name</h2>
              <button
                type="button"
                aria-label="Close edit display name dialog"
                onClick={saving ? undefined : onClose}
                className="close-btn"
                disabled={saving}
              >
                <X size={16} className="text-ink-3" />
              </button>
            </div>

            <Input
              ref={inputRef}
              placeholder="Your display name"
              value={name}
              onChange={e => { setName(e.target.value); setError('') }}
              onKeyDown={handleKeyDown}
              error={error || undefined}
              maxLength={50}
              disabled={saving}
              className="mb-3"
            />

            <div className="flex gap-3">
              <Button
                variant="ghost"
                fullWidth
                onClick={saving ? undefined : onClose}
                disabled={saving}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                fullWidth
                onClick={handleSave}
                disabled={!name.trim()}
                loading={saving}
                className="flex-1"
              >
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
