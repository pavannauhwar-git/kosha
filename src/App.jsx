import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
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
  { path: '/transactions', label: 'All',      Icon: List         },
  { path: '/monthly',      label: 'Monthly',  Icon: CalendarDots },
  { path: '/analytics',    label: 'Insights', Icon: ChartBar     },
  { path: '/bills',        label: 'Bills',    Icon: Receipt      },
]

const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.12, ease: 'easeOut' } },
  exit:    { opacity: 0, transition: { duration: 0.08, ease: 'easeIn'  } },
}

// ── Bottom nav — hidden on auth pages ─────────────────────────────────────
function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

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
            <button
              key={item.path}
              className="nav-float-item"
              onClick={() => {
                if (navigator.vibrate) navigator.vibrate(8)
                navigate(item.path)
              }}
            >
              <div className="relative flex items-center justify-center w-14 h-11">
                {isActive && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-0 rounded-pill"
                    style={{ background: '#EEEBFF' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 36 }}
                  />
                )}
                <item.Icon
                  size={26}
                  weight={isActive ? 'fill' : 'regular'}
                  color={isActive ? '#6C47FF' : '#A09CC0'}
                  style={{ position: 'relative', zIndex: 1 }}
                />
              </div>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

function PageTransition({ children }) {
  const location = useLocation()
  return (
    <AnimatePresence>
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        style={{ willChange: 'opacity' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

// ── Auth callback ─────────────────────────────────────────────────────────
// Google OAuth lands here after redirect.
// useAuth picks up the session via onAuthStateChange automatically.
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
      <div className="min-h-dvh bg-kosha-bg">
        <Routes>

          {/* Public */}
          <Route path="/login"         element={<Login />} />
          <Route path="/join/:token"   element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Onboarding — needs auth, shown before main app */}
          <Route path="/onboarding" element={
            <AuthGuard>
              <PageTransition><Onboarding /></PageTransition>
            </AuthGuard>
          } />

          {/* Protected main app */}
          <Route path="/" element={
            <AuthGuard>
              <PageTransition><Dashboard /></PageTransition>
            </AuthGuard>
          } />
          <Route path="/transactions" element={
            <AuthGuard>
              <PageTransition><Transactions /></PageTransition>
            </AuthGuard>
          } />
          <Route path="/monthly" element={
            <AuthGuard>
              <PageTransition><Monthly /></PageTransition>
            </AuthGuard>
          } />
          <Route path="/analytics" element={
            <AuthGuard>
              <PageTransition><Analytics /></PageTransition>
            </AuthGuard>
          } />
          <Route path="/bills" element={
            <AuthGuard>
              <PageTransition><Bills /></PageTransition>
            </AuthGuard>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>

        <BottomNav />
      </div>
    </BrowserRouter>
  )
}
