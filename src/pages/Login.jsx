import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import AboutKoshaLink from '../components/brand/AboutKoshaLink'
import KoshaLogo from '../components/brand/KoshaLogo'
import { C } from '../lib/colors'
import { createFadeUp } from '../lib/animations'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'

const fadeUp = createFadeUp(10, 0.22)

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.013 17.64 11.706 17.64 9.2z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
    </svg>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { token, splitToken } = useParams()
  const {
    user,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    requestPasswordReset,
    updatePassword,
  } = useAuth()

  const isRecoveryFlow = searchParams.get('reset') === '1'
  const initialMode = searchParams.get('mode') || (isRecoveryFlow ? 'reset' : 'signin')

  const [mode, setMode] = useState(initialMode)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [notice, setNotice] = useState(null)
  const [resetCountdown, setResetCountdown] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const from = location.state?.from || '/'

  function resolvePostAuthPath() {
    if (splitToken) return '/splitwise'

    try {
      if (sessionStorage.getItem('pendingSplitGroupInviteToken')) return '/splitwise'
    } catch {
      // no-op
    }
    return from
  }

  useEffect(() => {
    if (user && !isRecoveryFlow) navigate(resolvePostAuthPath(), { replace: true })
  }, [user, from, navigate, isRecoveryFlow, splitToken])

  useEffect(() => {
    setMode(isRecoveryFlow ? 'reset' : 'signin')
    setError(null)
    setNotice(null)
    setResetCountdown(null)
  }, [isRecoveryFlow])

  useEffect(() => {
    if (resetCountdown === null) return
    if (resetCountdown <= 0) {
      navigate('/login', { replace: true })
      return
    }

    const timer = setTimeout(() => {
      setResetCountdown((s) => (s === null ? null : s - 1))
    }, 1000)

    return () => clearTimeout(timer)
  }, [resetCountdown, navigate])

  const isRedirectingAfterReset = resetCountdown !== null

  async function handleGoogle() {
    setError(null)
    setNotice(null)
    setGoogleLoading(true)
    try {
      await signInWithGoogle()
    } catch (e) {
      setError(e.message)
      setGoogleLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setNotice(null)

    if (mode === 'forgot') {
      if (!email.trim()) return setError('Enter your email address.')
      setLoading(true)
      try {
        await requestPasswordReset(email)
        setNotice('Password reset link sent. Check your email inbox.')
      } catch (e) {
        setError(e.message || 'Could not send reset link. Try again.')
      } finally {
        setLoading(false)
      }
      return
    }

    if (mode === 'reset') {
      if (!password.trim()) return setError('Enter a new password.')
      if (password.length < 8) return setError('Password must be at least 8 characters.')
      if (password !== confirmPassword) return setError('Passwords do not match.')

      setLoading(true)
      try {
        await updatePassword(password)
        setNotice('Password updated successfully.')
        setMode('signin')
        setPassword('')
        setConfirmPassword('')
        setResetCountdown(2)
      } catch (e) {
        setError(e.message || 'Could not update password. Open the reset link again.')
      } finally {
        setLoading(false)
      }
      return
    }

    if (!email.trim()) return setError('Enter your email address.')
    if (!password.trim()) return setError('Enter your password.')
    if (mode === 'signup' && password.length < 8)
      return setError('Password must be at least 8 characters.')

    setLoading(true)
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password)
        navigate(resolvePostAuthPath(), { replace: true })
      } else {
        await signUpWithEmail(email, password)
        navigate('/onboarding', { replace: true })
      }
    } catch (e) {
      setError(
        e.message === 'Invalid login credentials'
          ? 'Incorrect email or password. Try again.'
          : e.message
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-kosha-bg px-4 flex flex-col items-center justify-center overscroll-none" style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
      <div className="w-full max-w-[400px]">
        <motion.div
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
          initial="hidden"
          animate="show"
        >
          {/* ── Card ─────────────────────────────────────────────────────── */}
          <motion.div
            variants={fadeUp}
            className="card p-6 mb-4"
          >

              {/* ── Illustration & Logo ──────────────────────────────────────────────────── */}
              <div className="flex items-center justify-between gap-4 mb-6 pb-5 border-b border-kosha-border">
                <div className="flex flex-col items-start text-left min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <KoshaLogo size={32} />
                    <p className="text-[22px] font-bold text-ink leading-tight truncate">Kosha</p>
                  </div>
                  <p className="text-[12px] text-ink-2">Personal finance, simplified</p>
                </div>
                <img src="/illustrations/login_hero.png" alt="Kosha login" className="w-32 h-auto shrink-0 mix-blend-multiply [clip-path:inset(2px)]" />
              </div>

              {/* ── Heading ───────────────────────────────────────────────── */}
              <div className="mb-5">
                <h1 className="text-[24px] font-bold text-ink tracking-tight leading-tight mb-1">
                  {mode === 'signin'
                    ? 'Welcome back'
                    : mode === 'signup'
                      ? 'Create account'
                      : mode === 'forgot'
                        ? 'Reset password'
                        : 'Set new password'}
                </h1>
                <p className="text-[13px] text-ink-2">
                  {mode === 'signin'
                    ? 'Sign in to continue to Kosha'
                    : mode === 'signup'
                      ? 'Start tracking your finances today'
                      : mode === 'forgot'
                        ? 'We will email a secure reset link.'
                        : 'Choose a strong new password for your account.'}
                </p>
              </div>

              {/* ── Google ────────────────────────────────────────────────── */}
              {(mode === 'signin' || mode === 'signup') && (
                <Button
                  variant="secondary"
                  size="xl"
                  fullWidth
                  onClick={handleGoogle}
                  disabled={googleLoading || loading}
                  loading={googleLoading}
                  icon={!googleLoading ? <GoogleLogo /> : undefined}
                  className="mb-4"
                >
                  {googleLoading ? 'Redirecting…' : 'Continue with Google'}
                </Button>
              )}

              {/* ── Divider ───────────────────────────────────────────────── */}
              {(mode === 'signin' || mode === 'signup') && (
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-px bg-kosha-border" />
                  <span className="text-caption text-ink-2 font-medium">or</span>
                  <div className="flex-1 h-px bg-kosha-border" />
                </div>
              )}

              {/* ── Email / password form ─────────────────────────────────── */}
              <form onSubmit={handleSubmit} className="space-y-3">
                {mode !== 'reset' && (
                  <Input
                    label="Email address"
                    name="username"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="username"
                    disabled={loading || isRedirectingAfterReset}
                  />
                )}

                {mode === 'reset' && (
                  <input
                    type="email"
                    name="username"
                    autoComplete="username"
                    value={user?.email || email}
                    readOnly
                    tabIndex={-1}
                    aria-hidden="true"
                    className="sr-only"
                  />
                )}

                {mode !== 'forgot' && (
                  <Input
                    label={mode === 'reset' ? 'New password' : 'Password'}
                    helperText={(mode === 'signup' || mode === 'reset') ? 'Min 8 characters' : undefined}
                    name={mode === 'signin' ? 'password' : 'new-password'}
                    type="password"
                    placeholder={mode === 'signin' ? '••••••••' : 'At least 8 characters'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    disabled={loading || isRedirectingAfterReset}
                  />
                )}

                {mode === 'reset' && (
                  <Input
                    label="Confirm new password"
                    name="confirm-new-password"
                    type="password"
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    disabled={loading || isRedirectingAfterReset}
                  />
                )}

                {mode === 'signin' && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot')
                        setPassword('')
                        setError(null)
                        setNotice(null)
                      }}
                      className="text-label font-semibold text-accent-text"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                <AnimatePresence>
                  {notice && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-start gap-2 bg-income-bg rounded-card px-3 py-2.5"
                    >
                      <p className="text-caption text-income-text font-medium">{notice}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {isRedirectingAfterReset && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-start gap-2 bg-brand-container rounded-card px-3 py-2.5"
                    >
                      <p className="text-caption text-ink font-medium">
                        Redirecting to sign in in {resetCountdown}s...
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ── Error ─────────────────────────────────────────────── */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-start gap-2 bg-expense-bg rounded-card px-3 py-2.5"
                    >
                      <svg width="15" height="15" viewBox="0 0 15 15" className="shrink-0 mt-px" fill="none">
                        <circle cx="7.5" cy="7.5" r="7" stroke={C.expense} strokeWidth="1.2" />
                        <path d="M7.5 4.5v3.5M7.5 10v.5" stroke={C.expense} strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                      <p className="text-caption text-expense-text font-medium">{error}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ── Submit ────────────────────────────────────────────── */}
                <Button
                  type="submit"
                  variant="primary"
                  size="xl"
                  fullWidth
                  disabled={googleLoading || isRedirectingAfterReset}
                  loading={loading}
                  className="mt-1"
                >
                  {loading
                    ? (mode === 'signin'
                      ? 'Signing in…'
                      : mode === 'signup'
                        ? 'Creating account…'
                        : mode === 'forgot'
                          ? 'Sending link…'
                          : 'Updating password…')
                    : (mode === 'signin'
                      ? 'Sign in'
                      : mode === 'signup'
                        ? 'Create account'
                        : mode === 'forgot'
                          ? 'Send reset link'
                          : 'Update password')}
                </Button>
              </form>

              {/* ── Toggle mode ───────────────────────────────────────────── */}
              {mode === 'forgot' ? (
                <p className="text-label text-ink-2 text-center mt-4">
                  Remembered your password?{' '}
                  <button
                    onClick={() => {
                      setMode('signin')
                      setError(null)
                      setNotice(null)
                    }}
                    className="text-accent-text font-semibold"
                  >
                    Sign in
                  </button>
                </p>
              ) : mode === 'reset' ? (
                <p className="text-label text-ink-2 text-center mt-4">
                  Opened the wrong page?{' '}
                  <button
                    onClick={() => {
                      setMode('signin')
                      setError(null)
                      setNotice(null)
                    }}
                    className="text-accent-text font-semibold"
                  >
                    Back to sign in
                  </button>
                </p>
              ) : (
                <p className="text-label text-ink-2 text-center mt-4">
                  {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
                  <button
                    onClick={() => {
                      setMode(mode === 'signin' ? 'signup' : 'signin')
                      setError(null)
                      setNotice(null)
                    }}
                    className="text-accent-text font-semibold"
                  >
                    {mode === 'signin' ? 'Sign up' : 'Sign in'}
                  </button>
                </p>
              )}
            </motion.div>

            {/* ── Footer ─────────────────────────────────────────────────── */}
            <motion.div variants={fadeUp}>
              <AboutKoshaLink className="text-center pt-1" />
            </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
