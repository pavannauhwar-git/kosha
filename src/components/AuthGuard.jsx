import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

// ── Loading spinner ───────────────────────────────────────────────────────
function AuthSpinner() {
  return (
    <div className="min-h-dvh bg-kosha-bg flex items-center justify-center">
      <span className="animate-spin rounded-full h-8 w-8 border-2 border-brand border-t-transparent" />
    </div>
  )
}

export default function AuthGuard({ children }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  // Auth initialising — show spinner, never a blank page
  if (loading) return <AuthSpinner />

  // No session
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  // User confirmed — check onboarding only if profile loaded AND incomplete
  // If profile is null (failed to load), skip onboarding check and show the app
  if (profile && !profile.onboarded && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  // Render the page — user is confirmed, that's all we need
  return children
}
