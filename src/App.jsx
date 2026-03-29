import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { lazy, Suspense, useState, useEffect, useCallback, useRef, use } from 'react'
import { motion } from 'framer-motion'
import { AuthProvider, useAuth } from './context/AuthContext'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient, invalidateQueryFamilies } from './lib/queryClient'
import { supabase } from './lib/supabase'
import { TRANSACTION_INVALIDATION_KEYS, TRANSACTION_INSIGHTS_COLUMNS, TRANSACTION_LIST_COLUMNS } from './hooks/useTransactions'
import { LIABILITY_INVALIDATION_KEYS } from './hooks/useLiabilities'
import AuthGuard, { RouteSkeleton } from './components/navigation/AuthGuard'
import ProfileMenu from './components/navigation/ProfileMenu'
import { House, List, CalendarDots, ChartBar, Receipt } from '@phosphor-icons/react'
import { C } from './lib/colors'
import { useScrollDirection } from './hooks/useScrollDirection'
import KoshaLogo from './components/brand/KoshaLogo'
import { isSuppressed } from './lib/mutationGuard'
import { recordRuntimeRoute } from './lib/runtimeMonitor'

const DASHBOARD_RECENT_COLUMNS =
  'id, date, created_at, type, amount, description, category, investment_vehicle, is_repayment, payment_mode'
const LIABILITY_PREFETCH_COLUMNS =
  'id, description, amount, due_date, is_recurring, recurrence, paid, linked_transaction_id'

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

const ROUTE_PRELOADERS = {
  '/': () => import('./pages/Dashboard'),
  '/transactions': () => import('./pages/Transactions'),
  '/monthly': () => import('./pages/Monthly'),
  '/analytics': () => import('./pages/Analytics'),
  '/bills': () => import('./pages/Bills'),
  '/reconciliation': () => import('./pages/Reconciliation'),
}

