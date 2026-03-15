import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function AuthGuard({ children }) {
  const { user, profile, loading } = useAuth()
  const location = useLocation()

  // Auth initialising
  if (loading) return null

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
