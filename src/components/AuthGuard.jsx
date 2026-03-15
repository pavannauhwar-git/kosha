import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function AuthGuard({ children }) {
  const { user, profile, loading } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()

  // Safety timeout — if profile takes more than 8 seconds to load,
  // proceed anyway. Prevents permanent spinner if RLS query is slow.
  const [profileTimeout, setProfileTimeout] = useState(false)

  useEffect(() => {
    if (profile || !user) return
    const timer = setTimeout(() => setProfileTimeout(true), 8000)
    return () => clearTimeout(timer)
  }, [profile, user])

  useEffect(() => {
    if (loading) return
    if (!user) {
      navigate('/login', {
        replace: true,
        state: { from: location.pathname },
      })
      return
    }
    if (profile && !profile.onboarded) {
      const onboardingRoutes = ['/onboarding', '/login', '/join']
      const alreadyThere = onboardingRoutes.some(r => location.pathname.startsWith(r))
      if (!alreadyThere) navigate('/onboarding', { replace: true })
    }
  }, [user, profile, loading, navigate, location])

  // Initial session check in progress
  if (loading) return null

  // No user — redirect in progress
  if (!user) return null

  // Profile still loading — show spinner, but bail out after timeout
  if (!profile && !profileTimeout) {
    return (
      <div className="min-h-dvh bg-kosha-bg flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-brand border-t-transparent animate-spin" />
      </div>
    )
  }

  // Onboarding incomplete
  if (profile && !profile.onboarded && location.pathname !== '/onboarding') return null

  return children
}
