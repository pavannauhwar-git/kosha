import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import AboutKoshaLink from '../components/AboutKoshaLink'
import { C } from '../lib/colors'

const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.24, ease: 'easeOut' } },
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908C16.658 14.013 17.64 11.706 17.64 9.2z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

export default function Login() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { token } = useParams()
  const { user, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth()

  const [mode,          setMode]          = useState('signin')
  const [email,         setEmail]         = useState('')
  const [password,      setPassword]      = useState('')
  const [error,         setError]         = useState(null)
  const [loading,       setLoading]       = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const from = location.state?.from || '/'

  useEffect(() => {
    if (user) navigate(from, { replace: true })
  }, [user])

  useEffect(() => {
    if (token) sessionStorage.setItem('pendingInviteToken', token)
  }, [token])

  async function handleGoogle() {
    setError(null)
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
    if (!email.trim())    return setError('Enter your email address.')
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
      className="h-dvh bg-kosha-bg overflow-y-auto px-4"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="min-h-full flex flex-col items-center justify-center">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="w-full max-w-[380px] py-8"
        >

          {/* ── Logo + heading — outside card ─────────────────────────── */}
          <motion.div variants={fadeUp} className="flex flex-col items-center mb-7">
            <div
              className="w-[68px] h-[68px] rounded-[20px] flex items-center justify-center mb-5 shadow-card-md"
              style={{
                background: `linear-gradient(145deg, ${C.brand} 0%, ${C.brandMid} 100%)`,
              }}
            >
              <span style={{
                fontSize: 11,
                fontWeight: 800,
                color: 'white',
                letterSpacing: '1.5px',
                fontFamily: 'Roboto, system-ui, sans-serif',
              }}>
                KOSHA
              </span>
            </div>
            <h1 className="text-[24px] font-bold text-ink tracking-tight leading-tight text-center">
              {mode === 'signin' ? 'Welcome back' : 'Create your account'}
            </h1>
            <p className="text-label text-ink-3 mt-1.5 text-center">
              {mode === 'signin'
                ? 'Sign in to continue to Kosha'
                : 'Start tracking your finances today'}
            </p>
          </motion.div>

          {/* ── Card ─────────────────────────────────────────────────── */}
          <motion.div variants={fadeUp} className="card p-5">

            {/* ── Google ──────────────────────────────────────────────── */}
            <button
              onClick={handleGoogle}
              disabled={googleLoading || loading}
              className="w-full flex items-center justify-center gap-3 py-3
                         rounded-card border border-kosha-border bg-kosha-surface
                         text-label font-semibold text-ink
                         active:scale-[0.98] transition-all duration-75
                         disabled:opacity-60 shadow-card"
            >
              <GoogleLogo />
              {googleLoading ? 'Redirecting…' : 'Continue with Google'}
            </button>

            {/* ── Divider ─────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-kosha-border" />
              <span className="text-caption text-ink-4 font-medium">or</span>
              <div className="flex-1 h-px bg-kosha-border" />
            </div>

            {/* ── Form ────────────────────────────────────────────────── */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-caption font-semibold text-ink-3 mb-1.5">
                  Email address
                </label>
                <input
                  className="input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  disabled={loading}
                />
              </div>

              <div>
                <label className="block text-caption font-semibold text-ink-3 mb-1.5">
                  Password
                  {mode === 'signup' && (
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
                  disabled={loading}
                />
              </div>

              {/* ── Error ───────────────────────────────────────────── */}
              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-start gap-2 bg-expense-bg rounded-card px-3 py-2.5"
                  >
                    <svg width="15" height="15" viewBox="0 0 15 15" className="shrink-0 mt-px" fill="none">
                      <circle cx="7.5" cy="7.5" r="7" stroke={C.expense} strokeWidth="1.2"/>
                      <path d="M7.5 4.5v3.5M7.5 10v.5" stroke={C.expense} strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                    <p className="text-caption text-expense-text font-medium">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Submit ──────────────────────────────────────────── */}
              <button
                type="submit"
                disabled={loading || googleLoading}
                className="w-full py-3.5 rounded-card bg-brand text-white
                           text-body font-semibold
                           active:scale-[0.98] transition-all duration-75
                           disabled:opacity-60"
              >
                {loading
                  ? (mode === 'signin' ? 'Signing in…' : 'Creating account…')
                  : (mode === 'signin' ? 'Sign in' : 'Create account')}
              </button>
            </form>
          </motion.div>

          {/* ── Toggle + footer — outside card ───────────────────────── */}
          <motion.p variants={fadeUp} className="text-label text-ink-3 text-center mt-5">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null) }}
              className="text-brand font-semibold"
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </motion.p>

          <motion.div variants={fadeUp} className="mt-3">
            <AboutKoshaLink className="text-center" />
          </motion.div>

        </motion.div>
      </div>
    </div>
  )
}
