import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { useAuth } from './hooks/useAuth'
import AuthGuard from './components/AuthGuard'
import BottomNav from './components/BottomNav'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Monthly from './pages/Monthly'
import Analytics from './pages/Analytics'
import Bills from './pages/Bills'

// ── Auth callback ─────────────────────────────────────────────────────────
function AuthCallback() {
  const { user, profile, loading } = useAuth()
  if (loading) return null
  if (!user)   return <Navigate to="/login"      replace />
  if (profile && !profile.onboarded)
               return <Navigate to="/onboarding" replace />
  return             <Navigate to="/"            replace />
}

export default function App() {
  return (
    <BrowserRouter>
      {/* AuthProvider ensures every component shares ONE auth state.
          Previously useAuth() was a plain hook — each component got its
          own isolated instance with its own getSession() call. */}
      <AuthProvider>
        <div className="min-h-dvh bg-kosha-bg">
          <Routes>

            {/* Public */}
            <Route path="/login"         element={<Login />} />
            <Route path="/join/:token"   element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            {/* Onboarding */}
            <Route path="/onboarding" element={
              <AuthGuard><Onboarding /></AuthGuard>
            } />

            {/* Protected — no PageTransition wrapper */}
            <Route path="/"             element={<AuthGuard><Dashboard    /></AuthGuard>} />
            <Route path="/transactions" element={<AuthGuard><Transactions /></AuthGuard>} />
            <Route path="/monthly"      element={<AuthGuard><Monthly      /></AuthGuard>} />
            <Route path="/analytics"    element={<AuthGuard><Analytics    /></AuthGuard>} />
            <Route path="/bills"        element={<AuthGuard><Bills        /></AuthGuard>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />

          </Routes>

          <BottomNav />
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}
