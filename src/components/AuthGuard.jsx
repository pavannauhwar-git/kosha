import { useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

// ── AuthGuard ─────────────────────────────────────────────────────────────
// Wraps all protected pages. Does three things:
//
// 1. If loading (session check in progress) — renders nothing.
//    Prevents a flash of the login screen on refresh.
//
// 2. If no user — redirects to /login.
//    The current path is saved so we can return after sign-in.
//
// 3. If user exists but onboarded = false — redirects to /onboarding.
//    This catches new users who signed up via an invite link.
//    Existing users (you) will have onboarded = true after back-fill.

export default function AuthGuard({ children }) {
  const { user, profile, loading } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()

  useEffect(() => {
    if (loading) return

    if (!user) {
      // Save the page they were trying to reach
      navigate('/login', {
        replace: true,
        state: { from: location.pathname },
      })
      return
    }

    // Profile loaded and onboarding not complete
    if (profile && !profile.onboarded) {
      const onboardingRoutes = ['/onboarding', '/login', '/join']
      const alreadyThere = onboardingRoutes.some(r => location.pathname.startsWith(r))
      if (!alreadyThere) {
        navigate('/onboarding', { replace: true })
      }
    }
  }, [user, profile, loading, navigate, location])

  // Show nothing during the initial session check
  if (loading) return null

  // Show nothing while redirecting
  if (!user) return null

  // Don't block the onboarding page itself
  if (profile && !profile.onboarded && location.pathname !== '/onboarding') return null

  return children
}
