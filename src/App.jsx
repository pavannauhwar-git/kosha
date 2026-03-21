import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { motion } from 'framer-motion'
import { AuthProvider, useAuth } from './context/AuthContext'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient, invalidateQueryFamilies } from './lib/queryClient'
import { useEffect } from 'react'
import { supabase } from './lib/supabase'
import { TRANSACTION_INVALIDATION_KEYS } from './hooks/useTransactions'
import { LIABILITY_INVALIDATION_KEYS } from './hooks/useLiabilities'
import AuthGuard from './components/AuthGuard'
import ProfileMenu from './components/ProfileMenu'
import { House, List, CalendarDots, ChartBar, Receipt } from '@phosphor-icons/react'
import { C } from './lib/colors'
import { useScrollDirection } from './hooks/useScrollDirection'
import KoshaLogo from './components/KoshaLogo'

// ── Eager ────────────────────────────────────────────────────────────────
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import NotFound from './pages/NotFound'

// ── Lazy ─────────────────────────────────────────────────────────────────
const Transactions = lazy(() => import('./pages/Transactions'))
const Monthly      = lazy(() => import('./pages/Monthly'))
const Analytics    = lazy(() => import('./pages/Analytics'))
const Bills        = lazy(() => import('./pages/Bills'))
const About        = lazy(() => import('./pages/About'))
const ReportBug    = lazy(() => import('./pages/ReportBug'))
const Settings     = lazy(() => import('./pages/Settings'))

function PageFallback() {
  return <div className="min-h-dvh bg-kosha-bg" />
}

const NAV = [
  { path: '/',             label: 'Home',     Icon: House      },
  { path: '/transactions', label: 'Activity', Icon: List       },
  { path: '/monthly',      label: 'Monthly',  Icon: CalendarDots },
  { path: '/analytics',    label: 'Insights', Icon: ChartBar   },
  { path: '/bills',        label: 'Bills',    Icon: Receipt    },
]

const REALTIME_INVALIDATION_POLICIES = [
  { key: 'transactions', table: 'transactions', queryKeys: TRANSACTION_INVALIDATION_KEYS },
  { key: 'liabilities',  table: 'liabilities',  queryKeys: LIABILITY_INVALIDATION_KEYS  },
]

const NAV_HIDE_ON = ['/login', '/onboarding', '/join', '/auth', '/about', '/not-found', '/report-bug', '/settings']