function PageFallback({ pathname }) {
  return (
    <div className="min-h-dvh bg-kosha-bg">
      <RouteSkeleton pathname={pathname || '/'} />
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
const BOTTOM_NAV_HIDE_ON = ['/login', '/onboarding', '/join', '/auth', '/about', '/report-bug', '/settings', '/guide']

function useRouteIntentPrefetch() {
  const { user } = useAuth()
  const chunkPrefetched = useRef(new Set())
  const dataPrefetched = useRef(new Set())

  return useCallback((path) => {
    if (!path) return

    if (!chunkPrefetched.current.has(path)) {
      chunkPrefetched.current.add(path)
      const preload = ROUTE_PRELOADERS[path]
      if (preload) void preload().catch(() => {})
    }

    if (!user?.id) return
    if (dataPrefetched.current.has(path)) return

    dataPrefetched.current.add(path)

    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1

    if (path === '/transactions') {
      const txnFilters = {
        type: undefined,
        category: undefined,
        search: undefined,
        limit: 50,
        startDate: undefined,
        endDate: undefined,
        columns: TRANSACTION_LIST_COLUMNS,
      }
      const countFilters = {
        type: undefined,
        category: undefined,
        startDate: undefined,
        endDate: undefined,
      }

      void Promise.all([
        queryClient.prefetchQuery({
          queryKey: ['transactions', txnFilters],
          queryFn: async () => {
            const { data, error } = await supabase
              .from('transactions')
              .select(TRANSACTION_LIST_COLUMNS)
              .eq('user_id', user.id)
              .order('date', { ascending: false })
              .order('created_at', { ascending: false })
              .limit(50)
            if (error) throw error
            return data || []
          },
          staleTime: 20 * 1000,
        }),
        queryClient.prefetchQuery({
          queryKey: ['txnCount', countFilters],
          queryFn: async () => {
            const { count, error } = await supabase
              .from('transactions')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', user.id)
            if (error) throw error
            return count || 0
          },
          staleTime: 30 * 1000,
        }),
      ]).catch(() => {})
      return
    }

    if (path === '/monthly') {
      const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
      const monthEnd = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`

      void Promise.all([
        queryClient.prefetchQuery({
        queryKey: ['month', year, month],
        queryFn: async () => {
          const { data: rows, error } = await supabase.rpc('get_month_summary', {
            p_user_id: user.id,
            p_year: year,
            p_month: month,
          })
          if (error) throw error

          const safeRows = rows || []
          const byCategory = {}
          const byVehicle = {}
          let earned = 0, repayments = 0, expense = 0, investment = 0

          for (const row of safeRows) {
            const amount = Number(row.total || 0)
            if (row.type === 'income') {
              if (row.is_repayment) repayments += amount
              else earned += amount
            }
            if (row.type === 'expense') {
              expense += amount
              if (row.category) byCategory[row.category] = (byCategory[row.category] || 0) + amount
            }
            if (row.type === 'investment') {
              investment += amount
              const vehicle = row.investment_vehicle || 'Other'
              byVehicle[vehicle] = (byVehicle[vehicle] || 0) + amount
            }
          }

          return {
            earned,
            repayments,
            expense,
            investment,
            byCategory,
            byVehicle,
            balance: earned + repayments - expense - investment,
            count: safeRows.length,
          }
        },
        staleTime: 30 * 1000,
        }),
        queryClient.prefetchQuery({
          queryKey: ['liabilitiesMonth', year, month],
          queryFn: async () => {
            const { data, error } = await supabase
              .from('liabilities')
              .select('id, amount, due_date, paid')
              .eq('user_id', user.id)
              .gte('due_date', monthStart)
              .lte('due_date', monthEnd)
              .order('due_date', { ascending: true })

            if (error) throw error
            return data || []
          },
          staleTime: 30 * 1000,
        }),
      ]).catch(() => {})
      return
    }

    if (path === '/analytics') {
      void queryClient.prefetchQuery({
        queryKey: ['year', year],
        queryFn: async () => {
          const { data: result, error } = await supabase
            .rpc('get_year_summary', { p_user_id: user.id, p_year: year })
            .maybeSingle()
          if (error) throw error
          if (!result) {
            return {
              monthly: Array.from({ length: 12 }, (_, i) => ({
                month: i + 1,
                income: 0,
                expense: 0,
                investment: 0,
              })),
              totalIncome: 0,
              totalRepayments: 0,
              totalExpense: 0,
              totalInvestment: 0,
              avgSavings: 0,
              byCategory: {},
              byVehicle: {},
              top5: [],
              count: 0,
            }
          }

          const monthlyRaw = result.monthly_data || []
          const totals = result.totals || {}
          const byCategory = result.category_data || {}
          const byVehicle = result.vehicle_data || {}
          const top5 = result.top5_expenses || []

          const monthMap = Object.fromEntries((monthlyRaw || []).map(m => [m.month_num, m]))
          const monthly = Array.from({ length: 12 }, (_, i) => {
            const m = monthMap[i + 1] || {}
            return {
              month: i + 1,
              income: Number(m.income || 0),
              expense: Number(m.expense || 0),
              investment: Number(m.investment || 0),
            }
          })

          const totalIncome = Number(totals.income || 0)
          const totalRepayments = Number(totals.repayments || 0)
          const totalExpense = Number(totals.expense || 0)
          const totalInvestment = Number(totals.investment || 0)

          const monthsWithIncome = monthly.filter(m => m.income > 0)
          const avgSavings = monthsWithIncome.length
            ? Math.round(
                monthsWithIncome.reduce(
                  (sum, m) => sum + ((m.income - m.expense) / m.income) * 100, 0
                ) / monthsWithIncome.length
              )
            : 0

          return {
            monthly,
            totalIncome,
            totalRepayments,
            totalExpense,
            totalInvestment,
            avgSavings,
            byCategory,
            byVehicle,
            top5,
            count: Number(totals.count || 0),
          }
        },
        staleTime: 45 * 1000,
      }).catch(() => {})
      return
    }

    if (path === '/bills') {
      void queryClient.prefetchQuery({
        queryKey: ['liabilities', 'pending'],
        queryFn: async () => {
          const { data, error } = await supabase
            .from('liabilities')
            .select(LIABILITY_PREFETCH_COLUMNS)
            .eq('user_id', user.id)
            .eq('paid', false)
            .order('due_date', { ascending: true })
          if (error) throw error
          return data || []
        },
        staleTime: 45 * 1000,
      }).catch(() => {})
      return
    }

    if (path === '/reconciliation') {
      const reconcileTxnFilters = {
        type: undefined,
        category: undefined,
        search: undefined,
        limit: 250,
        startDate: undefined,
        endDate: undefined,
        columns: TRANSACTION_INSIGHTS_COLUMNS,
      }

      void Promise.all([
        queryClient.prefetchQuery({
          queryKey: ['transactions', reconcileTxnFilters],
          queryFn: async () => {
            const { data, error } = await supabase
              .from('transactions')
              .select(TRANSACTION_INSIGHTS_COLUMNS)
              .eq('user_id', user.id)
              .order('date', { ascending: false })
              .order('created_at', { ascending: false })
              .limit(250)

            if (error) throw error
            return data || []
          },
          staleTime: 30 * 1000,
        }),
        queryClient.prefetchQuery({
          queryKey: ['reconciliationReviews'],
          queryFn: async () => {
            const { data, error } = await supabase
              .from('reconciliation_reviews')
              .select('transaction_id, status, statement_line, updated_at')
              .eq('user_id', user.id)

            if (error) {
              const message = String(error?.message || '').toLowerCase()
              const details = String(error?.details || '').toLowerCase()
              const code = String(error?.code || '').toUpperCase()
              const status = Number(error?.status || 0)
              const missingTable = (
                message.includes('reconciliation_reviews') ||
                details.includes('reconciliation_reviews') ||
                (message.includes('relation') && message.includes('does not exist')) ||
                (details.includes('relation') && details.includes('does not exist')) ||
                code === '42P01' ||
                code === 'PGRST205' ||
                status === 404
              )

              if (missingTable) return { rows: [], unavailable: true }
              throw error
            }

            return { rows: data || [], unavailable: false }
          },
          staleTime: 30 * 1000,
        }),
      ]).catch(() => {})
    }
  }, [user?.id])
}

// ── Desktop sidebar ───────────────────────────────────────────────────────
function DesktopSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const prefetchRoute = useRouteIntentPrefetch()

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
      <div className="flex items-center gap-2.5 px-2 pb-6 pt-2">
        <KoshaLogo size={32} />
        <div>
          <p className="text-[15px] font-bold text-ink tracking-tight leading-none">Kosha</p>
          <p className="text-[10px] text-ink-3 font-medium tracking-widest uppercase mt-0.5">Finance</p>
        </div>
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        {NAV.map((item, i) => {
          const isActive = i === active
          return (
            <button
              key={item.path}
              onClick={() => { if (navigator.vibrate) navigator.vibrate(6); navigate(item.path) }}
              onMouseEnter={() => prefetchRoute(item.path)}
              onFocus={() => prefetchRoute(item.path)}
              onTouchStart={() => prefetchRoute(item.path)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-card transition-colors duration-100 w-full text-left"
              style={{ background: isActive ? C.brandContainer : 'transparent' }}
            >
              <item.Icon size={20} weight={isActive ? 'fill' : 'regular'} color={isActive ? C.brand : C.inkMuted} />
              <span className="text-[14px]" style={{ color: isActive ? C.brand : C.inkMuted, fontWeight: isActive ? 700 : 500 }}>
                {item.label}
              </span>
            </button>
          )
        })}
      </nav>

      <div className="px-2 pt-4" style={{ borderTop: `1px solid ${C.brandBorder}` }}>
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
  const scrolledDown = useScrollDirection(location.pathname)
  const prefetchRoute = useRouteIntentPrefetch()
  const [layoutReady, setLayoutReady] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setLayoutReady(true))
    return () => cancelAnimationFrame(id)
  }, [])

  if (BOTTOM_NAV_HIDE_ON.some(p => location.pathname.startsWith(p))) return null

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
              onMouseEnter={() => prefetchRoute(item.path)}
              onFocus={() => prefetchRoute(item.path)}
              onTouchStart={() => prefetchRoute(item.path)}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 600, damping: 28 }}
            >
              <div className="nav-icon-wrap">
                {isActive && (layoutReady ? (
                  <motion.div layoutId="nav-pill" className="nav-icon-bg"
                    transition={{ type: 'spring', stiffness: 500, damping: 38, mass: 0.8 }} />
                ) : (
                  <div className="nav-icon-bg" />
                ))}
                <motion.span className="nav-icon-layer" animate={{ opacity: isActive ? 1 : 0 }} transition={{ duration: 0.15 }}>
                  <item.Icon size={22} weight="fill" color={C.brand} />
                </motion.span>
                <motion.span className="nav-icon-layer" animate={{ opacity: isActive ? 0 : 1 }} transition={{ duration: 0.15 }}>
                  <item.Icon size={22} weight="regular" color={C.inkMuted} />
                </motion.span>
              </div>
              <motion.span className="nav-label"
                animate={{ color: isActive ? C.brand : C.inkMuted, fontWeight: isActive ? 700 : 500, opacity: isActive ? 1 : 0.86 }}
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
  const { user, profile, loading, profileLoading } = useAuth()
  if (loading || (user && profileLoading)) return null
  if (!user) return <Navigate to="/login" replace />
  if (!profile || !profile.onboarded) return <Navigate to="/onboarding" replace />
  return <Navigate to="/" replace />
}

const REALTIME_CONNECT_TIMEOUT_MS = 8000
const REALTIME_FALLBACK_POLL_MS = 45000
const REALTIME_RETRY_DELAYS_MS = [15000, 30000, 60000]

// ── Global Realtime Sync ──────────────────────────────────────────────────
// Realtime is a freshness enhancer, not a source of truth.
// If the socket is unavailable, fall back to periodic invalidation of active
// queries and keep retrying the websocket in the background with backoff.
function GlobalRealtimeSync() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user) return

    const timeoutIds = new Map()
    let channel = null
    let connectTimerId = null
    let reconnectTimerId = null
    let fallbackIntervalId = null
    let attempt = 0
    let active = true

    function scheduleInvalidate(key, invalidate) {
      if (isSuppressed(key)) return
      clearTimeout(timeoutIds.get(key))
      timeoutIds.set(key, setTimeout(() => {
        timeoutIds.delete(key)
        if (!isSuppressed(key)) void invalidate()
      }, 300))
    }

    function clearConnectTimer() {
      if (connectTimerId) {
        clearTimeout(connectTimerId)
        connectTimerId = null
      }
    }

    function clearReconnectTimer() {
      if (reconnectTimerId) {
        clearTimeout(reconnectTimerId)
        reconnectTimerId = null
      }
    }

    function removeActiveChannel() {
      clearConnectTimer()
      if (channel) {
        supabase.removeChannel(channel)
        channel = null
      }
    }

    function invalidateFreshness() {
      for (const policy of REALTIME_INVALIDATION_POLICIES) {
        scheduleInvalidate(policy.key, () => invalidateQueryFamilies(policy.queryKeys))
      }
    }

    function startFallbackPolling() {
      if (fallbackIntervalId) return
      invalidateFreshness()
      fallbackIntervalId = setInterval(() => {
        invalidateFreshness()
      }, REALTIME_FALLBACK_POLL_MS)
    }

    function stopFallbackPolling() {
      if (!fallbackIntervalId) return
      clearInterval(fallbackIntervalId)
      fallbackIntervalId = null
    }

    function scheduleReconnect(reason) {
      if (!active || reconnectTimerId) return

      const delay = REALTIME_RETRY_DELAYS_MS[Math.min(attempt, REALTIME_RETRY_DELAYS_MS.length - 1)]
      attempt += 1

      reconnectTimerId = setTimeout(() => {
        reconnectTimerId = null
        if (!active) return

        if (typeof supabase.realtime.connect === 'function') {
          supabase.realtime.connect()
        }

        subscribeToChannel(reason)
      }, delay)
    }

    function enterFallback(reason) {
      if (!active) return

      console.warn(`[Kosha] Realtime unavailable (${reason}). Falling back to periodic refresh.`)
      removeActiveChannel()

      if (typeof supabase.realtime.disconnect === 'function') {
        supabase.realtime.disconnect()
      }

      startFallbackPolling()
      scheduleReconnect(reason)
    }

    function subscribeToChannel(trigger = 'initial') {
      if (!active) return

      removeActiveChannel()

      let subscribed = false
      let nextChannel = supabase.channel(`kosha-sync-${user.id}`)

      for (const policy of REALTIME_INVALIDATION_POLICIES) {
        nextChannel = nextChannel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: policy.table },
          () => scheduleInvalidate(policy.key, () => invalidateQueryFamilies(policy.queryKeys))
        )
      }

      channel = nextChannel
      connectTimerId = setTimeout(() => {
        if (!subscribed) {
          enterFallback('connect-timeout')
        }
      }, REALTIME_CONNECT_TIMEOUT_MS)

      channel.subscribe((status) => {
        if (!active || channel !== nextChannel) return

        if (status === 'SUBSCRIBED') {
          subscribed = true
          attempt = 0
          clearConnectTimer()
          clearReconnectTimer()
          stopFallbackPolling()
          invalidateFreshness()
          if (trigger !== 'initial') {
            console.info('[Kosha] Realtime freshness restored.')
          }
          return
        }

        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          enterFallback(String(status).toLowerCase())
        }
      })
    }

    subscribeToChannel()

    return () => {
      active = false
      clearConnectTimer()
      clearReconnectTimer()
      stopFallbackPolling()
      timeoutIds.forEach(id => clearTimeout(id))
      removeActiveChannel()
    }
  }, [user?.id])

  return null
}

function ContentWrapper({ children }) {
  const location = useLocation()
  const hasSidebar = !NAV_HIDE_ON.some(p => location.pathname.startsWith(p))
  return (
    <div className={hasSidebar ? 'md:ml-[220px]' : ''}>
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

function DashboardWarmPrefetch() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user?.id) return

    let cancelled = false
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const todayISO = `${year}-${String(month).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    const runPrefetch = async () => {
      try {
        await Promise.all([
          queryClient.prefetchQuery({
            queryKey: ['transactionsRecent', 5],
            queryFn: async () => {
              const { data, error } = await supabase
                .from('transactions')
                .select(DASHBOARD_RECENT_COLUMNS)
                .eq('user_id', user.id)
                .order('date', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(5)

              if (error) throw error
              return data || []
            },
            staleTime: 15 * 1000,
          }),
          queryClient.prefetchQuery({
            queryKey: ['todayExpenses', todayISO],
            queryFn: async () => {
              const { data, error } = await supabase
                .from('transactions')
                .select('amount')
                .eq('user_id', user.id)
                .eq('type', 'expense')
                .eq('date', todayISO)

              if (error) throw error
              return (data || []).reduce((sum, row) => sum + Number(row.amount || 0), 0)
            },
            staleTime: 30 * 1000,
          }),
          queryClient.prefetchQuery({
            queryKey: ['month', year, month],
            queryFn: async () => {
              const { data: rows, error } = await supabase.rpc('get_month_summary', {
                p_user_id: user.id,
                p_year: year,
                p_month: month,
              })

              if (error) throw error

              const safeRows = rows || []
              const byCategory = {}
              const byVehicle = {}
              let earned = 0, repayments = 0, expense = 0, investment = 0

              for (const row of safeRows) {
                const amount = Number(row.total || 0)
                if (row.type === 'income') {
                  if (row.is_repayment) repayments += amount
                  else earned += amount
                }
                if (row.type === 'expense') {
                  expense += amount
                  if (row.category) byCategory[row.category] = (byCategory[row.category] || 0) + amount
                }
                if (row.type === 'investment') {
                  investment += amount
                  const vehicle = row.investment_vehicle || 'Other'
                  byVehicle[vehicle] = (byVehicle[vehicle] || 0) + amount
                }
              }

              return {
                earned,
                repayments,
                expense,
                investment,
                byCategory,
                byVehicle,
                balance: earned + repayments - expense - investment,
                count: safeRows.length,
              }
            },
            staleTime: 30 * 1000,
          }),
          queryClient.prefetchQuery({
            queryKey: ['balance', 2099, 12],  // Far future to avoid collisions with real month queries
            queryFn: async () => {
              const { data: balance, error } = await supabase.rpc('get_running_balance', {
                p_user_id: user.id,
                p_end_date: '2099-12-31',
              })
              if (error) throw error
              return Number(balance || 0)
            },
            staleTime: 30 * 1000,
          }),
        ])
      } catch (error) {
        if (!cancelled) {
          console.warn('[Kosha] dashboard warm prefetch failed', error)
        }
      }
    }

    // Yield one frame so initial route shell paints first.
    const timer = setTimeout(() => {
      if (!cancelled) void runPrefetch()
    }, 32)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [user?.id])

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
          <Route path="/not-found" element={<SuspenseSkeleton pathname="/not-found"><NotFound /></SuspenseSkeleton>} />
          <Route path="/onboarding" element={<SuspenseSkeleton pathname="/onboarding"><AuthGuard><Onboarding /></AuthGuard></SuspenseSkeleton>} />
          <Route path="/" element={<SuspenseSkeleton pathname="/"><AuthGuard><Dashboard /></AuthGuard></SuspenseSkeleton>} />
          <Route path="/transactions" element={<SuspenseSkeleton pathname="/transactions"><AuthGuard><Transactions /></AuthGuard></SuspenseSkeleton>} />
          <Route path="/monthly" element={<SuspenseSkeleton pathname="/monthly"><AuthGuard><Monthly /></AuthGuard></SuspenseSkeleton>} />
          <Route path="/analytics" element={<SuspenseSkeleton pathname="/analytics"><AuthGuard><Analytics /></AuthGuard></SuspenseSkeleton>} />
          <Route path="/bills" element={<SuspenseSkeleton pathname="/bills"><AuthGuard><Bills /></AuthGuard></SuspenseSkeleton>} />
          <Route path="/reconciliation" element={<SuspenseSkeleton pathname="/reconciliation"><AuthGuard><Reconciliation /></AuthGuard></SuspenseSkeleton>} />
          <Route path="/guide" element={<SuspenseSkeleton pathname="/guide"><AuthGuard><Guide /></AuthGuard></SuspenseSkeleton>} />
          <Route path="/settings" element={<SuspenseSkeleton pathname="/settings"><AuthGuard><Settings /></AuthGuard></SuspenseSkeleton>} />
          <Route path="/about" element={<SuspenseSkeleton pathname="/about"><About /></SuspenseSkeleton>} />
          <Route path="/report-bug" element={<SuspenseSkeleton pathname="/report-bug"><ReportBug /></SuspenseSkeleton>} />
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
          <DashboardWarmPrefetch />
          <AppShell />
        </QueryClientProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
