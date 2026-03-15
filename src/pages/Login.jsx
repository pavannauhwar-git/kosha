import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../hooks/useAuth'
import { useEffect } from 'react'

const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
}

// ── Google logo SVG (official colours) ────────────────────────────────────
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

export default function Login() {
  const navigate              = useNavigate()
  const location              = useLocation()
  const { user, signInWithGoogle, signInWithEmail, signUpWithEmail } = useAuth()
  
  const [mode,     setMode]     = useState('signin')  // 'signin' | 'signup'
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  // Where to go after successful sign-in
  const from = location.state?.from || '/'

  async function handleGoogle() {
    setError(null)
    setGoogleLoading(true)
    try {
      await signInWithGoogle()
      // Google redirects away — no navigate() needed here
    } catch (e) {
      setError(e.message)
      setGoogleLoading(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)

    if (!email.trim())    return setError('Please enter your email.')
    if (!password.trim()) return setError('Please enter your password.')
    if (mode === 'signup' && password.length < 8)
      return setError('Password must be at least 8 characters.')

    setLoading(true)
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password)
        navigate(from, { replace: true })
      } else {
        await signUpWithEmail(email, password)
        // New user goes to onboarding
        navigate('/onboarding', { replace: true })
      }
    } catch (e) {
      setError(
        e.message === 'Invalid login credentials'
          ? 'Incorrect email or password.'
          : e.message
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-kosha-bg flex flex-col items-center justify-center px-5">
      <motion.div
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06 } } }}
        initial="hidden"
        animate="show"
        className="w-full max-w-sm"
      >

        {/* ── Logo + heading ─────────────────────────────────────────── */}
        <motion.div variants={fadeUp} className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl
                          bg-brand mb-5 shadow-fab">
            <span className="text-white font-bold text-xl tracking-tight">KOSHA</span>
          </div>

          <h1 className="text-display font-bold text-ink tracking-tight mb-1">
            {mode === 'signin' ? 'Welcome back' : 'Create account'}
          </h1>
          <p className="text-label text-ink-3">
            {mode === 'signin'
              ? 'Sign in to your Kosha account'
              : 'Start tracking your finances'}
          </p>
        </motion.div>

        {/* ── Google button ──────────────────────────────────────────── */}
        <motion.button
          variants={fadeUp}
          onClick={handleGoogle}
          disabled={googleLoading || loading}
          className="w-full flex items-center justify-center gap-3 py-3.5 rounded-card
                     bg-kosha-surface shadow-card border border-kosha-border
                     text-body font-semibold text-ink
                     active:scale-[0.98] transition-all duration-75
                     disabled:opacity-60"
        >
          <GoogleLogo />
          {googleLoading ? 'Redirecting…' : 'Continue with Google'}
        </motion.button>

        {/* ── Divider ────────────────────────────────────────────────── */}
        <motion.div variants={fadeUp} className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-kosha-border" />
          <span className="text-caption text-ink-4 font-medium">or</span>
          <div className="flex-1 h-px bg-kosha-border" />
        </motion.div>

        {/* ── Email / password form ──────────────────────────────────── */}
        <motion.form variants={fadeUp} onSubmit={handleSubmit} className="space-y-3">
          <input
            className="input"
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            disabled={loading}
          />
          <input
            className="input"
            type="password"
            placeholder={mode === 'signup' ? 'Password (min 8 characters)' : 'Password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            disabled={loading}
          />

          {/* Error message */}
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-caption text-expense-text font-medium px-1"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full py-4 rounded-card bg-brand text-white
                       text-body font-semibold
                       active:scale-[0.98] transition-all duration-75
                       disabled:opacity-60"
          >
            {loading
              ? (mode === 'signin' ? 'Signing in…' : 'Creating account…')
              : (mode === 'signin' ? 'Sign in'     : 'Create account')}
          </button>
        </motion.form>

        {/* ── Toggle sign in / sign up ───────────────────────────────── */}
        <motion.p variants={fadeUp} className="text-center mt-6 text-label text-ink-3">
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null) }}
            className="text-brand font-semibold"
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </motion.p>

      </motion.div>
    </div>
  )
}
