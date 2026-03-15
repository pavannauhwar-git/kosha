import { useState, useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function AuthGuard({ children }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  // Safety timeout — if profile takes more than 8 seconds, proceed anyway
  const [profileTimeout, setProfileTimeout] = useState(false)

  useEffect(() => {
    if (profile || !user) return
    const timer = setTimeout(() => setProfileTimeout(true), 8000)
    return () => clearTimeout(timer)
  }, [profile, user])

  // ── 1. Initial session check in progress ─────────────────────────────
  // Show a minimal loading screen — never a blank page
  if (loading) {
    return (
      <div className="min-h-dvh bg-kosha-bg flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    )
  }

  // ── 2. No session — redirect to login immediately ─────────────────────
  // Using <Navigate> instead of useEffect + navigate() eliminates the
  // blank page gap that occurred between loading=false and the redirect firing.
  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname }}
      />
    )
  }

  // ── 3. Authenticated but profile still loading from DB ────────────────
  if (!profile && !profileTimeout) {
    return (
      <div className="min-h-dvh bg-kosha-bg flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    )
  }

  // ── 4. Profile loaded but onboarding incomplete ───────────────────────
  if (profile && !profile.onboarded && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  // ── 5. All good — render the protected page ───────────────────────────
  return children
}
