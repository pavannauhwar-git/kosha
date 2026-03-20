import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bug, X } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const SEVERITIES = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
]

export default function ReportBugSheet({ open, onClose, onSubmitted }) {
  const { user } = useAuth()
  const location = useLocation()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState('')
  const [severity, setSeverity] = useState('medium')
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) {
      setTitle('')
      setDescription('')
      setSteps('')
      setSeverity('medium')
      setIncludeDiagnostics(true)
      setSaving(false)
      setError('')
    }
  }, [open])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    const cleanTitle = title.trim()
    const cleanDescription = description.trim()
    const cleanSteps = steps.trim()

    if (!cleanTitle) return setError('Please add a short bug title.')
    if (!cleanDescription) return setError('Please describe what went wrong.')

    const route = `${location.pathname}${location.search || ''}`
    const appVersion = import.meta.env.VITE_APP_VERSION || `web-${import.meta.env.MODE || 'prod'}`

    const diagnostics = includeDiagnostics
      ? {
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          language: navigator.language,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
        }
      : null

    setSaving(true)
    try {
      const { data, error: insertError } = await supabase
        .from('bug_reports')
        .insert({
          user_id: user?.id || null,
          title: cleanTitle,
          description: cleanDescription,
          steps: cleanSteps || null,
          severity,
          route,
          app_version: appVersion,
          diagnostics,
        })
        .select('id')
        .single()

      if (insertError) throw insertError

      onSubmitted?.(data?.id)
      onClose()
    } catch (e2) {
      setError(e2.message || 'Could not submit the bug report. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="sheet-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="sheet-panel"
            initial={{ y: '100%' }}
            animate={{ y: 0, transition: { type: 'spring', stiffness: 420, damping: 34 } }}
            exit={{ y: '100%', transition: { duration: 0.2 } }}
          >
            <div className="sheet-handle" />

            <form onSubmit={handleSubmit} className="px-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-chip bg-brand-container flex items-center justify-center">
                    <Bug size={16} className="text-brand" />
                  </div>
                  <h2 className="text-[20px] font-bold text-ink">Report Bug</h2>
                </div>
                <button type="button" onClick={onClose} className="close-btn">
                  <X size={16} className="text-ink-3" />
                </button>
              </div>

              <p className="text-caption text-ink-3 mb-4">
                Share what broke and we will investigate it quickly.
              </p>

              <div className="space-y-3">
                <input
                  className="input"
                  placeholder="Bug title"
                  value={title}
                  maxLength={160}
                  onChange={e => setTitle(e.target.value)}
                />

                <textarea
                  className="input min-h-[104px] resize-none"
                  placeholder="What happened?"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />

                <textarea
                  className="input min-h-[86px] resize-none"
                  placeholder="Steps to reproduce (optional)"
                  value={steps}
                  onChange={e => setSteps(e.target.value)}
                />

                <div>
                  <p className="text-caption text-ink-3 mb-2">Severity</p>
                  <div className="flex gap-2">
                    {SEVERITIES.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSeverity(s.id)}
                        className={`px-3 py-1.5 rounded-pill text-label font-semibold border transition-colors
                          ${severity === s.id
                            ? 'bg-brand-container text-brand-on border-brand-container'
                            : 'bg-kosha-surface text-ink-3 border-kosha-border'}`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIncludeDiagnostics(v => !v)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-card border border-kosha-border bg-kosha-surface"
                >
                  <span className="text-[14px] font-medium text-ink">Include diagnostics</span>
                  <span className={`text-caption font-semibold px-2 py-0.5 rounded-pill
                    ${includeDiagnostics
                      ? 'bg-brand-container text-brand-on'
                      : 'bg-kosha-surface-2 text-ink-3'}`}>
                    {includeDiagnostics ? 'On' : 'Off'}
                  </span>
                </button>

                <p className="text-[11px] text-ink-3 -mt-1">
                  Adds route, browser, device, and app version. No financial entries are attached.
                </p>

                {error && <p className="text-sm text-expense-text">{error}</p>}

                <button
                  type="submit"
                  disabled={saving}
                  className={`w-full py-4 rounded-card font-semibold transition-all
                    ${saving
                      ? 'bg-brand/70 text-white/90 scale-[0.98]'
                      : 'bg-brand text-white active:scale-[0.98]'}`}
                >
                  {saving ? 'Submitting…' : 'Submit report'}
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}