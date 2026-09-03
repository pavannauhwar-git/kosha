import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import AuthGuard, { RouteSkeleton } from '../navigation/AuthGuard'
import { RouteErrorBoundary } from '../errors/RouteErrorBoundary'
import { useAuth } from '../../context/AuthContext'

// ── Eager ────────────────────────────────────────────────────────────────
import Login from '../../pages/Login'
import InviteLanding from '../../pages/InviteLanding'

// ── Lazy ─────────────────────────────────────────────────────────────────
const Onboarding = lazy(() => import('../../pages/Onboarding'))
const NotFound = lazy(() => import('../../pages/NotFound'))
const Dashboard = lazy(() => import('../../pages/Dashboard'))
const Transactions = lazy(() => import('../../pages/Transactions'))
const Monthly = lazy(() => import('../../pages/Monthly'))
const Analytics = lazy(() => import('../../pages/Analytics'))
const Obligations = lazy(() => import('../../pages/Obligations'))
const BillsPage = lazy(() => import('../../pages/BillsPage'))
const LoansPage = lazy(() => import('../../pages/LoansPage'))
const Splitwise = lazy(() => import('../../pages/Splitwise'))
const About = lazy(() => import('../../pages/About'))
const Guide = lazy(() => import('../../pages/Guide'))
const Reconciliation = lazy(() => import('../../pages/Reconciliation'))
const ReportBug = lazy(() => import('../../pages/ReportBug'))
const Settings = lazy(() => import('../../pages/Settings'))

// All lazy route chunk loaders — used for both hover prefetch and eager preload
export const ROUTE_PRELOADERS = {
  '/': () => import('../../pages/Dashboard'),
  '/transactions': () => import('../../pages/Transactions'),
  '/monthly': () => import('../../pages/Monthly'),
  '/analytics': () => import('../../pages/Analytics'),
  '/obligations': () => import('../../pages/Obligations'),
  '/splitwise': () => import('../../pages/Splitwise'),
  '/reconciliation': () => import('../../pages/Reconciliation'),
  '/settings': () => import('../../pages/Settings'),
  '/guide': () => import('../../pages/Guide'),
  '/about': () => import('../../pages/About'),
  '/report-bug': () => import('../../pages/ReportBug'),
  '/onboarding': () => import('../../pages/Onboarding'),
}

export function PageFallback({ pathname }) {
  return (
    <div className="min-h-dvh bg-kosha-bg">
      <div className="route-skeleton-shell fade-in">
        <RouteSkeleton pathname={pathname || '/'} />
      </div>
    </div>
  )
}

function SuspenseSkeleton({ pathname, children }) {
  return (
    <Suspense fallback={<PageFallback pathname={pathname} />}>
      {children}
    </Suspense>
  )
}

/** Wraps each lazy route with per-route error containment + Suspense skeleton */
function SafeRoute({ pathname, guard, children }) {
  const content = guard ? <AuthGuard>{children}</AuthGuard> : children
  return (
    <RouteErrorBoundary key={pathname} pathname={pathname}>
      <SuspenseSkeleton pathname={pathname}>
        {content}
      </SuspenseSkeleton>
    </RouteErrorBoundary>
  )
}

// ── Auth callback ─────────────────────────────────────────────────────────
function AuthCallback() {
  const { user, profile, loading, profileLoading } = useAuth()
  if (loading || (user && profileLoading)) return null
  if (!user) return <Navigate to="/login" replace />
  if (!profile || !profile.onboarded) return <Navigate to="/onboarding" replace />
  return <Navigate to="/" replace />
}

export function AnimatedRoutes() {
  const location = useLocation()

  useEffect(() => {
    if (typeof document === 'undefined') return

    // Explicitly blur any active text input, textarea, or editable element on route transition
    // to prevent iOS Safari from keeping the native typing/undo session active.
    if (document.activeElement instanceof HTMLElement) {
      const tagName = document.activeElement.tagName.toLowerCase()
      if (tagName === 'input' || tagName === 'textarea' || document.activeElement.isContentEditable) {
        document.activeElement.blur()
      }

      // Blur a focused bottom-nav item so it doesn't trap focus on the new page.
      if (document.activeElement.classList.contains('nav-float-item')) {
        document.activeElement.blur()
      }
    }

    // Move focus to the main landmark so keyboard/screen-reader users land on
    // the new page content. preventScroll keeps it from fighting scroll
    // restoration (FIX 6.1).
    const main = document.getElementById('main-content')
    if (main) {
      requestAnimationFrame(() => main.focus({ preventScroll: true }))
    }
  }, [location.pathname])

  return (
    <div>
      <Routes location={location}>
        <Route path="/login" element={<Login />} />
        <Route path="/join/:token" element={<InviteLanding />} />
        <Route path="/splitwise/join/:splitToken" element={<InviteLanding />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/not-found" element={<SafeRoute pathname="/not-found"><NotFound /></SafeRoute>} />
        <Route path="/onboarding" element={<SafeRoute pathname="/onboarding" guard><Onboarding /></SafeRoute>} />
        <Route path="/" element={<SafeRoute pathname="/" guard><Dashboard /></SafeRoute>} />
        <Route path="/transactions" element={<SafeRoute pathname="/transactions" guard><Transactions /></SafeRoute>} />
        <Route path="/monthly" element={<SafeRoute pathname="/monthly" guard><Monthly /></SafeRoute>} />
        <Route path="/analytics" element={<SafeRoute pathname="/analytics" guard><Analytics /></SafeRoute>} />
        <Route path="/obligations" element={<SafeRoute pathname="/obligations" guard><Obligations /></SafeRoute>} />
        <Route path="/splitwise" element={<SafeRoute pathname="/splitwise" guard><Splitwise /></SafeRoute>} />
        <Route path="/bills" element={<SafeRoute pathname="/bills" guard><BillsPage /></SafeRoute>} />
        <Route path="/loans" element={<SafeRoute pathname="/loans" guard><LoansPage /></SafeRoute>} />
        <Route path="/reconciliation" element={<SafeRoute pathname="/reconciliation" guard><Reconciliation /></SafeRoute>} />
        <Route path="/guide" element={<SafeRoute pathname="/guide" guard><Guide /></SafeRoute>} />
        <Route path="/settings" element={<SafeRoute pathname="/settings" guard><Settings /></SafeRoute>} />
        <Route path="/about" element={<SafeRoute pathname="/about"><About /></SafeRoute>} />
        <Route path="/report-bug" element={<SafeRoute pathname="/report-bug" guard><ReportBug /></SafeRoute>} />
        <Route path="*" element={<Navigate to="/not-found" replace />} />
      </Routes>
    </div>
  )
}
