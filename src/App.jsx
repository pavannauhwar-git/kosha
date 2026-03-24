import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'
import { motion } from 'framer-motion'
import { AuthProvider, useAuth } from './context/AuthContext'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient, invalidateQueryFamilies } from './lib/queryClient'
import { supabase } from './lib/supabase'
import { TRANSACTION_INVALIDATION_KEYS } from './hooks/useTransactions'
import { LIABILITY_INVALIDATION_KEYS } from './hooks/useLiabilities'
import AuthGuard from './components/AuthGuard'
import ProfileMenu from './components/ProfileMenu'
import { House, List, CalendarDots, ChartBar, Receipt } from '@phosphor-icons/react'
import { C } from './lib/colors'
import { useScrollDirection } from './hooks/useScrollDirection'
import KoshaLogo from './components/KoshaLogo'
import { isSuppressed } from './lib/mutationGuard'
import { recordRuntimeRoute } from './lib/runtimeMonitor'

// ── Eager ────────────────────────────────────────────────────────────────
import Login from './pages/Login'

// ── Lazy ─────────────────────────────────────────────────────────────────
const Onboarding = lazy(() => import('./pages/Onboarding'))
const NotFound = lazy(() => import('./pages/NotFound'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Transactions = lazy(() => import('./pages/Transactions'))
const Monthly = lazy(() => import('./pages/Monthly'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Bills = lazy(() => import('./pages/Bills'))
const About = lazy(() => import('./pages/About'))
const Guide = lazy(() => import('./pages/Guide'))
const Reconciliation = lazy(() => import('./pages/Reconciliation'))
const ReportBug = lazy(() => import('./pages/ReportBug'))
const Settings = lazy(() => import('./pages/Settings'))

function PageFallback() {
  return <div className="min-h-dvh bg-kosha-bg" />
}

const NAV = [
  { path: '/', label: 'Home', Icon: House },
  { path: '/transactions', label: 'Activity', Icon: List },
  { path: '/monthly', label: 'Monthly', Icon: CalendarDots },
  { path: '/analytics', label: 'Insights', Icon: ChartBar },
  { path: '/bills', label: 'Bills', Icon: Receipt },
]

const REALTIME_INVALIDATION_POLICIES = [
  { key: 'transactions', table: 'transactions', queryKeys: TRANSACTION_INVALIDATION_KEYS },
  { key: 'liabilities', table: 'liabilities', queryKeys: LIABILITY_INVALIDATION_KEYS },
]

const NAV_HIDE_ON = ['/login', '/onboarding', '/join', '/auth', '/about', '/not-found', '/report-bug', '/settings', '/guide']

// ── Desktop sidebar ───────────────────────────────────────────────────────
function DesktopSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { profile, user } = useAuth()

  if (NAV_HIDE_ON.some(p => location.pathname.startsWith(p))) return null

  const active = NAV.findIndex(n =>
    n.path === '/' ? location.pathname === '/' : location.pathname.startsWith(n.path)
  )

  const displayName = profile?.display_name || user?.email?.split('@')[0] || 'Account'

  return (
    <aside
      className="hidden md:flex flex-col"
      style={{
        position: 'fixed',
        top: 0, left: 0, bottom: 0,
        width: 236,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(244,248,255,0.94) 100%)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        borderRight: `1px solid rgba(148,163,184,0.22)`,
        zIndex: 30,
        padding: '0 14px',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 18px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 18px)',
      }}
    >
      <div className="flex items-center gap-2.5 px-2 pb-6 pt-2">
        <KoshaLogo size={32} />
        <div>
          <p className="text-[15px] font-bold text-ink tracking-tight leading-none">Kosha</p>
          <p className="text-[10px] text-ink-3 font-medium tracking-widest uppercase mt-0.5">Finance</p>
        </div>
      </div>

      <nav className="flex flex-col gap-1.5 flex-1">
        {NAV.map((item, i) => {
          const isActive = i === active
          return (
            <button
              key={item.path}
              onClick={() => { if (navigator.vibrate) navigator.vibrate(6); navigate(item.path) }}
              className="flex items-center gap-3 px-3.5 py-3 rounded-pill transition-colors duration-100 w-full text-left"
              style={{ background: isActive ? 'rgba(11,87,208,0.14)' : 'transparent' }}
            >
              <item.Icon size={20} weight={isActive ? 'fill' : 'regular'} color={isActive ? C.brand : C.inkMuted} />
              <span className="text-[14px]" style={{ color: isActive ? C.brand : C.inkMuted, fontWeight: isActive ? 700 : 500 }}>
                {item.label}
              </span>
            </button>
          )
        })}
      </nav>

      <div className="px-2 pt-4" style={{ borderTop: '1px solid rgba(148,163,184,0.22)' }}>
        <div className="flex items-center gap-2.5">
          <ProfileMenu dropUp />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-ink truncate">{displayName}</p>
          </div>
        </div>
      </div>
    </aside>
  )
}

// ── Mobile bottom nav ─────────────────────────────────────────────────────
function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const scrolledDown = useScrollDirection()

  if (NAV_HIDE_ON.some(p => location.pathname.startsWith(p))) return null

  const active = NAV.findIndex(n =>
    n.path === '/' ? location.pathname === '/' : location.pathname.startsWith(n.path)
  )

  return (
    <div className={`nav-float-wrap md:hidden ${scrolledDown ? 'nav-float-wrap--hidden' : ''}`}>
      <nav className="nav-float">
        {NAV.map((item, i) => {
          const isActive = i === active
          return (
            <motion.button
              key={item.path}
              className="nav-float-item"
              onClick={() => { if (navigator.vibrate) navigator.vibrate(6); navigate(item.path) }}
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 600, damping: 28 }}
            >
              <div className="nav-icon-wrap">
                {isActive && (
                  <motion.div layoutId="nav-pill" className="nav-icon-bg"
                    transition={{ type: 'spring', stiffness: 500, damping: 38, mass: 0.8 }} />
                )}
                <motion.span className="nav-icon-layer" animate={{ opacity: isActive ? 1 : 0 }} transition={{ duration: 0.15 }}>
                  <item.Icon size={22} weight="fill" color={C.brand} />
                </motion.span>
                <motion.span className="nav-icon-layer" animate={{ opacity: isActive ? 0 : 1 }} transition={{ duration: 0.15 }}>
                  <item.Icon size={22} weight="regular" color={C.inkMuted} />
                </motion.span>
              </div>
              <motion.span className="nav-label"
                animate={{ color: isActive ? C.brand : C.inkMuted, fontWeight: isActive ? 700 : 500, opacity: isActive ? 1 : 0.84 }}
                transition={{ duration: 0.15 }}>
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
// Probes the WebSocket once. If it fails, calls supabase.realtime.disconnect()
// to stop ALL internal Supabase retry loops — these fire at the browser level
// and flood the connection pool, blocking REST API refetches.
// The app works fully without Realtime via local cache injection on mutations.
// Realtime only adds multi-device / multi-tab sync on top of that.
function GlobalRealtimeSync() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return

    const timeoutIds = new Map()
    let channel = null
    let gaveUp = false

    function scheduleInvalidate(key, invalidate) {
      if (isSuppressed(key)) return
      clearTimeout(timeoutIds.get(key))
      timeoutIds.set(key, setTimeout(() => {
        timeoutIds.delete(key)
        if (!isSuppressed(key)) void invalidate()
      }, 300))
    }

    // Give the WebSocket 8 seconds to connect. If it hasn't by then,
    // disconnect realtime entirely to stop browser-level retry spam.
    const giveUpTimer = setTimeout(() => {
      if (!gaveUp && channel) {
        gaveUp = true
        console.warn('[Kosha] Realtime WebSocket did not connect within 8s. Disabling to unblock HTTP requests.')
        supabase.removeChannel(channel)
        channel = null
        // This stops ALL internal Supabase realtime retry loops.
        supabase.realtime.disconnect()
      }
    }, 8000)

    channel = supabase.channel(`kosha-sync-${user.id}`)

    for (const policy of REALTIME_INVALIDATION_POLICIES) {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: policy.table },
        () => scheduleInvalidate(policy.key, () => invalidateQueryFamilies(policy.queryKeys))
      )
    }

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        // Connected — cancel the give-up timer
        clearTimeout(giveUpTimer)
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        if (!gaveUp) {
          gaveUp = true
          clearTimeout(giveUpTimer)
          console.warn('[Kosha] Realtime channel error. Disabling to unblock HTTP requests.')
          supabase.removeChannel(channel)
          channel = null
          supabase.realtime.disconnect()
        }
      }
    })

    return () => {
      clearTimeout(giveUpTimer)
      timeoutIds.forEach(id => clearTimeout(id))
      if (channel) supabase.removeChannel(channel)
    }
  }, [user?.id])

  return null
}

