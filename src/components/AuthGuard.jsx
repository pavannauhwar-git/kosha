import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function AuthGuard({ children }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  // ── 1. Checking localStorage for existing session ─────────────────────
  // Resolves in <100ms. Return null (invisible) — not a spinner.
  if (loading) return null

  // ── 2. No session — go to login ───────────────────────────────────────
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  // ── 3. User confirmed — check onboarding ─────────────────────────────
  // Only redirect to onboarding if profile has loaded AND onboarded=false.
  // If profile is still null (loading), skip this check and render the page.
  // The page will show its own loading state via the data hooks.
  // This eliminates the blank screen caused by waiting for the profile query.
  if (profile !== null && !profile.onboarded && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  // ── 4. Render the page ────────────────────────────────────────────────
  return children
}
