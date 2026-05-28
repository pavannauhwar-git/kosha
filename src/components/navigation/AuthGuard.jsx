import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

// ── Shimmer block primitives ──────────────────────────────────────────────
function S({ className, delay = 0 }) {
  return (
    <div
      className={`shimmer rounded-xl ${className}`}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    />
  )
}

// ── Per-route skeletons ───────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="min-h-dvh px-5 pt-4 pb-[var(--nav-height)] space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between mt-2 mb-5">
        <div className="space-y-1.5">
          <S className="h-3 w-20" />
          <S className="h-6 w-44" delay={60} />
        </div>
        <S className="h-9 w-9 rounded-full flex-shrink-0" delay={80} />
      </div>

      {/* Hero balance card */}
      <S className="h-[220px] w-full rounded-3xl" delay={20} />

      {/* Stat chips row */}
      <div className="grid grid-cols-2 gap-2.5">
        <S className="h-24 rounded-2xl" delay={40} />
        <S className="h-24 rounded-2xl" delay={80} />
      </div>

      {/* Section label */}
      <S className="h-3 w-28 mt-5" delay={100} />

      {/* Recent transactions */}
      <div className="space-y-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <S className="h-10 w-10 rounded-full flex-shrink-0" delay={i * 30} />
            <div className="flex-1 space-y-2">
              <S className="h-3.5 w-3/5" delay={i * 30 + 20} />
              <S className="h-3 w-2/5" delay={i * 30 + 40} />
            </div>
            <S className="h-4 w-14" delay={i * 30 + 10} />
          </div>
        ))}
      </div>
    </div>
  )
}

function TransactionsSkeleton() {
  return (
    <div className="min-h-dvh px-5 pt-4 pb-[var(--nav-height)] space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mt-2 mb-5">
        <S className="h-7 w-32" />
        <S className="h-8 w-8 rounded-full" delay={60} />
      </div>
      {/* Search bar */}
      <S className="h-11 w-full rounded-xl" />
      {/* Filter chips */}
      <div className="flex gap-2">
        <S className="h-8 w-20 rounded-pill" delay={20} />
        <S className="h-8 w-24 rounded-pill" delay={40} />
        <S className="h-8 w-18 rounded-pill" delay={60} />
      </div>
      {/* Transaction rows */}
      <div className="space-y-4 pt-1">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <S className="h-10 w-10 rounded-full flex-shrink-0" delay={i * 25} />
            <div className="flex-1 space-y-2">
              <S className="h-3.5 w-3/5" delay={i * 25 + 15} />
              <S className="h-3 w-2/5" delay={i * 25 + 30} />
            </div>
            <S className="h-4 w-16" delay={i * 25 + 10} />
          </div>
        ))}
      </div>
    </div>
  )
}

function MonthlySkeleton() {
  return (
    <div className="min-h-dvh px-5 pt-4 pb-[var(--nav-height)] space-y-4">
      {/* Month stepper */}
      <div className="flex items-center justify-between mb-2">
        <S className="h-8 w-8 rounded-full" />
        <S className="h-5 w-32" />
        <S className="h-8 w-8 rounded-full" />
      </div>

      {/* MonthHeroCard */}
      <S className="h-[200px] w-full rounded-3xl" delay={20} />

      {/* Month-over-month snapshot */}
      <S className="h-28 w-full rounded-2xl" delay={40} />

      {/* Month close summary */}
      <S className="h-36 w-full rounded-2xl" delay={60} />

      {/* Category breakdown rows */}
      <div className="space-y-3 pt-1">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="space-y-1.5">
            <div className="flex justify-between">
              <S className="h-3.5 w-24" delay={i * 25} />
              <S className="h-3.5 w-14" delay={i * 25 + 15} />
            </div>
            <S className="h-1.5 w-full rounded-full" delay={i * 25 + 10} />
          </div>
        ))}
      </div>
    </div>
  )
}

function AnalyticsSkeleton() {
  return (
    <div className="min-h-dvh px-5 pt-4 pb-[var(--nav-height)] space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mt-2 mb-5">
        <S className="h-7 w-32" />
        <S className="h-8 w-8 rounded-full" delay={60} />
      </div>
      {/* Year selector */}
      <S className="h-10 w-28 mx-auto rounded-pill" />
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3">
        {[0,1,2,3].map(i => <S key={i} className="h-20 rounded-2xl" delay={i * 30} />)}
      </div>
      {/* Bar chart area */}
      <S className="h-52 w-full rounded-2xl" delay={60} />
      {/* Bottom legend */}
      <div className="flex gap-4 justify-center">
        <S className="h-3 w-16 rounded-pill" delay={80} />
        <S className="h-3 w-16 rounded-pill" delay={100} />
        <S className="h-3 w-16 rounded-pill" delay={120} />
      </div>
    </div>
  )
}