function ContentWrapper({ children }) {
  const location = useLocation()
  const hasSidebar = !NAV_HIDE_ON.some(p => location.pathname.startsWith(p))
  return (
    <div className={hasSidebar ? 'md:ml-[236px]' : ''}>
      {children}
    </div>
  )
}

function RuntimeRouteTracker() {
  const location = useLocation()

  useEffect(() => {
    const path = `${location.pathname}${location.search || ''}`
    recordRuntimeRoute(path)
  }, [location.pathname, location.search])

  return null
}

// ── App shell ─────────────────────────────────────────────────────────────
function AppShell() {
  return (
    <div className="min-h-dvh bg-kosha-bg">
      <RuntimeRouteTracker />
      <DesktopSidebar />
      <ContentWrapper>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/join/:token" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/not-found" element={<Suspense fallback={<PageFallback />}><NotFound /></Suspense>} />
          <Route path="/onboarding" element={<Suspense fallback={<PageFallback />}><AuthGuard><Onboarding /></AuthGuard></Suspense>} />
          <Route path="/" element={<Suspense fallback={<PageFallback />}><AuthGuard><Dashboard /></AuthGuard></Suspense>} />
          <Route path="/transactions" element={<Suspense fallback={<PageFallback />}><AuthGuard><Transactions /></AuthGuard></Suspense>} />
          <Route path="/monthly" element={<Suspense fallback={<PageFallback />}><AuthGuard><Monthly /></AuthGuard></Suspense>} />
          <Route path="/analytics" element={<Suspense fallback={<PageFallback />}><AuthGuard><Analytics /></AuthGuard></Suspense>} />
          <Route path="/bills" element={<Suspense fallback={<PageFallback />}><AuthGuard><Bills /></AuthGuard></Suspense>} />
          <Route path="/reconciliation" element={<Suspense fallback={<PageFallback />}><AuthGuard><Reconciliation /></AuthGuard></Suspense>} />
          <Route path="/guide" element={<Suspense fallback={<PageFallback />}><AuthGuard><Guide /></AuthGuard></Suspense>} />
          <Route path="/settings" element={<Suspense fallback={<PageFallback />}><AuthGuard><Settings /></AuthGuard></Suspense>} />
          <Route path="/about" element={<Suspense fallback={<PageFallback />}><About /></Suspense>} />
          <Route path="/report-bug" element={<Suspense fallback={<PageFallback />}><ReportBug /></Suspense>} />
          <Route path="*" element={<Navigate to="/not-found" replace />} />
        </Routes>
      </ContentWrapper>
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
