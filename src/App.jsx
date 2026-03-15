import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AuthProvider } from './hooks/useAuth'
import { useAuth } from './hooks/useAuth'
import { useScrollDirection } from './hooks/useScrollDirection'
import AuthGuard    from './components/AuthGuard'
import Dashboard    from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Monthly      from './pages/Monthly'
import Analytics    from './pages/Analytics'
import Bills        from './pages/Bills'
import Login        from './pages/Login'
import Onboarding   from './pages/Onboarding'
import { House, List, CalendarDots, ChartBar, Receipt } from '@phosphor-icons/react'

const NAV = [
  { path: '/',             label: 'Home',     Icon: House        },
  { path: '/transactions', label: 'All',      Icon: List         },
  { path: '/monthly',      label: 'Monthly',  Icon: CalendarDots },
  { path: '/analytics',    label: 'Insights', Icon: ChartBar     },
  { path: '/bills',        label: 'Bills',    Icon: Receipt      },
]

// ── Bottom nav ────────────────────────────────────────────────────────────
function BottomNav() {
  const location = useLocation()
  const navigate  = useNavigate()
  const shrink    = useScrollDirection()

  const hideOn = ['/login', '/onboarding', '/join', '/auth']
  if (hideOn.some(p => location.pathname.startsWith(p))) return null

  const active = NAV.findIndex(n =>
    n.path === '/' ? location.pathname === '/' : location.pathname.startsWith(n.path)
  )

  return (
    <div className="nav-float-wrap">
      <nav className={`nav-float${shrink ? ' nav-float--shrink' : ''}`}>
        {NAV.map((item, i) => {
          const isActive = i === active
          // Shrink: smaller hit area; expand: standard area
          const itemW = shrink ? 'w-10' : 'w-14'
          const itemH = shrink ? 'h-9'  : 'h-11'

          return (
            <button
              key={item.path}
              className="nav-float-item"
              onClick={() => {
                if (navigator.vibrate) navigator.vibrate(8)
                navigate(item.path)
              }}
            >
              <div className={`relative flex items-center justify-center ${itemW} ${itemH}`}>
                {isActive && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-pill"
                    style={{ background: '#C8F5A0' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 36 }}
                  />
                )}
                <item.Icon
                  size={shrink ? 21 : 26}
                  weight={isActive ? 'fill' : 'regular'}
                  color={isActive ? '#163300' : '#7A8F6E'}
                  style={{ position: 'relative', zIndex: 1, transition: 'all 0.2s ease' }}
                />
              </div>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

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

            {/* Protected */}
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
