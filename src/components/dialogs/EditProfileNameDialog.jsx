import { useState, useEffect, useRef } from 'react'
import { captureMutationError } from '../../lib/errorReporting'
import { useAuth } from '../../context/AuthContext'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Sheet from '../ui/Sheet'

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
      captureMutationError(e, { context: 'profile:updateName' })
      setError(e.message || 'Could not update name. Try again.')
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') handleSave()
  }

    return (<Sheet
      open={open}
      onClose={saving ? () => {} : onClose}
      variant="center"
      title="Edit Display Name"
      dismissOnBackdrop={!saving}
      showClose={!saving}
      initialFocusSelector="input,[contenteditable]"
    >
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

      <div className="flex gap-3 mt-4">
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
    </Sheet>)
}
