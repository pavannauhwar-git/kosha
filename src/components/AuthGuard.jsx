import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function AuthGuard({ children }) {
  const { user, profile, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (loading) return

    // Not signed in — go to login
    if (!user) {
      navigate('/login', {
        replace: true,
        state: { from: location.pathname },
      })
      return
    }

    // Profile loaded and onboarding not done — go to onboarding
    if (profile && !profile.onboarded) {
      const onboardingRoutes = ['/onboarding', '/login', '/join']
      const alreadyThere = onboardingRoutes.some(r => location.pathname.startsWith(r))
      if (!alreadyThere) {
        navigate('/onboarding', { replace: true })
      }
    }
  }, [user, profile, loading, navigate, location])

  // Still checking session — show nothing (no flash)
  if (loading) return null

  // No user — redirect handled by useEffect above
  if (!user) return null

  // User exists but profile not yet loaded from DB — show subtle spinner
  // This is the key fix: previously this returned null indefinitely if
  // loadProfile was slow or failed. Now we wait with a visible indicator.
  if (!profile) {
    return (
      <div className="min-h-dvh bg-kosha-bg flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    )
  }

  // Profile loaded but onboarding incomplete — redirect handled by useEffect
  if (!profile.onboarded && location.pathname !== '/onboarding') return null

  // All good — render the page
  return children
}
