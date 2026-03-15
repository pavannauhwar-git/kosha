import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { AuthProvider } from './hooks/useAuth'
import { useAuth } from './hooks/useAuth'
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
  { path: '/transactions', label: 'Activity', Icon: List         },
  { path: '/monthly',      label: 'Monthly',  Icon: CalendarDots },
  { path: '/analytics',    label: 'Insights', Icon: ChartBar     },
  { path: '/bills',        label: 'Bills',    Icon: Receipt      },
]

// ── Bottom nav ─────────────────────────────────────────────────────────────
// Apple tab-bar principles applied:
//   1. Never resizes on scroll — fixed, stable, always present
//   2. Icon + label on every tab, always
//   3. layoutId pill springs between active items — stiffness 500, snappy
//   4. Tap bounce via whileTap scale — physical feel
//   5. Fill/regular icon cross-fades via opacity (not size swap, which can't animate)
//   6. Label weight/color animate independently with 0.15s ease
// ──────────────────────────────────────────────────────────────────────────
function BottomNav() {
  const location = useLocation()
  const navigate  = useNavigate()

  const hideOn = ['/login', '/onboarding', '/join', '/auth']
  if (hideOn.some(p => location.pathname.startsWith(p))) return null

  const active = NAV.findIndex(n =>
    n.path === '/' ? location.pathname === '/' : location.pathname.startsWith(n.path)
  )

  return (
    <div className="nav-float-wrap">
      <nav className="nav-float">
        {NAV.map((item, i) => {
          const isActive = i === active
          return (
            <motion.button
              key={item.path}
              className="nav-float-item"
              onClick={() => {
                if (navigator.vibrate) navigator.vibrate(6)
                navigate(item.path)
              }}
              whileTap={{ scale: 0.78 }}
              transition={{ type: 'spring', stiffness: 600, damping: 28 }}
            >
              {/* ── Icon area ── */}
              <div className="nav-icon-wrap">
                {/* Sliding background pill — springs between tabs */}
                {isActive && (
                  <motion.div
                    layoutId="nav-pill"
                    className="nav-icon-bg"
                    transition={{ type: 'spring', stiffness: 500, damping: 38, mass: 0.8 }}
                  />
                )}
                {/* Filled icon (active) — opacity cross-fade */}
                <motion.span
                  className="nav-icon-layer"
                  animate={{ opacity: isActive ? 1 : 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <item.Icon size={22} weight="fill" color="#163300" />
                </motion.span>
                {/* Regular icon (inactive) — opacity cross-fade */}
                <motion.span
                  className="nav-icon-layer"
                  animate={{ opacity: isActive ? 0 : 1 }}
                  transition={{ duration: 0.15 }}
                >
                  <item.Icon size={22} weight="regular" color="#7A8F6E" />
                </motion.span>
              </div>

              {/* ── Label ── */}
              <motion.span
                className="nav-label"
                animate={{
                  color:      isActive ? '#163300' : '#7A8F6E',
                  fontWeight: isActive ? 700 : 500,
                }}
                transition={{ duration: 0.15 }}
              >
                {item.label}
              </motion.span>
            </motion.button>
          )
        })}
      </nav>
    </div>
  )
}

// ── Auth callback ──────────────────────────────────────────────────────────
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
