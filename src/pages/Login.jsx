import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import AboutKoshaLink from '../components/AboutKoshaLink'
import KoshaLogo from '../components/KoshaLogo'
import { C } from '../lib/colors'
import { createFadeUp } from '../lib/animations'

const fadeUp = createFadeUp(14, 0.28)

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
  const { token } = useParams()
  const {
    user,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    requestPasswordReset,
    updatePassword,
  } = useAuth()

  const isRecoveryFlow = searchParams.get('reset') === '1'

  const [mode, setMode] = useState(isRecoveryFlow ? 'reset' : 'signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [notice, setNotice] = useState(null)
  const [resetCountdown, setResetCountdown] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const from = location.state?.from || '/'

  useEffect(() => {
    if (user && !isRecoveryFlow) navigate(from, { replace: true })
  }, [user, from, navigate, isRecoveryFlow])

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

  useEffect(() => {
    if (token) {
      sessionStorage.setItem('pendingInviteToken', token)
    }
  }, [token])

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
        navigate(from, { replace: true })
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
    <div
      className="h-dvh overflow-y-auto relative"
      style={{
        background: 'linear-gradient(145deg, #f6f9fc 0%, #eef2f7 50%, #f0edff 100%)',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* ── Vivid Stripe gradient orbs ─────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute rounded-full blur-3xl"
          style={{
            width: 480, height: 480, top: '-12%', left: '-14%',
            background: 'radial-gradient(circle, rgba(99,91,255,0.25) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute rounded-full blur-3xl"
          style={{
            width: 520, height: 520, bottom: '-15%', right: '-12%',
            background: 'radial-gradient(circle, rgba(14,159,110,0.18) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute rounded-full blur-3xl"
          style={{
            width: 350, height: 350, top: '35%', left: '55%',
            background: 'radial-gradient(circle, rgba(124,58,237,0.14) 0%, transparent 70%)',
          }}
        />
      </div>

      <div className="relative min-h-full flex flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-[400px]">
          <motion.div
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } } }}
            initial="hidden"
            animate="show"
          >
            {/* ── Logo & branding ─────────────────────────────────────── */}
            <motion.div variants={fadeUp} className="flex flex-col items-center mb-8">
              <KoshaLogo size={60} />
              <h2
                className="mt-4 text-[13px] font-bold tracking-[0.2em] uppercase"
                style={{ color: C.accent }}
              >
                Kosha
              </h2>
            </motion.div>

            {/* ── Glass card ──────────────────────────────────────────── */}
            <motion.div
              variants={fadeUp}
              className="rounded-hero p-7 mb-5"
              style={{
                background: '#ffffff',
                border: '1px solid rgba(0,0,0,0.08)',
                boxShadow: '0 24px 64px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
              }}
            >

              {/* ── Heading ───────────────────────────────────────────── */}
              <div className="mb-6">
                <h1 className="text-[28px] font-bold text-ink tracking-tight leading-tight mb-2">
                  {mode === 'signin'
                    ? 'Welcome back'
                    : mode === 'signup'
                      ? 'Create account'
                      : mode === 'forgot'
                        ? 'Reset password'
                        : 'Set new password'}
                </h1>
                <p className="text-[15px] text-ink-3 leading-relaxed">
                  {mode === 'signin'
                    ? 'Sign in to continue to Kosha'
                    : mode === 'signup'
                      ? 'Start tracking your finances today'
                      : mode === 'forgot'
                        ? 'We will email a secure reset link.'
                        : 'Choose a strong new password for your account.'}
                </p>
              </div>

              {/* ── Google ────────────────────────────────────────────── */}
              {(mode === 'signin' || mode === 'signup') && (
                <button
                  onClick={handleGoogle}
                  disabled={googleLoading || loading}
                  className="w-full flex items-center justify-center gap-3 h-[52px]
                       rounded-[14px] text-[15px] font-semibold text-ink
                       active:scale-[0.98] transition-all duration-100
                       disabled:opacity-60 mb-5"
                  style={{
                    background: '#f6f9fc',
                    border: '1px solid rgba(0,0,0,0.10)',
                  }}
                >
                  <GoogleLogo />
                  {googleLoading ? 'Redirecting…' : 'Continue with Google'}
                </button>
              )}

              {/* ── Divider ───────────────────────────────────────────── */}
              {(mode === 'signin' || mode === 'signup') && (
                <div className="flex items-center gap-4 mb-5">
                  <div className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.08)' }} />
                  <span className="text-[12px] text-ink-4 font-medium uppercase tracking-wider">or</span>
                  <div className="flex-1 h-px" style={{ background: 'rgba(0,0,0,0.08)' }} />
                </div>
              )}

              {/* ── Email / password form ─────────────────────────────── */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {mode !== 'reset' && (
                  <div>
                    <label className="block text-[13px] font-semibold text-ink-3 mb-2">
                      Email address
                    </label>
                    <input
                      className="input"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      autoComplete="email"
                      disabled={loading || isRedirectingAfterReset}
                    />
                  </div>
                )}

                {mode !== 'forgot' && (
                  <div>
                    <label className="block text-[13px] font-semibold text-ink-3 mb-2">
                      {mode === 'reset' ? 'New password' : 'Password'}
                      {(mode === 'signup' || mode === 'reset') && (
                        <span className="font-normal text-ink-4 ml-1">· min 8 characters</span>
                      )}
                    </label>
                    <input
                      className="input"
                      type="password"
                      placeholder={mode === 'signin' ? '••••••••' : 'At least 8 characters'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                      disabled={loading || isRedirectingAfterReset}
                    />
                  </div>
                )}

                {mode === 'reset' && (
                  <div>
                    <label className="block text-[13px] font-semibold text-ink-3 mb-2">
                      Confirm new password
                    </label>
                    <input
                      className="input"
                      type="password"
                      placeholder="Re-enter your password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      disabled={loading || isRedirectingAfterReset}
                    />
                  </div>
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
                      className="text-[14px] font-semibold"
                      style={{ color: C.accent }}
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                <AnimatePresence>
                  {notice && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-start gap-2 rounded-[12px] px-3.5 py-3"
                      style={{ background: 'rgba(14,159,110,0.08)', border: '1px solid rgba(14,159,110,0.15)' }}
                    >
                      <p className="text-[13px] text-income-text font-medium">{notice}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {isRedirectingAfterReset && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-start gap-2 rounded-[12px] px-3.5 py-3"
                      style={{ background: 'rgba(99,91,255,0.08)', border: '1px solid rgba(99,91,255,0.15)' }}
                    >
                      <p className="text-[13px] font-medium" style={{ color: C.brandLight }}>
                        Redirecting to sign in in {resetCountdown}s...
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ── Error ────────────────────────────────────────────── */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="flex items-start gap-2.5 rounded-[12px] px-3.5 py-3"
                      style={{ background: 'rgba(232,54,78,0.06)', border: '1px solid rgba(232,54,78,0.12)' }}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" className="shrink-0 mt-px" fill="none">
                        <circle cx="8" cy="8" r="7" stroke={C.expense} strokeWidth="1.2" />
                        <path d="M8 5v3.5M8 10.5v.5" stroke={C.expense} strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                      <p className="text-[13px] text-expense-text font-medium">{error}</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ── Submit ───────────────────────────────────────────── */}
                <button
                  type="submit"
                  disabled={loading || googleLoading || isRedirectingAfterReset}
                  className="w-full h-[52px] rounded-[14px] text-white
                         text-[16px] font-semibold mt-1
                         active:scale-[0.98] transition-all duration-100
                         disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, #635bff 0%, #7a73ff 100%)',
                    boxShadow: '0 4px 20px rgba(99,91,255,0.40), 0 0 0 1px rgba(99,91,255,0.50)',
                  }}
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
                </button>
              </form>

              {/* ── Toggle mode ───────────────────────────────────────── */}
              {mode === 'forgot' ? (
                <p className="text-[14px] text-ink-3 text-center mt-5">
                  Remembered your password?{' '}
                  <button
                    onClick={() => {
                      setMode('signin')
                      setError(null)
                      setNotice(null)
                    }}
                    className="font-semibold"
                    style={{ color: C.accent }}
                  >
                    Sign in
                  </button>
                </p>
              ) : mode === 'reset' ? (
                <p className="text-[14px] text-ink-3 text-center mt-5">
                  Opened the wrong page?{' '}
                  <button
                    onClick={() => {
                      setMode('signin')
                      setError(null)
                      setNotice(null)
                    }}
                    className="font-semibold"
                    style={{ color: C.accent }}
                  >
                    Back to sign in
                  </button>
                </p>
              ) : (
                <p className="text-[14px] text-ink-3 text-center mt-5">
                  {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
                  <button
                    onClick={() => {
                      setMode(mode === 'signin' ? 'signup' : 'signin')
                      setError(null)
                      setNotice(null)
                    }}
                    className="font-semibold"
                    style={{ color: C.accent }}
                  >
                    {mode === 'signin' ? 'Sign up' : 'Sign in'}
                  </button>
                </p>
              )}
            </motion.div>

            {/* ── Footer ──────────────────────────────────────────────── */}
            <motion.div variants={fadeUp}>
              <AboutKoshaLink className="text-center pt-2" />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
