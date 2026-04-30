import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { lazy, Suspense, useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { queryClient, invalidateQueryFamilies } from './lib/queryClient'
import { supabase } from './lib/supabase'
import { TRANSACTION_INVALIDATION_KEYS, TRANSACTION_INSIGHTS_COLUMNS, TRANSACTION_LIST_COLUMNS, parseMonthSummaryRows } from './hooks/useTransactions'
import { LIABILITY_INVALIDATION_KEYS } from './hooks/useLiabilities'
import { LOAN_INVALIDATION_KEYS } from './hooks/useLoans'
import { SPLITWISE_INVALIDATION_KEYS } from './hooks/useSplitwise'
import AuthGuard, { RouteSkeleton } from './components/navigation/AuthGuard'
import { House, List, CalendarDots, ChartBar, Receipt, UsersThree } from '@phosphor-icons/react'
import { isSuppressed } from './lib/mutationGuard'
import { recordRuntimeRoute } from './lib/runtimeMonitor'
import { useUserCategories } from './hooks/useUserCategories'

const DASHBOARD_RECENT_COLUMNS =
  'id, date, created_at, type, amount, description, category, investment_vehicle, is_repayment, payment_mode, notes, source_transaction_id, linked_split_expense_id, linked_split_settlement_id, linked_bill_id, linked_loan_id'
const LIABILITY_PREFETCH_COLUMNS =
  'id, description, amount, due_date, is_recurring, recurrence, paid, linked_transaction_id'

// ── Eager ────────────────────────────────────────────────────────────────
import Login from './pages/Login'
import InviteLanding from './pages/InviteLanding'

// ── Lazy ─────────────────────────────────────────────────────────────────
const Onboarding = lazy(() => import('./pages/Onboarding'))
const NotFound = lazy(() => import('./pages/NotFound'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Transactions = lazy(() => import('./pages/Transactions'))
const Monthly = lazy(() => import('./pages/Monthly'))
const Analytics = lazy(() => import('./pages/Analytics'))
const Obligations = lazy(() => import('./pages/Obligations'))
const Splitwise = lazy(() => import('./pages/Splitwise'))
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
  '/obligations': () => import('./pages/Obligations'),
  '/splitwise': () => import('./pages/Splitwise'),
  '/reconciliation': () => import('./pages/Reconciliation'),
}

function PageFallback({ pathname }) {
  return (
    <div className="min-h-dvh bg-kosha-bg">
      <div className="route-skeleton-shell">
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

const NAV = [
  { path: '/', label: 'Home', Icon: House, match: ['/'] },
  { path: '/transactions', label: 'Activity', Icon: List, match: ['/transactions'] },
  { path: '/monthly', label: 'Monthly', Icon: CalendarDots, match: ['/monthly'] },
  { path: '/analytics', label: 'Insights', Icon: ChartBar, match: ['/analytics'] },
  { path: '/obligations', label: 'Obligations', Icon: Receipt, match: ['/obligations', '/bills', '/loans'] },
  { path: '/splitwise', label: 'Splitwise', Icon: UsersThree, match: ['/splitwise'] },
]

const REALTIME_INVALIDATION_POLICIES = [
  { key: 'transactions', table: 'transactions', queryKeys: TRANSACTION_INVALIDATION_KEYS, filterColumn: 'user_id' },
  { key: 'liabilities', table: 'liabilities', queryKeys: LIABILITY_INVALIDATION_KEYS, filterColumn: 'user_id' },
  { key: 'loans', table: 'loans', queryKeys: LOAN_INVALIDATION_KEYS, filterColumn: 'user_id' },
  { key: 'splitwise', table: 'split_groups', queryKeys: SPLITWISE_INVALIDATION_KEYS },
  { key: 'splitwise', table: 'split_group_access', queryKeys: SPLITWISE_INVALIDATION_KEYS },
  { key: 'splitwise', table: 'split_group_members', queryKeys: SPLITWISE_INVALIDATION_KEYS },
  { key: 'splitwise', table: 'split_group_invites', queryKeys: SPLITWISE_INVALIDATION_KEYS },
  { key: 'splitwise', table: 'split_expenses', queryKeys: SPLITWISE_INVALIDATION_KEYS },
  { key: 'splitwise', table: 'split_expense_splits', queryKeys: SPLITWISE_INVALIDATION_KEYS },
  { key: 'splitwise', table: 'split_settlements', queryKeys: SPLITWISE_INVALIDATION_KEYS },
]

const NAV_HIDE_ON = ['/login', '/onboarding', '/join', '/splitwise/join', '/auth', '/about', '/not-found', '/report-bug', '/settings', '/guide']
const BOTTOM_NAV_HIDE_ON = ['/login', '/onboarding', '/join', '/splitwise/join', '/auth', '/about', '/report-bug', '/settings', '/guide', '/reconciliation']

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
    const profile = queryClient.getQueryData(['user-profile', user.id]) || {}
    const allUserIds = [user.id, ...(profile.linkedUserIds || [])]

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
              .in('user_id', allUserIds)
              .order('date', { ascending: false })
              .order('created_at', { ascending: false })
              .limit(50)
            if (error) throw error
            return data || []
          },
          staleTime: 30 * 1000,
        }),
        queryClient.prefetchQuery({
          queryKey: ['txnCount', countFilters],
          queryFn: async () => {
            const { count, error } = await supabase
              .from('transactions')
              .select('id', { count: 'exact', head: true })
              .in('user_id', allUserIds)
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
        queryKey: ['month', year, month, user.id],
        queryFn: async () => {
          const { data: rows, error } = await supabase.rpc('get_month_summary', {
            p_user_ids: allUserIds,
            p_year: year,
            p_month: month,
          })
          if (error) throw error
          return parseMonthSummaryRows(rows)
        },
        staleTime: 30 * 1000,
        }),
        queryClient.prefetchQuery({
          queryKey: ['liabilitiesMonth', year, month, user.id],
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
        queryKey: ['year', year, user.id],
        queryFn: async () => {
          const { data: result, error } = await supabase
            .rpc('get_year_summary', { p_user_ids: allUserIds, p_year: year })
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
        staleTime: 30 * 1000,
      }).catch(() => {})
      return
    }

    if (path === '/obligations' || path === '/bills' || path === '/loans') {
      void Promise.all([
        queryClient.prefetchQuery({
          queryKey: ['liabilities', 'pending', user.id],
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
          staleTime: 30 * 1000,
        }),
        queryClient.prefetchQuery({
          queryKey: ['loans', 'active', 'given', user.id],
          queryFn: async () => {
            const { data, error } = await supabase
              .from('loans')
              .select('id, direction, counterparty, amount, amount_settled, interest_rate, loan_date, due_date, note, settled, created_at')
              .eq('user_id', user.id)
              .eq('settled', false)
              .eq('direction', 'given')
              .order('created_at', { ascending: false })
            if (error) throw error
            return data || []
          },
          staleTime: 30 * 1000,
        }),
      ]).catch(() => {})
      return
    }

    if (path === '/splitwise') {
      void queryClient.prefetchQuery({
        queryKey: ['splitwise', 'groups'],
        queryFn: async () => {
          const { data, error } = await supabase
            .from('split_groups')
            .select('id, name, created_at, updated_at, user_id')
            .order('updated_at', { ascending: false })

          if (error) throw error
          return data || []
        },
        staleTime: 30 * 1000,
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
              .in('user_id', allUserIds)
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

// Desktop sidebar removed — mobile-first, bottom tab bar only

// ── Mobile bottom nav ─────────────────────────────────────────────────────
function BottomNav() {
  const { loading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const prefetchRoute = useRouteIntentPrefetch()

  const shouldHide = BOTTOM_NAV_HIDE_ON.some(p => location.pathname.startsWith(p))

  // Render into DOM immediately (prevents layout shift) but invisible until
  // auth resolves. Once loading is done and nav should show, fade it in.
  // This eliminates the position jump caused by late mount.
  const isVisible = !loading && !shouldHide

  const active = NAV.findIndex((n) =>
    n.match.some((path) => (path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)))
  )

  return (
    <div
      className="nav-float-wrap"
      style={{
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? 'auto' : 'none',
        visibility: shouldHide ? 'hidden' : 'visible',
        transition: loading ? 'none' : 'opacity 180ms cubic-bezier(0.2, 0, 0, 1)',
        willChange: 'opacity',
      }}
    >
      <nav className="nav-float" aria-label="Main navigation">
        {NAV.map((item, i) => {
          const isActive = i === active
          return (
            <button
              key={item.path}
              className="nav-float-item"
              onClick={() => {
                import('./lib/haptics').then(m => m.hapticTap())
                if (isActive) {
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                  return
                }
                navigate(item.path)
              }}
              onMouseEnter={() => prefetchRoute(item.path)}
              onFocus={() => prefetchRoute(item.path)}
              onTouchStart={() => prefetchRoute(item.path)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
            >
              <div className="nav-icon-wrap">
                {isActive && (
                  <motion.div layoutId="nav-pill" className="nav-icon-bg"
                  initial={false}
                  transition={{ type: 'spring', stiffness: 500, damping: 40, mass: 1 }} />
                )}
                <span className="nav-icon-layer" style={{ opacity: isActive ? 1 : 0, transition: 'opacity 180ms cubic-bezier(0.2, 0, 0, 1)' }}>
                  <item.Icon size={21} weight="fill" color="var(--ds-primary)" />
                </span>
                <span className="nav-icon-layer" style={{ opacity: isActive ? 0 : 1, transition: 'opacity 180ms cubic-bezier(0.2, 0, 0, 1)' }}>
                  <item.Icon size={21} weight="regular" color="var(--ds-text-tertiary)" />
                </span>
              </div>
              <span
              className="nav-label"
              style={{
                color: isActive ? 'var(--ds-primary)' : 'var(--ds-text-tertiary)',
                fontWeight: isActive ? 600 : 400,
                opacity: isActive ? 1 : 0.75,
                transition: 'color 180ms cubic-bezier(0.2, 0, 0, 1), opacity 180ms cubic-bezier(0.2, 0, 0, 1)',
                }}
              >
                {item.label}
              </span>
            </button>
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

function LegacyObligationRedirect({ tab }) {
  const location = useLocation()
  const next = new URLSearchParams(location.search || '')

  if (tab === 'bills') {
    const listTab = String(next.get('tab') || '').toLowerCase()
    if (listTab === 'pending' || listTab === 'paid') {
      next.set('billsTab', listTab)
    }
  }

  next.set('tab', tab)
  const query = next.toString()
  return <Navigate to={query ? `/obligations?${query}` : '/obligations'} replace />
}

const REALTIME_CONNECT_TIMEOUT_MS = 8000
const REALTIME_FALLBACK_POLL_MS = 30000
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
    let fallbackMode = false

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
      const currentChannel = channel
      channel = null
      if (currentChannel) {
        supabase.removeChannel(currentChannel)
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

      if (fallbackMode) {
        scheduleReconnect(reason)
        return
      }

      fallbackMode = true

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
        const config = { event: '*', schema: 'public', table: policy.table }
        if (policy.filterColumn) {
          config.filter = `${policy.filterColumn}=eq.${user.id}`
        }
        
        nextChannel = nextChannel.on(
          'postgres_changes',
          config,
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
          fallbackMode = false
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
      fallbackMode = false
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
  return <>{children}</>
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
      const profile = queryClient.getQueryData(['user-profile', user.id]) || {}
      const allUserIds = [user.id, ...(profile.linkedUserIds || [])]
      try {
        await Promise.all([
          queryClient.prefetchQuery({
            queryKey: ['transactionsRecent', 5],
            queryFn: async () => {
              const { data, error } = await supabase
                .from('transactions')
                .select(DASHBOARD_RECENT_COLUMNS)
                .in('user_id', allUserIds)
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
                .in('user_id', allUserIds)
                .eq('type', 'expense')
                .eq('date', todayISO)

              if (error) throw error
              return (data || []).reduce((sum, row) => sum + Number(row.amount || 0), 0)
            },
            staleTime: 30 * 1000,
          }),
          queryClient.prefetchQuery({
            queryKey: ['month', year, month, user.id],
            queryFn: async () => {
              const { data: rows, error } = await supabase.rpc('get_month_summary', {
                p_user_ids: allUserIds,
                p_year: year,
                p_month: month,
              })

              if (error) throw error
              return parseMonthSummaryRows(rows)
            },
            staleTime: 30 * 1000,
          }),
          queryClient.prefetchQuery({
            queryKey: ['balance', 2099, 12, user.id],  // Far future to avoid collisions with real month queries
            queryFn: async () => {
              const { data: balance, error } = await supabase.rpc('get_running_balance', {
                p_user_ids: allUserIds,
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

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <div>
      <Routes location={location}>
        <Route path="/login" element={<Login />} />
        <Route path="/join/:token" element={<InviteLanding />} />
        <Route path="/splitwise/join/:splitToken" element={<InviteLanding />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/not-found" element={<SuspenseSkeleton pathname="/not-found"><NotFound /></SuspenseSkeleton>} />
        <Route path="/onboarding" element={<SuspenseSkeleton pathname="/onboarding"><AuthGuard><Onboarding /></AuthGuard></SuspenseSkeleton>} />
        <Route path="/" element={<SuspenseSkeleton pathname="/"><AuthGuard><Dashboard /></AuthGuard></SuspenseSkeleton>} />
        <Route path="/transactions" element={<SuspenseSkeleton pathname="/transactions"><AuthGuard><Transactions /></AuthGuard></SuspenseSkeleton>} />
        <Route path="/monthly" element={<SuspenseSkeleton pathname="/monthly"><AuthGuard><Monthly /></AuthGuard></SuspenseSkeleton>} />
        <Route path="/analytics" element={<SuspenseSkeleton pathname="/analytics"><AuthGuard><Analytics /></AuthGuard></SuspenseSkeleton>} />
        <Route path="/obligations" element={<SuspenseSkeleton pathname="/obligations"><AuthGuard><Obligations /></AuthGuard></SuspenseSkeleton>} />
        <Route path="/splitwise" element={<SuspenseSkeleton pathname="/splitwise"><AuthGuard><Splitwise /></AuthGuard></SuspenseSkeleton>} />
        <Route path="/bills" element={<LegacyObligationRedirect tab="bills" />} />
        <Route path="/loans" element={<LegacyObligationRedirect tab="loans" />} />
        <Route path="/reconciliation" element={<SuspenseSkeleton pathname="/reconciliation"><AuthGuard><Reconciliation /></AuthGuard></SuspenseSkeleton>} />
        <Route path="/guide" element={<SuspenseSkeleton pathname="/guide"><AuthGuard><Guide /></AuthGuard></SuspenseSkeleton>} />
        <Route path="/settings" element={<SuspenseSkeleton pathname="/settings"><AuthGuard><Settings /></AuthGuard></SuspenseSkeleton>} />
        <Route path="/about" element={<SuspenseSkeleton pathname="/about"><About /></SuspenseSkeleton>} />
        <Route path="/report-bug" element={<SuspenseSkeleton pathname="/report-bug"><ReportBug /></SuspenseSkeleton>} />
        <Route path="*" element={<Navigate to="/not-found" replace />} />
      </Routes>
    </div>
  )
}

// ── App shell ─────────────────────────────────────────────────────────────

/** Keeps custom categories registered in the module-level store for all components */
function CustomCategoryLoader() {
  const { user } = useAuth()
  useUserCategories({ enabled: !!user })
  return null
}

/** Shows a non-intrusive retry bar when active queries are in error state */
function QueryErrorRecovery() {
  const qc = useQueryClient()
  const [hasErrors, setHasErrors] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const syncErrorState = () => {
      const errored = qc.getQueryCache().findAll({
        predicate: (q) => q.state.status === 'error' && q.getObserversCount() > 0,
      })
      setHasErrors(errored.length > 0)
    }

    syncErrorState()
    return qc.getQueryCache().subscribe(syncErrorState)
  }, [qc])

  // Reset dismissed state when errors resolve
  useEffect(() => {
    if (!hasErrors) setDismissed(false)
  }, [hasErrors])

  if (!hasErrors || dismissed) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.2 }}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-[calc(var(--nav-height)+1rem)] left-4 right-4 z-50 flex items-center gap-3 bg-ink text-white px-4 py-3 rounded-card shadow-card-lg max-w-[398px] mx-auto"
    >
      <span className="text-[13px] font-medium flex-1">Something didn't load correctly.</span>
      <button
        type="button"
        onClick={() => {
          qc.refetchQueries({ predicate: (q) => q.state.status === 'error' && q.getObserversCount() > 0 })
          setDismissed(true)
        }}
        className="text-white hover:text-white text-xs font-semibold shrink-0 px-3 py-1.5 rounded-pill bg-white/20 active:bg-white/30"
      >
        Retry
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss retry banner"
        className="text-white/60 hover:text-white text-xs shrink-0 px-1"
      >
        ✕
      </button>
    </motion.div>
  )
}

function ShellStatusBanners() {
  const location = useLocation()
  const [isOffline, setIsOffline] = useState(() => {
    if (typeof navigator === 'undefined') return false
    return !navigator.onLine
  })
  const [updateDismissed, setUpdateDismissed] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [swRegistration, setSwRegistration] = useState(null)
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null)
  const [installDismissed, setInstallDismissed] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [installMessage, setInstallMessage] = useState('')
  const installMessageTimerRef = useRef(null)

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (registration) {
        setSwRegistration(registration)
        
        // 1. Check for updates every hour in the background
        setInterval(() => {
          registration.update()
        }, 60 * 60 * 1000)

        // 2. Force an aggressive check whenever the user brings the app to foreground
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            registration.update()
          }
        })
      }
    },
    onRegisterError(error) {
      console.warn('[Kosha] SW register failed', error)
    },
  })

  useEffect(() => {
    if (!import.meta.env.DEV) return
    if (typeof window === 'undefined') return

    if ('serviceWorker' in navigator) {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          void registration.unregister()
        }
      })
    }

    if ('caches' in window) {
      void caches.keys().then((keys) => {
        for (const key of keys) {
          void caches.delete(key)
        }
      })
    }
  }, [])

  const announceInstallMessage = useCallback((message, timeout = 2200) => {
    if (installMessageTimerRef.current) {
      window.clearTimeout(installMessageTimerRef.current)
    }
    setInstallMessage(message)
    installMessageTimerRef.current = window.setTimeout(() => {
      setInstallMessage('')
      installMessageTimerRef.current = null
    }, timeout)
  }, [])

  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault()
      setDeferredInstallPrompt(event)
      setInstallDismissed(false)
    }

    const handleInstalled = () => {
      setDeferredInstallPrompt(null)
      setInstallDismissed(true)
      announceInstallMessage('Kosha installed successfully.')
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleInstalled)
    }
  }, [announceInstallMessage])

  useEffect(() => {
    if (!swRegistration) return undefined

    // Poll for a fresh service worker periodically so long-running sessions
    // receive release prompts without requiring a manual reload.
    const intervalId = window.setInterval(() => {
      void swRegistration.update()
    }, 30 * 60 * 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [swRegistration])

  useEffect(() => {
    if (needRefresh) {
      setUpdateDismissed(false)
      setUpdating(false)
    }
  }, [needRefresh])

  useEffect(() => {
    return () => {
      if (installMessageTimerRef.current) {
        window.clearTimeout(installMessageTimerRef.current)
      }
    }
  }, [])

  const navHidden = BOTTOM_NAV_HIDE_ON.some((path) => location.pathname.startsWith(path))
  const bottomClass = navHidden ? 'bottom-4' : 'bottom-[calc(var(--nav-height)+1rem)]'
  const showUpdatePrompt = needRefresh
  const showInstallPrompt = !!deferredInstallPrompt && !installDismissed

  async function handleAppUpdate() {
    setUpdating(true)
    try {
      await updateServiceWorker(true)
    } catch {
      setUpdating(false)
      announceInstallMessage('Could not update right now. Please retry.')
    }
  }

  async function handleInstall() {
    const prompt = deferredInstallPrompt
    if (!prompt || typeof prompt.prompt !== 'function') return

    setInstalling(true)
    try {
      await prompt.prompt()
      const choice = await prompt.userChoice
      if (choice?.outcome === 'accepted') {
        announceInstallMessage('Install started.')
      } else {
        announceInstallMessage('Install dismissed.', 1800)
      }
    } catch {
      announceInstallMessage('Install is unavailable right now.')
    } finally {
      setInstalling(false)
      setDeferredInstallPrompt(null)
      setInstallDismissed(true)
    }
  }

  if (!isOffline && !showUpdatePrompt && !showInstallPrompt && !installMessage) return null

  return (
    <div className={`pointer-events-none fixed left-4 right-4 z-50 mx-auto max-w-[398px] space-y-2 ${bottomClass}`}>
      {isOffline && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          role="status"
          aria-live="polite"
          className="pointer-events-auto flex items-center gap-2 rounded-card border border-warning-border bg-warning-bg px-3 py-2.5 text-warning-text shadow-card"
        >
          <span className="text-[12px] font-semibold">You are offline. Kosha will sync when your connection returns.</span>
        </motion.div>
      )}

      {showUpdatePrompt && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="pointer-events-auto flex items-center gap-2 rounded-card border border-kosha-border bg-kosha-surface px-3 py-2.5 shadow-card"
        >
          <span className="flex-1 text-[12px] leading-snug text-ink-2">
            An update is required to continue.
          </span>
          <button
            type="button"
            onClick={() => { void handleAppUpdate() }}
            disabled={updating}
            className="rounded-pill bg-brand-dark px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
          >
            {updating ? 'Updating…' : 'Update Now'}
          </button>
        </motion.div>
      )}

      {showInstallPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          className="pointer-events-auto flex items-center gap-2 rounded-card border border-kosha-border bg-kosha-surface px-3 py-2.5 shadow-card"
        >
          <span className="flex-1 text-[12px] leading-snug text-ink-2">Install Kosha for faster launch and offline shell support.</span>
          <button
            type="button"
            onClick={() => {
              setInstallDismissed(true)
              setDeferredInstallPrompt(null)
            }}
            className="rounded-pill border border-kosha-border bg-kosha-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink-2"
          >
            Not now
          </button>
          <button
            type="button"
            onClick={() => { void handleInstall() }}
            disabled={installing}
            className="rounded-pill bg-brand-dark px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
          >
            {installing ? 'Installing…' : 'Install'}
          </button>
        </motion.div>
      )}

      {!showInstallPrompt && !isOffline && installMessage && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18 }}
          role="status"
          aria-live="polite"
          className="pointer-events-auto rounded-card bg-ink px-3 py-2.5 text-[12px] font-medium text-white shadow-card"
        >
          {installMessage}
        </motion.div>
      )}
    </div>
  )
}

function AppShell() {
  return (
    <div className="relative min-h-dvh flex flex-col bg-kosha-bg">
      <RuntimeRouteTracker />
      <CustomCategoryLoader />
      <main id="main-content" role="main" className="flex-1">
        <ContentWrapper>
          <AnimatedRoutes />
        </ContentWrapper>
      </main>
      <BottomNav />
      <QueryErrorRecovery />
      <ShellStatusBanners />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_relativeSplatPath: true }}>
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
