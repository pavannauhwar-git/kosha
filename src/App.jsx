import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { motion } from 'framer-motion'
import { AuthProvider } from './hooks/useAuth'
import { AppDataProvider } from './hooks/useAppDataStore'
import { useAuth } from './hooks/useAuth'
import AuthGuard    from './components/AuthGuard'
import ProfileMenu  from './components/ProfileMenu'
import { House, List, CalendarDots, ChartBar, Receipt } from '@phosphor-icons/react'
import { C } from './lib/colors'
import { prefetch } from './hooks/useTransactions'

// ── Eager: Dashboard and Login are needed immediately ────────────────────
import Dashboard    from './pages/Dashboard'
import Login        from './pages/Login'
import Onboarding   from './pages/Onboarding'

// ── Lazy: heavier pages loaded on first visit ────────────────────────────
// Reduces the initial JS bundle the phone has to parse on first open.
// Each page is code-split into its own chunk (~30-50KB savings each).
const Transactions = lazy(() => import('./pages/Transactions'))
const Monthly      = lazy(() => import('./pages/Monthly'))
const Analytics    = lazy(() => import('./pages/Analytics'))
const Bills        = lazy(() => import('./pages/Bills'))

// ── Skeleton fallback for lazy pages ─────────────────────────────────────
// AuthGuard already shows per-route skeletons — we just need a minimal
// wrapper for the brief Suspense window before AuthGuard kicks in.
function PageFallback() {
  return (
    <div className="min-h-dvh bg-kosha-bg" />
  )
}

const NAV = [
  { path: '/',             label: 'Home',     Icon: House        },
  { path: '/transactions', label: 'Activity', Icon: List         },
  { path: '/monthly',      label: 'Monthly',  Icon: CalendarDots },
  { path: '/analytics',    label: 'Insights', Icon: ChartBar     },
  { path: '/bills',        label: 'Bills',    Icon: Receipt      },
]

// ── Global header — ProfileMenu fixed top-right, rendered once ────────────
// Same principle as BottomNav: one instance, one position, no per-page drift.
// Hidden on auth/onboarding pages where the nav is also hidden.
function GlobalHeader() {
  const location = useLocation()

  const hideOn = ['/login', '/onboarding', '/join', '/auth']
  if (hideOn.some(p => location.pathname.startsWith(p))) return null

  return (
    <div className="fixed top-4 right-4 z-30">
      <ProfileMenu />
    </div>
  )
}

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
              onPointerDown={() => {
                // Warm the cache before the finger lifts — makes tab switches feel instant
                prefetch(item.path)
              }}
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
                  <item.Icon size={22} weight="fill" color={C.brand} />
                </motion.span>
                {/* Regular icon (inactive) — opacity cross-fade */}
                <motion.span
                  className="nav-icon-layer"
                  animate={{ opacity: isActive ? 0 : 1 }}
                  transition={{ duration: 0.15 }}
                >
                  <item.Icon size={22} weight="regular" color={C.inkMuted} />
                </motion.span>
              </div>

              {/* ── Label ── */}
              <motion.span
                className="nav-label"
                animate={{
                  color:      isActive ? C.brand : C.inkMuted,
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
        <AppDataProvider>
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

              {/* Protected — eager */}
              <Route path="/" element={<AuthGuard><Dashboard /></AuthGuard>} />

              {/* Protected — lazy (code-split, loaded on first navigation) */}
              <Route path="/transactions" element={
                <Suspense fallback={<PageFallback />}>
                  <AuthGuard><Transactions /></AuthGuard>
                </Suspense>
              } />
              <Route path="/monthly" element={
                <Suspense fallback={<PageFallback />}>
                  <AuthGuard><Monthly /></AuthGuard>
                </Suspense>
              } />
              <Route path="/analytics" element={
                <Suspense fallback={<PageFallback />}>
                  <AuthGuard><Analytics /></AuthGuard>
                </Suspense>
              } />
              <Route path="/bills" element={
                <Suspense fallback={<PageFallback />}>
                  <AuthGuard><Bills /></AuthGuard>
                </Suspense>
              } />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>

            <GlobalHeader />
            <BottomNav />
          </div>
        </AppDataProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
