import { useEffect, useMemo, useState } from 'react'
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

function normalizeText(v) {
  return String(v || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function buildFingerprint({ route, severity, title, description }) {
  const base = [
    normalizeText(route),
    normalizeText(severity),
    normalizeText(title).slice(0, 120),
    normalizeText(description).slice(0, 180),
  ].join('|')

  // Tiny deterministic hash for duplicate clustering.
  let hash = 0
  for (let i = 0; i < base.length; i += 1) {
    hash = ((hash << 5) - hash) + base.charCodeAt(i)
    hash |= 0
  }
  return `fp_${Math.abs(hash)}`
}

function parseTags(input) {
  return String(input || '')
    .split(',')
    .map(t => t.trim().toLowerCase().replace(/[^a-z0-9_-]/g, ''))
    .filter(Boolean)
    .slice(0, 6)
}

function fileSizeLabel(bytes) {
  if (!bytes) return '0 B'
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

async function compressImage(file) {
  if (!file || !file.type?.startsWith('image/')) return file
  if (file.size <= 1.2 * 1024 * 1024) return file

  try {
    if (typeof createImageBitmap !== 'function') return file

    const bitmap = await createImageBitmap(file)
    const maxW = 1600
    const scale = Math.min(1, maxW / bitmap.width)
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return file
    }

    ctx.drawImage(bitmap, 0, 0, width, height)

    const blob = await new Promise(resolve => {
      canvas.toBlob(resolve, 'image/jpeg', 0.78)
    })

    bitmap.close()
    return blob || file
  } catch {
    return file
  }
}

export default function ReportBugSheet({ open, onClose, onSubmitted }) {
  const { user } = useAuth()
  const location = useLocation()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [reporterEmail, setReporterEmail] = useState('')
  const [screenshot, setScreenshot] = useState(null)
  const [severity, setSeverity] = useState('medium')
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const parsedTags = useMemo(() => parseTags(tagsInput), [tagsInput])

  useEffect(() => {
    if (open) {
      setReporterEmail(user?.email || '')
      return
    }

    if (!open) {
      setTitle('')
      setDescription('')
      setSteps('')
      setTagsInput('')
      setReporterEmail(user?.email || '')
      setScreenshot(null)
      setSeverity('medium')
      setIncludeDiagnostics(true)
      setSaving(false)
      setError('')
    }
  }, [open, user?.email])

  async function uploadScreenshot() {
    if (!screenshot || !user?.id) return null

    const prepared = await compressImage(screenshot)
    const ext = (screenshot.name?.split('.').pop() || 'jpg').toLowerCase()
    const path = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('bug-reports')
      .upload(path, prepared, {
        cacheControl: '3600',
        upsert: false,
        contentType: prepared?.type || screenshot.type || 'image/jpeg',
      })

    if (uploadError) throw uploadError
    return path
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!user?.id) {
      setError('Please sign in to submit a bug report.')
      return
    }

    const cleanTitle = title.trim()
    const cleanDescription = description.trim()
    const cleanSteps = steps.trim()
    const cleanEmail = reporterEmail.trim()

    if (!cleanTitle) return setError('Please add a short bug title.')
    if (!cleanDescription) return setError('Please describe what went wrong.')
    if (cleanEmail && !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      return setError('Please enter a valid contact email or leave it empty.')
    }

    const route = `${location.pathname}${location.search || ''}`
    const appVersion = import.meta.env.VITE_APP_VERSION || `web-${import.meta.env.MODE || 'prod'}`
    const fingerprint = buildFingerprint({
      route,
      severity,
      title: cleanTitle,
      description: cleanDescription,
    })

    const environment = {
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      pixelRatio: window.devicePixelRatio || 1,
      platform: navigator.platform,
      language: navigator.language,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      online: navigator.onLine,
    }

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
      const screenshotPath = await uploadScreenshot()

      const { data, error: submitError } = await supabase
        .rpc('submit_bug_report', {
          p_title: cleanTitle,
          p_description: cleanDescription,
          p_steps: cleanSteps || null,
          p_severity: severity,
          p_route: route,
          p_app_version: appVersion,
          p_diagnostics: diagnostics,
          p_environment: environment,
          p_screenshot_path: screenshotPath,
          p_reporter_email: cleanEmail || null,
          p_fingerprint: fingerprint,
          p_tags: parsedTags,
        })
        .single()

      if (submitError) throw submitError

      const reportId = data?.report_id
      const isDuplicate = Boolean(data?.is_duplicate)
      const occurrenceCount = Number(data?.occurrence_count || 1)

      // Fire-and-forget notifier; report submission should not fail if this misses.
      if (reportId) {
        void supabase.functions.invoke('bug-report-notify', {
          body: { reportId },
        }).catch(() => {})
      }

      onSubmitted?.({ id: reportId, isDuplicate, occurrenceCount })
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
            style={{ maxHeight: 'min(94dvh, calc(100dvh - env(safe-area-inset-top, 0px) - 10px))' }}
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

                <input
                  className="input"
                  type="email"
                  placeholder="Contact email (optional)"
                  value={reporterEmail}
                  onChange={e => setReporterEmail(e.target.value)}
                />

                <input
                  className="input"
                  placeholder="Tags (optional, comma-separated: ui, crash, chart)"
                  value={tagsInput}
                  onChange={e => setTagsInput(e.target.value)}
                />

                {parsedTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {parsedTags.map(tag => (
                      <span
                        key={tag}
                        className="text-[11px] font-semibold text-brand-on bg-brand-container px-2 py-0.5 rounded-pill"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="card-inset p-3 border border-kosha-border">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-ink">Screenshot (optional)</p>
                      {screenshot ? (
                        <p className="text-[11px] text-ink-3 truncate">
                          {screenshot.name} · {fileSizeLabel(screenshot.size)}
                        </p>
                      ) : (
                        <p className="text-[11px] text-ink-3">Attach a screenshot to speed up triage.</p>
                      )}
                    </div>
                    <label className="shrink-0 px-3 py-1.5 rounded-pill border border-kosha-border bg-kosha-surface text-label font-semibold text-ink cursor-pointer">
                      {screenshot ? 'Replace' : 'Attach'}
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={e => setScreenshot(e.target.files?.[0] || null)}
                      />
                    </label>
                  </div>
                  {screenshot && (
                    <button
                      type="button"
                      onClick={() => setScreenshot(null)}
                      className="mt-2 text-[11px] font-semibold text-expense-text"
                    >
                      Remove screenshot
                    </button>
                  )}
                </div>

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