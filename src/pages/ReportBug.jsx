import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Bug, Check, Copy, Home, LogIn } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import PageBackHeader from '../components/layout/PageBackHeader'
import {
  buildFingerprint,
  parseTags,
  formatReportedScreen,
  fileSizeLabel,
  compressImage,
} from '../lib/bugReportUtils'

const SEVERITIES = [
  { id: 'low', label: 'Low' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High' },
]

const RUNTIME_PREFILL_KEY = 'kosha-runtime-bug-prefill'

export default function ReportBug() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const searchParams = new URLSearchParams(location.search)
  const source = location.state?.source || searchParams.get('source') || 'direct'
  const returnTo = location.state?.returnTo || null
  const initialReportedRouteRaw = location.state?.reportedRoute || searchParams.get('route') || returnTo || null
  const initialReportedRoute = String(initialReportedRouteRaw || '').trim() || (source === 'profile-menu' ? '/' : null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [reporterEmail, setReporterEmail] = useState(user?.email || '')
  const [screenshot, setScreenshot] = useState(null)
  const [severity, setSeverity] = useState('medium')
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(null)
  const [copiedRef, setCopiedRef] = useState(false)
  const [contextRoute, setContextRoute] = useState(initialReportedRoute)

  const parsedTags = useMemo(() => parseTags(tagsInput), [tagsInput])
  const displayReportedScreen = useMemo(() => formatReportedScreen(contextRoute), [contextRoute])
  const homePath = user ? '/' : '/login'

  useEffect(() => {
    setReporterEmail(user?.email || '')
  }, [user?.email])

  useEffect(() => {
    let prefill = location.state?.prefill || null

    if (!prefill && source === 'runtime-error') {
      try {
        const raw = sessionStorage.getItem(RUNTIME_PREFILL_KEY)
        prefill = raw ? JSON.parse(raw) : null
      } catch {
        prefill = null
      } finally {
        try {
          sessionStorage.removeItem(RUNTIME_PREFILL_KEY)
        } catch {
          // Ignore cleanup errors.
        }
      }
    }

    if (!prefill) return

    if (prefill.title) setTitle(prev => prev || String(prefill.title).slice(0, 160))
    if (prefill.description) setDescription(prev => prev || String(prefill.description).slice(0, 1500))
    if (prefill.steps) setSteps(prev => prev || String(prefill.steps).slice(0, 2000))
    if (prefill.tagsInput) setTagsInput(prev => prev || String(prefill.tagsInput))
    if (prefill.reportedRoute) {
      const normalizedRoute = String(prefill.reportedRoute || '').trim()
      if (normalizedRoute) setContextRoute(normalizedRoute)
    }
    if (typeof prefill.includeDiagnostics === 'boolean') setIncludeDiagnostics(prefill.includeDiagnostics)
    if (SEVERITIES.some(s => s.id === prefill.severity)) {
      setSeverity(prefill.severity)
    }
  }, [location.state?.prefill, source])

  function goDashboard() {
    navigate(homePath, { replace: true })
  }

  function handleBack() {
    if (source === 'runtime-error') {
      goDashboard()
      return
    }
    if (returnTo) {
      navigate(returnTo, { replace: true })
      return
    }
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    goDashboard()
  }

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

    const routeForReport = contextRoute || `${location.pathname}${location.search || ''}`
    const appVersion = import.meta.env.VITE_APP_VERSION || `web-${import.meta.env.MODE || 'prod'}`
    const fingerprint = buildFingerprint({
      route: routeForReport,
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
        source,
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
          p_route: routeForReport,
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

      if (reportId) {
        void supabase.functions.invoke('bug-report-notify', {
          body: { reportId },
        }).catch(() => { })
      }

      setSubmitted({ id: reportId, isDuplicate, occurrenceCount })
    } catch (e2) {
      setError(e2.message || 'Could not submit the bug report. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleCopyReference() {
    if (!submitted?.id || !navigator.clipboard?.writeText) return
    await navigator.clipboard.writeText(String(submitted.id))
    setCopiedRef(true)
    setTimeout(() => setCopiedRef(false), 1500)
  }

  return (
    <div
      className="min-h-dvh bg-kosha-bg"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0.75rem)' }}
    >
      <PageBackHeader
        title="Report Bug"
        onBack={handleBack}
        rightSlot={(
          <button
            type="button"
            onClick={goDashboard}
            className="w-9 h-9 rounded-pill flex items-center justify-center bg-kosha-surface-2 active:bg-kosha-border"
            aria-label="Go to dashboard"
          >
            <Home size={16} className="text-ink-3" />
          </button>
        )}
      />

      {/* ── Content — constrained ──────────────────────────────────── */}
      <div className="mx-auto max-w-[560px]">
        <div className="px-4 pt-4 pb-36 space-y-4">
          {submitted ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-4"
            >
              <div className="w-11 h-11 rounded-xl bg-income-bg text-income-text border border-income-border flex items-center justify-center mb-4">
                <Check size={18} />
              </div>
              <h2 className="text-[20px] leading-tight font-bold text-ink tracking-tight">
                {submitted.isDuplicate ? 'Matched an existing report' : 'Report submitted'}
              </h2>
              <p className="text-label text-ink-2 mt-2">
                {submitted.isDuplicate
                  ? `We linked your report to an existing issue and incremented occurrences to ${submitted.occurrenceCount}.`
                  : 'Thank you for reporting this. We will investigate it quickly.'}
              </p>

              <div className="mt-4 card-inset p-3 border border-kosha-border">
                <p className="text-caption text-ink-3">Reference</p>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <p className="font-mono text-[13px] text-ink">#{submitted.id}</p>
                  <button
                    type="button"
                    onClick={handleCopyReference}
                    className="px-2.5 py-1 rounded-pill border border-kosha-border bg-white text-[11px] font-semibold text-ink"
                  >
                    {copiedRef ? 'Copied' : 'Copy ID'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
                <button
                  type="button"
                  onClick={handleBack}
                  className="py-3 rounded-card border border-kosha-border bg-kosha-surface text-[14px] font-semibold text-ink"
                >
                  Done
                </button>
                <button
                  type="button"
                  onClick={goDashboard}
                  className="py-3 rounded-card bg-brand text-white text-[14px] font-semibold"
                >
                  Go to dashboard
                </button>
              </div>
            </motion.div>
          ) : (
            <>
              <div className="card p-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-expense-bg flex items-center justify-center shrink-0">
                    <Bug size={18} className="text-expense-text" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[17px] font-bold text-ink leading-tight">Help us fix this</p>
                    <p className="text-[13px] text-ink-3 mt-1 leading-relaxed">
                      Share what broke, what you expected, and a screenshot if possible.
                    </p>
                  </div>
                </div>
                {displayReportedScreen && (
                  <div className="mt-3.5 pt-3.5 border-t border-kosha-border">
                    <p className="text-[11px] text-ink-3">
                      Reported on <span className="font-mono text-ink-2">{displayReportedScreen}</span>
                    </p>
                  </div>
                )}
              </div>

              <form id="report-bug-form" onSubmit={handleSubmit} className="space-y-3">
                <input
                  className="input"
                  name="bug-title"
                  placeholder="Bug title"
                  value={title}
                  maxLength={160}
                  onChange={e => setTitle(e.target.value)}
                />

                <textarea
                  className="input min-h-[112px] resize-none"
                  name="bug-description"
                  placeholder="What happened?"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />

                <textarea
                  className="input min-h-[86px] resize-none"
                  name="bug-steps"
                  placeholder="Steps to reproduce (optional)"
                  value={steps}
                  onChange={e => setSteps(e.target.value)}
                />

                <input
                  className="input"
                  type="email"
                  name="bug-email"
                  placeholder="Contact email (optional)"
                  value={reporterEmail}
                  onChange={e => setReporterEmail(e.target.value)}
                />

                <input
                  className="input"
                  name="bug-tags"
                  placeholder="Tags (optional, comma-separated: ui, crash, chart)"
                  value={tagsInput}
                  onChange={e => setTagsInput(e.target.value)}
                />

                {parsedTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {parsedTags.map(tag => (
                      <span
                        key={tag}
                        className="text-[11px] font-semibold text-ink bg-ink/[0.06] px-2 py-0.5 rounded-pill"
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
                        name="bug-screenshot"
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
                            ? 'bg-ink text-white border-ink'
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
                      ? 'bg-ink/[0.06] text-ink'
                      : 'bg-kosha-surface-2 text-ink-3'}`}>
                    {includeDiagnostics ? 'On' : 'Off'}
                  </span>
                </button>

                <p className="text-[11px] text-ink-3 -mt-1">
                  Adds route, browser, device, and app version. No financial entries are attached.
                </p>

                {error && <p className="text-sm text-expense-text">{error}</p>}
              </form>
            </>
          )}
        </div>
      </div>

      {/* ── Bottom action bar ──────────────────────────────────────── */}
      {!submitted && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-kosha-border bg-kosha-bg/95 backdrop-blur-md">
          <div
            className="mx-auto max-w-[560px] px-4 pt-3 grid grid-cols-2 gap-2"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}
          >
            <button
              type="button"
              onClick={goDashboard}
              className="py-3 rounded-card border border-kosha-border bg-kosha-surface text-[14px] font-semibold text-ink"
            >
              Go to dashboard
            </button>

            {user ? (
              <button
                type="submit"
                form="report-bug-form"
                disabled={saving}
                className={`py-3 rounded-card text-[14px] font-semibold transition-all
                  ${saving
                    ? 'bg-brand/70 text-white/90 scale-[0.97]'
                    : 'bg-brand text-white active:scale-[0.97]'}`}
              >
                {saving ? 'Submitting…' : 'Submit report'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => navigate('/login', { state: { from: '/report-bug' } })}
                className="inline-flex items-center justify-center gap-2 py-3 rounded-card bg-brand text-white text-[14px] font-semibold"
              >
                <LogIn size={15} />
                Sign in to report
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
