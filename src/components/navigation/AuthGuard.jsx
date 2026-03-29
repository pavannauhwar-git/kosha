import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

// ── Shimmer block primitives ──────────────────────────────────────────────
function S({ className }) {
  return <div className={`shimmer rounded-xl ${className}`} />
}

// ── Per-route skeletons ───────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="px-5 pt-10 pb-36 space-y-6">
      {/* Hero balance card */}
      <S className="h-44 w-full" />
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <S className="h-20" />
        <S className="h-20" />
        <S className="h-20" />
      </div>
      {/* Section label */}
      <S className="h-4 w-32" />
      {/* Transaction rows */}
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <S className="h-10 w-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <S className="h-3.5 w-3/5" />
            <S className="h-3 w-2/5" />
          </div>
          <S className="h-4 w-16" />
        </div>
      ))}
    </div>
  )
}

function TransactionsSkeleton() {
  return (
    <div className="px-5 pt-10 pb-36 space-y-5">
      {/* Search bar */}
      <S className="h-11 w-full" />
      {/* Filter chips */}
      <div className="flex gap-2">
        <S className="h-8 w-20" />
        <S className="h-8 w-20" />
        <S className="h-8 w-20" />
      </div>
      {/* Transaction rows */}
      {[...Array(8)].map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <S className="h-10 w-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <S className="h-3.5 w-3/5" />
            <S className="h-3 w-2/5" />
          </div>
          <S className="h-4 w-16" />
        </div>
      ))}
    </div>
  )
}

function MonthlySkeleton() {
  return (
    <div className="px-5 pt-10 pb-36 space-y-6">
      {/* Month navigator */}
      <div className="flex items-center justify-between">
        <S className="h-8 w-8" />
        <S className="h-5 w-28" />
        <S className="h-8 w-8" />
      </div>
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <S className="h-24" />
        <S className="h-24" />
      </div>
      {/* Section label */}
      <S className="h-4 w-32" />
      {/* Category rows */}
      {[...Array(6)].map((_, i) => (
        <div key={i} className="space-y-2">
          <div className="flex justify-between">
            <S className="h-3.5 w-24" />
            <S className="h-3.5 w-16" />
          </div>
          <S className="h-2 w-full rounded-full" />
        </div>
      ))}
    </div>
  )
}

function AnalyticsSkeleton() {
  return (
    <div className="px-5 pt-10 pb-36 space-y-6">
      {/* Year selector */}
      <S className="h-10 w-28 mx-auto" />
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-3">
        <S className="h-24" />
        <S className="h-24" />
        <S className="h-24" />
        <S className="h-24" />
      </div>
      {/* Bar chart area */}
      <S className="h-48 w-full" />
      {/* Donut area */}
      <S className="h-40 w-full" />
    </div>
  )
}

function BillsSkeleton() {
  return (
    <div className="px-5 pt-10 pb-36 space-y-5">
      {/* Section label */}
      <S className="h-4 w-28" />
      {/* Bill cards */}
      {[...Array(4)].map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="flex-1 space-y-2">
            <S className="h-4 w-2/3" />
            <S className="h-3 w-1/3" />
          </div>
          <S className="h-8 w-20" />
        </div>
      ))}
      {/* Section label */}
      <S className="h-4 w-24 mt-4" />
      {/* Paid bill rows */}
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="flex-1 space-y-2">
            <S className="h-4 w-1/2" />
            <S className="h-3 w-1/4" />
          </div>
          <S className="h-4 w-12" />
        </div>
      ))}
    </div>
  )
}

// ── Route → skeleton map ──────────────────────────────────────────────────
export function RouteSkeleton({ pathname }) {
  if (pathname.startsWith('/transactions')) return <TransactionsSkeleton />
  if (pathname.startsWith('/monthly'))      return <MonthlySkeleton />
  if (pathname.startsWith('/analytics'))    return <AnalyticsSkeleton />
  if (pathname.startsWith('/bills'))        return <BillsSkeleton />
  return <DashboardSkeleton />
}

// ── AuthGuard ─────────────────────────────────────────────────────────────
export default function AuthGuard({ children }) {
  const { user, profile, loading, profileLoading } = useAuth()
  const location = useLocation()

  // Auth initialising — show the skeleton that matches the destination route
  if (loading || (user && profileLoading)) return (
    <div className="min-h-dvh bg-kosha-bg">
      <RouteSkeleton pathname={location.pathname} />
    </div>
  )

  // No session
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  // User confirmed — require a resolved onboarded profile before entering the app.
  if ((!profile || !profile.onboarded) && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  return children
}
