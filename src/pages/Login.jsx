import { useState, useEffect } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import AboutKoshaLink from '../components/AboutKoshaLink'
import KoshaLogo from '../components/KoshaLogo'
import { C } from '../lib/colors'

const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show:   { opacity: 1, y: 0,  transition: { duration: 0.22, ease: 'easeOut' } },
}

// ── Google logo ───────────────────────────────────────────────────────────
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

  const [mode,          setMode]         = useState('signin')
  const [email,         setEmail]        = useState('')
  const [password,      setPassword]     = useState('')
  const [error,         setError]        = useState(null)
  const [loading,       setLoading]      = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const from = location.state?.from || '/'

  // Already signed in — redirect immediately
  useEffect(() => {
    if (user) navigate(from, { replace: true })
  }, [user])

  // Persist invite token across auth redirects so onboarding can consume it.
  useEffect(() => {
    if (token) {
      sessionStorage.setItem('pendingInviteToken', token)
    }
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
    <div className="min-h-dvh bg-white flex flex-col">

      {/* Top spacer — matches footer height so content is visually centred */}
      <div className="pb-10 pointer-events-none" aria-hidden="true">
        <p className="text-label invisible">&nbsp;</p>
      </div>

      {/* ── Main content — vertically centred ────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <motion.div
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
          initial="hidden"
          animate="show"
          className="w-full max-w-[360px]"
        >

          {/* ── Logo ──────────────────────────────────────────────────── */}
          <motion.div variants={fadeUp} className="flex flex-col items-center mb-10">
            <KoshaLogo size={64} />
            <p className="mt-3 text-caption font-semibold text-ink-3 tracking-widest uppercase">
              Your financial sheath
            </p>
          </motion.div>

          {/* ── Heading ───────────────────────────────────────────────── */}
          <motion.div variants={fadeUp} className="mb-8">
            <h1 className="text-[28px] font-bold text-ink tracking-tight leading-tight">
              {mode === 'signin' ? 'Welcome back' : 'Create account'}
            </h1>
            <p className="text-label text-ink-3 mt-1.5">
              {mode === 'signin'
                ? 'Sign in to continue to Kosha'
                : 'Start tracking your finances today'}
            </p>
          </motion.div>

          {/* ── Google ────────────────────────────────────────────────── */}
          <motion.button
            variants={fadeUp}
            onClick={handleGoogle}
            disabled={googleLoading || loading}
            className="w-full flex items-center justify-center gap-3 py-3.5
                       rounded-[14px] border border-kosha-border bg-white
                       text-[15px] font-semibold text-ink
                       active:scale-[0.98] transition-all duration-75
                       disabled:opacity-60 mb-5 shadow-sm"
          >
            <GoogleLogo />
            {googleLoading ? 'Redirecting…' : 'Continue with Google'}
          </motion.button>

          {/* ── Divider ───────────────────────────────────────────────── */}
          <motion.div variants={fadeUp} className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-kosha-border" />
            <span className="text-caption text-ink-4 font-medium">or</span>
            <div className="flex-1 h-px bg-kosha-border" />
          </motion.div>

          {/* ── Email / password form ─────────────────────────────────── */}
          <motion.form variants={fadeUp} onSubmit={handleSubmit} className="space-y-3">
            {/* Email */}
            <div>
              <label className="block text-caption font-semibold text-ink-2 mb-1.5">
                Email address
              </label>
              <input
                className="w-full px-4 py-3.5 rounded-[14px] border border-kosha-border
                           bg-kosha-surface-2 text-ink text-[15px] placeholder-ink-4
                           focus:outline-none focus:border-brand focus:bg-white
                           transition-all duration-150"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                disabled={loading}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-caption font-semibold text-ink-2 mb-1.5">
                Password
                {mode === 'signup' && (
                  <span className="font-normal text-ink-4 ml-1">· min 8 characters</span>
                )}
              </label>
              <input
                className="w-full px-4 py-3.5 rounded-[14px] border border-kosha-border
                           bg-kosha-surface-2 text-ink text-[15px] placeholder-ink-4
                           focus:outline-none focus:border-brand focus:bg-white
                           transition-all duration-150"
                type="password"
                placeholder={mode === 'signin' ? '••••••••' : 'At least 8 characters'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                disabled={loading}
              />
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-start gap-2 bg-expense-bg rounded-lg px-3 py-2.5"
                >
                  <svg width="15" height="15" viewBox="0 0 15 15" className="shrink-0 mt-px"
                       fill="none">
                    <circle cx="7.5" cy="7.5" r="7" stroke={C.expense} strokeWidth="1.2"/>
                    <path d="M7.5 4.5v3.5M7.5 10v.5" stroke={C.expense} strokeWidth="1.4"
                          strokeLinecap="round"/>
                  </svg>
                  <p className="text-caption text-expense-text font-medium">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full py-4 rounded-[14px] bg-brand text-white
                         text-[15px] font-semibold
                         active:scale-[0.98] transition-all duration-75
                         disabled:opacity-60 mt-1"
            >
              {loading
                ? (mode === 'signin' ? 'Signing in…' : 'Creating account…')
                : (mode === 'signin' ? 'Sign in' : 'Create account')}
            </button>
          </motion.form>

        </motion.div>
      </div>

      {/* ── Footer — toggle mode ──────────────────────────────────────── */}
      <div className="pb-10 text-center">
        <p className="text-label text-ink-3">
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null) }}
            className="text-brand font-semibold"
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
        <AboutKoshaLink className="text-center pt-3" />
      </div>
    </div>
  )
}