function BillsSkeleton() {
  return (
    <div className="min-h-dvh px-5 pt-4 pb-[var(--nav-height)] space-y-5">
      {/* Header */}
      <S className="h-8 w-32 mt-2 mb-6" />
      {/* Tabs */}
      <div className="flex gap-2">
        <S className="h-10 w-1/2 rounded-lg" />
        <S className="h-10 w-1/2 rounded-lg" />
      </div>
      {/* Summary Box */}
      <S className="h-24 w-full rounded-2xl" />
      {/* Bill cards */}
      <S className="h-4 w-28 mt-4" />
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <S className="h-10 w-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <S className="h-4 w-2/3" />
              <S className="h-3 w-1/3" />
            </div>
            <S className="h-8 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}

function SimplePageSkeleton() {
  return (
    <div className="min-h-dvh px-5 pt-4 pb-[var(--nav-height)] space-y-6">
      {/* Header */}
      <S className="h-8 w-40 mt-2 mb-6" />
      <div className="space-y-4">
        <S className="h-20 w-full rounded-2xl" />
        <S className="h-20 w-full rounded-2xl" />
        <S className="h-20 w-full rounded-2xl" />
      </div>
    </div>
  )
}

// ── Route → skeleton map ──────────────────────────────────────────────────
function SplitwiseSkeleton() {
  return (
    <div className="min-h-dvh px-5 pt-4 pb-[var(--nav-height)] space-y-5">
      {/* Balances Hero */}
      <S className="h-32 w-full" />
      {/* Tabs */}
      <div className="flex gap-2">
        <S className="h-10 w-1/2" />
        <S className="h-10 w-1/2" />
      </div>
      {/* List items */}
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <S className="h-12 w-12 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <S className="h-4 w-1/2" />
            <S className="h-3 w-1/3" />
          </div>
          <S className="h-5 w-16" />
        </div>
      ))}
    </div>
  )
}

function SettingsSkeleton() {
  return (
    <div className="min-h-dvh px-5 pt-4 pb-[var(--nav-height)] space-y-6">
      {/* Profile Header */}
      <div className="flex items-center gap-4">
        <S className="h-16 w-16 rounded-full" />
        <div className="flex-1 space-y-2">
          <S className="h-5 w-32" />
          <S className="h-3 w-24" />
        </div>
      </div>
      {/* Settings groups */}
      {[...Array(3)].map((_, i) => (
        <div key={i} className="space-y-3">
          <S className="h-4 w-20" />
          <S className="h-16 w-full" />
          <S className="h-16 w-full" />
        </div>
      ))}
    </div>
  )
}

export function RouteSkeleton({ pathname }) {
  if (pathname === '/' || pathname === '')  return <DashboardSkeleton />
  if (pathname.startsWith('/transactions')) return <TransactionsSkeleton />
  if (pathname.startsWith('/monthly'))      return <MonthlySkeleton />
  if (pathname.startsWith('/analytics'))    return <AnalyticsSkeleton />
  if (pathname.startsWith('/bills') || pathname.startsWith('/loans') || pathname.startsWith('/obligations')) return <BillsSkeleton />
  if (pathname.startsWith('/splitwise'))    return <SplitwiseSkeleton />
  if (pathname.startsWith('/settings'))     return <SettingsSkeleton />
  return <SimplePageSkeleton />
}

// ── AuthGuard ─────────────────────────────────────────────────────────────
export default function AuthGuard({ children }) {
  const { user, profile, loading, profileLoading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  // Imperative redirect — fires once per condition change, unlike <Navigate>
  // which re-fires its internal useEffect on every render (including during
  // AnimatePresence exit animations, causing "Maximum update depth" warnings).
  useEffect(() => {
    if (loading || (user && profileLoading)) return

    if (!user) {
      navigate('/login', { replace: true, state: { from: location.pathname } })
    } else if ((!profile || !profile.onboarded) && location.pathname !== '/onboarding') {
      navigate('/onboarding', { replace: true })
    } else if (profile?.onboarded && location.pathname === '/onboarding') {
      // Already onboarded — send to dashboard instead of re-showing onboarding
      navigate('/', { replace: true })
    }
  }, [loading, user, profileLoading, profile, navigate, location.pathname])

  // Auth initialising — show the skeleton that matches the destination route
  if (loading || (user && profileLoading)) return (
    <div className="route-skeleton-shell">
      <RouteSkeleton pathname={location.pathname} />
    </div>
  )

  // Awaiting redirect — show skeleton instead of null flash
  if (!user || ((!profile || !profile.onboarded) && location.pathname !== '/onboarding')) {
    return (
      <div className="route-skeleton-shell">
        <RouteSkeleton pathname={location.pathname} />
      </div>
    )
  }

  // Onboarding page: don't render content for already-onboarded users (redirect fires above)
  if (profile?.onboarded && location.pathname === '/onboarding') {
    return (
      <div className="route-skeleton-shell">
        <RouteSkeleton pathname="/" />
      </div>
    )
  }

  return children
}