// ── Desktop sidebar ───────────────────────────────────────────────────────
function DesktopSidebar() {
  const location = useLocation()
  const navigate  = useNavigate()
  const { profile, user, signOut } = useAuth()

  if (NAV_HIDE_ON.some(p => location.pathname.startsWith(p))) return null

  const active = NAV.findIndex(n =>
    n.path === '/' ? location.pathname === '/' : location.pathname.startsWith(n.path)
  )

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Account'
  const initial     = displayName[0].toUpperCase()
  const avatarUrl   = profile?.avatar_url || null

  return (
    <aside
      className="hidden md:flex flex-col"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        width: 220,
        background: 'rgba(255,255,255,0.94)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRight: `1px solid ${C.brandBorder}`,
        zIndex: 30,
        padding: '0 12px',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-2 pb-6 pt-2">
        <KoshaLogo size={32} />
        <div>
          <p className="text-[15px] font-bold text-ink tracking-tight leading-none">Kosha</p>
          <p className="text-[10px] text-ink-3 font-medium tracking-widest uppercase mt-0.5">
            Finance
          </p>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex flex-col gap-1 flex-1">
        {NAV.map((item, i) => {
          const isActive = i === active
          return (
            <button
              key={item.path}
              onClick={() => {
                if (navigator.vibrate) navigator.vibrate(6)
                navigate(item.path)
              }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-card
                         transition-colors duration-100 w-full text-left"
              style={{
                background: isActive ? C.brandContainer : 'transparent',
              }}
            >
              <item.Icon
                size={20}
                weight={isActive ? 'fill' : 'regular'}
                color={isActive ? C.brand : C.inkMuted}
              />
              <span
                className="text-[14px]"
                style={{
                  color:      isActive ? C.brand : C.inkMuted,
                  fontWeight: isActive ? 700 : 500,
                }}
              >
                {item.label}
              </span>
            </button>
          )
        })}
      </nav>

      {/* Profile footer */}
      <div
        className="flex items-center gap-2.5 px-2 pt-4"
        style={{ borderTop: `1px solid ${C.brandBorder}` }}
      >
        <div
          className="w-8 h-8 rounded-full bg-brand-container flex items-center
                     justify-center overflow-hidden shrink-0"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
          ) : (
            <span className="text-[12px] font-bold text-brand">{initial}</span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-ink truncate">{displayName}</p>
        </div>
        {/* Settings shortcut */}
        <button
          onClick={() => navigate('/settings')}
          className="w-7 h-7 rounded-full flex items-center justify-center
                     hover:bg-kosha-surface-2 transition-colors shrink-0"
          title="Account Settings"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke={C.ink3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
          </svg>
        </button>
      </div>
    </aside>
  )
}

// ── Mobile bottom nav (pill) — unchanged, hidden on md+ ──────────────────
function BottomNav() {
  const location    = useLocation()
  const navigate    = useNavigate()
  const scrolledDown = useScrollDirection()

  if (NAV_HIDE_ON.some(p => location.pathname.startsWith(p))) return null

  const active = NAV.findIndex(n =>
    n.path === '/' ? location.pathname === '/' : location.pathname.startsWith(n.path)
  )

  return (
    <div
      className={`nav-float-wrap md:hidden ${scrolledDown ? 'nav-float-wrap--hidden' : ''}`}
    >
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
              <div className="nav-icon-wrap">
                {isActive && (
                  <motion.div
                    layoutId="nav-pill"
                    className="nav-icon-bg"
                    transition={{ type: 'spring', stiffness: 500, damping: 38, mass: 0.8 }}
                  />
                )}
                <motion.span
                  className="nav-icon-layer"
                  animate={{ opacity: isActive ? 1 : 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <item.Icon size={22} weight="fill" color={C.brand} />
                </motion.span>
                <motion.span
                  className="nav-icon-layer"
                  animate={{ opacity: isActive ? 0 : 1 }}
                  transition={{ duration: 0.15 }}
                >
                  <item.Icon size={22} weight="regular" color={C.inkMuted} />
                </motion.span>
              </div>
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

// ── Auth callback ─────────────────────────────────────────────────────────
function AuthCallback() {
  const { user, profile, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  if (profile && !profile.onboarded) return <Navigate to="/onboarding" replace />
  return <Navigate to="/" replace />
}

// ── Global Realtime Sync ──────────────────────────────────────────────────
function GlobalRealtimeSync() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return

    const timeoutIds = new Map()
    const scheduleInvalidate = (key, invalidate) => {
      clearTimeout(timeoutIds.get(key))
      timeoutIds.set(key, setTimeout(() => {
        timeoutIds.delete(key)
        void invalidate()
      }, 300))
    }

    let channel = supabase.channel(`schema-db-changes-${user.id}`)
    for (const policy of REALTIME_INVALIDATION_POLICIES) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: policy.table },
        () => scheduleInvalidate(policy.key, () => invalidateQueryFamilies(policy.queryKeys))
      )
    }
    channel = channel.subscribe()

    return () => {
      timeoutIds.forEach(id => clearTimeout(id))
      supabase.removeChannel(channel)
    }
  }, [user])

  return null
}

// ── App shell ─────────────────────────────────────────────────────────────
function AppShell() {
  return (
    <div className="min-h-dvh bg-kosha-bg">

      {/* Desktop sidebar — hidden on mobile */}
      <DesktopSidebar />

      {/* Content — offset by sidebar width on desktop */}
      <div className="md:ml-[220px]">
        <Routes>
          {/* Public */}
          <Route path="/login"         element={<Login />} />
          <Route path="/join/:token"   element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/not-found"     element={<NotFound />} />

          {/* Onboarding */}
          <Route path="/onboarding" element={<AuthGuard><Onboarding /></AuthGuard>} />

          {/* Protected — eager */}
          <Route path="/" element={<AuthGuard><Dashboard /></AuthGuard>} />

          {/* Protected — lazy */}
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
          <Route path="/settings" element={
            <Suspense fallback={<PageFallback />}>
              <AuthGuard><Settings /></AuthGuard>
            </Suspense>
          } />
          <Route path="/about" element={
            <Suspense fallback={<PageFallback />}>
              <About />
            </Suspense>
          } />
          <Route path="/report-bug" element={
            <Suspense fallback={<PageFallback />}>
              <ReportBug />
            </Suspense>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/not-found" replace />} />
        </Routes>
      </div>

      {/* Mobile only */}
      <BottomNav />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <GlobalRealtimeSync />
          <AppShell />
        </QueryClientProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
