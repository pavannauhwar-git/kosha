import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate, useNavigationType } from 'react-router-dom'
import { lazy, Suspense, useState, useEffect, useCallback, useRef } from 'react'
import { motion, MotionConfig } from 'framer-motion'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { getMuiTheme } from './lib/muiTheme'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { queryClient, evictSwCacheEntries, invalidateQueryFamilies } from './lib/queryClient'
import { supabase } from './lib/supabase'
import { TRANSACTION_INVALIDATION_KEYS, TRANSACTION_INSIGHTS_COLUMNS, TRANSACTION_LIST_COLUMNS, parseMonthSummaryRows } from './hooks/useTransactions'
import { LIABILITY_INVALIDATION_KEYS, MONTH_LIABILITY_COLUMNS } from './hooks/useLiabilities'
import { LOAN_INVALIDATION_KEYS } from './hooks/useLoans'
import { SPLITWISE_INVALIDATION_KEYS } from './hooks/useSplitwise'
import AuthGuard, { RouteSkeleton } from './components/navigation/AuthGuard'
import { RouteErrorBoundary } from './components/errors/RouteErrorBoundary'
import { House, List, CalendarDots, ChartBar, Receipt, UsersThree } from '@phosphor-icons/react'
import { isSuppressed } from './lib/mutationGuard'
import { recordRuntimeRoute } from './lib/runtimeMonitor'
import { useUserCategories } from './hooks/useUserCategories'
import { getActiveWalletUserId, useActiveWallet } from './lib/walletStore'
import { hapticTap } from './lib/haptics'

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
const BillsPage = lazy(() => import('./pages/BillsPage'))
const LoansPage = lazy(() => import('./pages/LoansPage'))
const Splitwise = lazy(() => import('./pages/Splitwise'))
const About = lazy(() => import('./pages/About'))
const Guide = lazy(() => import('./pages/Guide'))
const Reconciliation = lazy(() => import('./pages/Reconciliation'))
const ReportBug = lazy(() => import('./pages/ReportBug'))
const Settings = lazy(() => import('./pages/Settings'))

// All lazy route chunk loaders — used for both hover prefetch and eager preload
const ROUTE_PRELOADERS = {
  '/': () => import('./pages/Dashboard'),
  '/transactions': () => import('./pages/Transactions'),
  '/monthly': () => import('./pages/Monthly'),
  '/analytics': () => import('./pages/Analytics'),
  '/obligations': () => import('./pages/Obligations'),
  '/splitwise': () => import('./pages/Splitwise'),
  '/reconciliation': () => import('./pages/Reconciliation'),
  '/settings': () => import('./pages/Settings'),
  '/guide': () => import('./pages/Guide'),
  '/about': () => import('./pages/About'),
  '/report-bug': () => import('./pages/ReportBug'),
  '/onboarding': () => import('./pages/Onboarding'),
}

function PageFallback({ pathname }) {
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

const NAV = [
  { path: '/', label: 'Home', Icon: House, match: ['/'] },
  { path: '/transactions', label: 'Activity', Icon: List, match: ['/transactions'] },
  { path: '/monthly', label: 'Monthly', Icon: CalendarDots, match: ['/monthly'] },
  { path: '/analytics', label: 'Insights', Icon: ChartBar, match: ['/analytics'] },
  { path: '/obligations', label: 'Obligations', Icon: Receipt, match: ['/obligations', '/bills', '/loans'] },
  { path: '/splitwise', label: 'Splitwise', Icon: UsersThree, match: ['/splitwise'] },
]

const REALTIME_INVALIDATION_POLICIES = [
  { key: 'transactions', table: 'transactions', filterColumn: 'user_id', queryKeys: TRANSACTION_INVALIDATION_KEYS },
  { key: 'liabilities', table: 'liabilities', filterColumn: 'user_id', queryKeys: LIABILITY_INVALIDATION_KEYS },
  { key: 'loans', table: 'loans', filterColumn: 'user_id', queryKeys: LOAN_INVALIDATION_KEYS },
  { key: 'events', table: 'financial_events', filterColumn: 'user_id', queryKeys: [['financialEvents']] },
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
  const activeUserId = getActiveWalletUserId()

  // Reset prefetch tracking on session change to ensure fresh data for new user
  useEffect(() => {
    chunkPrefetched.current.clear()
    dataPrefetched.current.clear()
    // Cancel in-flight prefetches keyed on the previous user.
    queryClient.cancelQueries({
      predicate: (q) => {
        const key = q.queryKey
        const lastSegment = Array.isArray(key) ? key[key.length - 1] : null
        return lastSegment && lastSegment !== activeUserId
      },
    })
  }, [activeUserId])

  return useCallback((path) => {
    if (!path) return

    if (!chunkPrefetched.current.has(path)) {
      chunkPrefetched.current.add(path)
      const preload = ROUTE_PRELOADERS[path]
      if (preload) void preload().catch(() => { })
    }

    if (!activeUserId) return
    const cacheKey = `${path}-${activeUserId}`
    if (dataPrefetched.current.has(cacheKey)) return

    dataPrefetched.current.add(cacheKey)

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
          queryKey: ['transactions', txnFilters, activeUserId],
          queryFn: async () => {
            const { data, error } = await supabase
              .from('transactions')
              .select(TRANSACTION_LIST_COLUMNS)
              .eq('user_id', activeUserId)
              .order('date', { ascending: false })
              .order('created_at', { ascending: false })
              .limit(50)
            if (error) throw error
            return data || []
          },
          staleTime: 30 * 1000,
        }),
        queryClient.prefetchQuery({
          queryKey: ['txnCount', countFilters, activeUserId],
          queryFn: async () => {
            const { count, error } = await supabase
              .from('transactions')
              .select('id', { count: 'exact', head: true })
              .eq('user_id', activeUserId)
            if (error) throw error
            return count || 0
          },
          staleTime: 30 * 1000,
        }),
      ]).catch(() => { })
      return
    }

    if (path === '/monthly') {
      const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
      const monthEnd = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`

      void Promise.all([
        queryClient.prefetchQuery({
          queryKey: ['month', year, month, activeUserId],
          queryFn: async () => {
            const { data: rows, error } = await supabase.rpc('get_month_summary', {
              p_user_ids: [activeUserId],
              p_year: year,
              p_month: month,
            })
            if (error) throw error
            return parseMonthSummaryRows(rows)
          },
          staleTime: 30 * 1000,
        }),
        queryClient.prefetchQuery({
          queryKey: ['liabilitiesMonth', year, month, activeUserId],
          queryFn: async () => {
            const { data, error } = await supabase
              .from('liabilities')
              .select(MONTH_LIABILITY_COLUMNS)
              .eq('user_id', activeUserId)
              .gte('due_date', monthStart)
              .lte('due_date', monthEnd)
              .order('due_date', { ascending: true })

            if (error) throw error
            return data || []
          },
          staleTime: 30 * 1000,
        }),
      ]).catch(() => { })
      return
    }

    if (path === '/analytics') {
      void queryClient.prefetchQuery({
        queryKey: ['year', year, activeUserId],
        queryFn: async () => {
          const { data: result, error } = await supabase
            .rpc('get_year_summary', { p_user_ids: [activeUserId], p_year: Number(year) })
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
      }).catch(() => { })
      return
    }

    if (path === '/obligations' || path === '/bills' || path === '/loans') {
      void Promise.all([
        queryClient.prefetchQuery({
          queryKey: ['liabilities', 'pending', activeUserId],
          queryFn: async () => {
            const { data, error } = await supabase
              .from('liabilities')
              .select(LIABILITY_PREFETCH_COLUMNS)
              .eq('user_id', activeUserId)
              .eq('paid', false)
              .order('due_date', { ascending: true })
            if (error) throw error
            return data || []
          },
          staleTime: 30 * 1000,
        }),
        queryClient.prefetchQuery({
          queryKey: ['loans', 'active', 'given', activeUserId],
          queryFn: async () => {
            const { data, error } = await supabase
              .from('loans')
              .select('id, direction, counterparty, amount, amount_settled, interest_rate, loan_date, due_date, note, settled, created_at')
              .eq('user_id', activeUserId)
              .eq('settled', false)
              .eq('direction', 'given')
              .order('created_at', { ascending: false })
            if (error) throw error
            return data || []
          },
          staleTime: 30 * 1000,
        }),
      ]).catch(() => { })
      return
    }

    if (path === '/splitwise') {
      void Promise.all([
        queryClient.prefetchQuery({
          queryKey: ['splitwise', 'groups', activeUserId],
          queryFn: async () => {
            const { data, error } = await supabase
              .from('split_groups')
              .select('id, name, created_at, updated_at, user_id, is_archived, banner_id')
              .order('updated_at', { ascending: false })

            if (error) throw error
            return data || []
          },
          staleTime: 30 * 1000,
        }),
        queryClient.prefetchQuery({
          queryKey: ['splitwise', 'group-access', activeUserId],
          queryFn: async () => {
            const { data, error } = await supabase
              .from('split_group_access')
              .select('group_id, role')
              .eq('user_id', activeUserId)

            if (error) throw error
            return data || []
          },
          staleTime: 30 * 1000,
        }),
      ]).catch(() => { })
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
          queryKey: ['transactions', reconcileTxnFilters, activeUserId],
          queryFn: async () => {
            const { data, error } = await supabase
              .from('transactions')
              .select(TRANSACTION_INSIGHTS_COLUMNS)
              .eq('user_id', activeUserId)
              .order('date', { ascending: false })
              .order('created_at', { ascending: false })
              .limit(250)

            if (error) throw error
            return data || []
          },
          staleTime: 30 * 1000,
        }),
        queryClient.prefetchQuery({
          queryKey: ['reconciliationReviews', activeUserId],
          queryFn: async () => {
            const { data, error } = await supabase
              .from('reconciliation_reviews')
              .select('transaction_id, status, statement_line, updated_at')
              .eq('user_id', activeUserId)

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
      ]).catch(() => { })
    }
  }, [activeUserId])
}

// Desktop sidebar removed — mobile-first, bottom tab bar only

// ── Mobile bottom nav ─────────────────────────────────────────────────────
function WalletPrefetcher() {
  // Partner wallet data is prefetched on demand when the user switches wallets.
  // The previous prefetch calls used non-existent query keys and were no-ops.
  return null
}

function AppContent() {
  const { loading: authLoading } = useAuth()
  const location = useLocation()
  if (authLoading) return <PageFallback pathname={location.pathname} />
  return <AppShell />
}

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
        // Never toggle pointer-events during a fade — the compositor can
        // apply pointer-events:auto before the opacity animation settles on
        // iOS Safari, causing the first tap to fall through to content behind
        // the nav. Use visibility:hidden (already set below for shouldHide)
        // to block all input when the nav is fully invisible.
        pointerEvents: isVisible ? 'auto' : 'none',
        visibility: shouldHide ? 'hidden' : 'visible',
        transition: loading ? 'none' : 'opacity 180ms cubic-bezier(0.2, 0, 0, 1)',
        // Do NOT add willChange:'opacity' here — the nav is already on its
        // own compositor layer via transform:translateZ(0) in CSS.
        // A second willChange promotion causes iOS Safari hit-testing to
        // use the stale composited layer for the first tap after fade-in.
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
                hapticTap()
                if (isActive) {
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                  return
                }
                // replace: true keeps the history stack flat — tab switches
                // should never create back-navigable history entries so that
                // the iOS swipe-from-left gesture only triggers meaningful
                // navigation (e.g. modals / sub-pages), not tab hopping.
                navigate(item.path, { replace: true })
              }}
              onMouseEnter={() => prefetchRoute(item.path)}
              onFocus={(e) => {
                // Only prefetch on focus from keyboard/mouse — not from tap-focus on iOS.
                // On mobile Safari, a tap fires focus before click; running
                // prefetchRoute here on touch devices adds unnecessary work on
                // the first tap and can delay the click event in edge cases.
                if (!e.currentTarget.matches(':focus-visible')) return
                prefetchRoute(item.path)
              }}
              onTouchStart={() => prefetchRoute(item.path)}
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
            >
              <div className="nav-icon-wrap">
                {isActive && (
                  <motion.div layoutId="nav-pill" className="nav-icon-bg"
                    initial={false}
                    transition={{
                      // M3 Expressive Spatial Default — damping ratio ~0.85
                      // produces a small controlled overshoot (~3%) that
                      // reads as "alive" without feeling jelly.
                      type: 'spring',
                      stiffness: 800,
                      damping: 40,
                      mass: 1,
                    }}
                  />
                )}
                {/* Active icon — springs in with scale overshoot */}
                <motion.span
                  className="nav-icon-layer"
                  animate={{
                    opacity: isActive ? 1 : 0,
                    scale: isActive ? 1 : 0.7,
                  }}
                  transition={isActive
                    ? { type: 'spring', stiffness: 900, damping: 38, mass: 1 }
                    : { duration: 0.12, ease: [0.2, 0, 0, 1] }
                  }
                >
                  <item.Icon size={21} weight="fill" color="var(--ds-on-primary-container)" />
                </motion.span>
                {/* Inactive icon — fades/scales out */}
                <motion.span
                  className="nav-icon-layer"
                  animate={{
                    opacity: isActive ? 0 : 1,
                    scale: isActive ? 0.7 : 1,
                  }}
                  transition={!isActive
                    ? { type: 'spring', stiffness: 900, damping: 38, mass: 1 }
                    : { duration: 0.12, ease: [0.2, 0, 0, 1] }
                  }
                >
                  <item.Icon size={21} weight="regular" color="var(--ds-text-tertiary)" />
                </motion.span>
              </div>
              <motion.span
                className="nav-label"
                animate={{
                  color: isActive ? 'var(--ds-text)' : 'var(--ds-text-tertiary)',
                  fontWeight: isActive ? 600 : 400,
                  opacity: isActive ? 1 : 0.75,
                }}
                transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
              >
                {item.label}
              </motion.span>
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

function normalizeRealtimeValue(value) {
  if (value == null) return ''
  return String(value).trim()
}

function hasSplitwiseUserBinding(row, activeUserId) {
  const uid = normalizeRealtimeValue(activeUserId)
  if (!uid || !row || typeof row !== 'object') return false

  const userColumns = [
    row.user_id,
    row.linked_user_id,
    row.created_by_user_id,
    row.accepted_by_user_id,
    row.member_user_id,
  ]

  return userColumns.some((value) => normalizeRealtimeValue(value) === uid)
}

function getKnownSplitwiseGroupIds() {
  const groupIds = new Set()
  const groupQueries = queryClient.getQueriesData({ queryKey: ['splitwise', 'groups'] })
  const accessQueries = queryClient.getQueriesData({ queryKey: ['splitwise', 'group-access'] })

  for (const [, rows] of groupQueries) {
    if (!Array.isArray(rows)) continue
    for (const row of rows) {
      const id = normalizeRealtimeValue(row?.id)
      if (id) groupIds.add(id)
    }
  }

  for (const [, rows] of accessQueries) {
    if (!Array.isArray(rows)) continue
    for (const row of rows) {
      const id = normalizeRealtimeValue(row?.group_id)
      if (id) groupIds.add(id)
    }
  }

  return groupIds
}

function getKnownSplitwiseExpenseGroupMap() {
  const expenseToGroup = new Map()
  const expenseQueries = queryClient.getQueriesData({ queryKey: ['splitwise', 'expenses'] })
  for (const [, rows] of expenseQueries) {
    if (!Array.isArray(rows)) continue
    for (const row of rows) {
      const expenseId = normalizeRealtimeValue(row?.id)
      const groupId = normalizeRealtimeValue(row?.group_id)
      if (!expenseId || !groupId) continue
      expenseToGroup.set(expenseId, groupId)
    }
  }
  return expenseToGroup
}

function isRelevantSplitwiseRealtimeEvent(table, payload, activeUserId) {
  const next = payload?.new || payload?.record || {}
  const prev = payload?.old || {}
  const eventType = normalizeRealtimeValue(payload?.eventType).toUpperCase()

  if (hasSplitwiseUserBinding(next, activeUserId) || hasSplitwiseUserBinding(prev, activeUserId)) {
    return true
  }

  const knownGroupIds = getKnownSplitwiseGroupIds()

  let groupId = ''
  if (table === 'split_groups') {
    groupId = normalizeRealtimeValue(next?.id || prev?.id)
  } else {
    groupId = normalizeRealtimeValue(next?.group_id || prev?.group_id)
  }

  if (!groupId && table === 'split_expense_splits') {
    const expenseId = normalizeRealtimeValue(next?.expense_id || prev?.expense_id)
    if (expenseId) {
      groupId = getKnownSplitwiseExpenseGroupMap().get(expenseId) || ''
    }
  }

  if (groupId && knownGroupIds.has(groupId)) return true

  // Delete payloads may omit relational columns unless replica identity is full.
  // Fall back to invalidation to avoid stale UI after deletions.
  if (!groupId && eventType === 'DELETE') return true

  // If we don't have splitwise groups cached yet, only process rows that directly
  // bind to this user to avoid global cross-tenant invalidation churn.
  if (knownGroupIds.size === 0) return false

  return false
}

// ── Global Realtime Sync ──────────────────────────────────────────────────
// Realtime is a freshness enhancer, not a source of truth.
// If the socket is unavailable, fall back to periodic invalidation of active
// queries and keep retrying the websocket in the background with backoff.
function GlobalRealtimeSync() {
  const { user } = useAuth()
  const activeWalletUserId = useActiveWallet()
  const activeUserId = activeWalletUserId || user?.id

  useEffect(() => {
    if (!activeUserId) return

    const pendingInvalidations = new Map()
    let channel = null
    let connectTimerId = null
    let reconnectTimerId = null
    let fallbackIntervalId = null
    let attempt = 0
    let active = true
    let fallbackMode = false

    function queryKeySignature(queryKey) {
      try {
        return JSON.stringify(queryKey)
      } catch {
        return String(queryKey)
      }
    }

    function enqueuePolicyInvalidation(policy, tablePath = `/${policy.table}`) {
      if (!policy?.key || isSuppressed(policy.key)) return

      let entry = pendingInvalidations.get(policy.key)
      if (!entry) {
        entry = {
          timerId: null,
          tablePaths: new Set(),
          queryKeys: [],
          queryKeySignatures: new Set(),
        }
        pendingInvalidations.set(policy.key, entry)
      }

      if (tablePath) {
        entry.tablePaths.add(tablePath)
      }

      for (const queryKey of policy.queryKeys || []) {
        const signature = queryKeySignature(queryKey)
        if (entry.queryKeySignatures.has(signature)) continue
        entry.queryKeySignatures.add(signature)
        entry.queryKeys.push(queryKey)
      }

      if (entry.timerId) return

      entry.timerId = setTimeout(() => {
        entry.timerId = null
        if (!active || isSuppressed(policy.key)) {
          pendingInvalidations.delete(policy.key)
          return
        }

        const tablePaths = Array.from(entry.tablePaths)
        const queryKeys = [...entry.queryKeys]
        pendingInvalidations.delete(policy.key)

        void Promise.all(tablePaths.map((path) => evictSwCacheEntries(path)))
          .finally(() => {
            if (queryKeys.length > 0) {
              void invalidateQueryFamilies(queryKeys)
            }
          })
      }, 300)
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
        // In fallback polling mode, we MUST evict SW cache entries too,
        // otherwise StaleWhileRevalidate will just serve us the same stale data
        // for up to 12 hours.
        enqueuePolicyInvalidation(policy)
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
      let nextChannel = supabase.channel(`kosha-sync-${activeUserId}`)

      for (const policy of REALTIME_INVALIDATION_POLICIES) {
        const config = { event: '*', schema: 'public', table: policy.table }
        if (policy.filterColumn) {
          config.filter = `${policy.filterColumn}=eq.${activeUserId}`
        }

        nextChannel = nextChannel.on(
          'postgres_changes',
          config,
          (payload) => {
            if (policy.key === 'splitwise') {
              const relevant = isRelevantSplitwiseRealtimeEvent(policy.table, payload, activeUserId)
              if (!relevant) return
            }
            enqueuePolicyInvalidation(policy)
          }
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

    // Trigger immediate refresh when the user returns to the app from background (focus/unlock)
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible' && active) {
        invalidateFreshness()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      active = false
      fallbackMode = false
      clearConnectTimer()
      clearReconnectTimer()
      stopFallbackPolling()
      pendingInvalidations.forEach((entry) => {
        if (entry?.timerId) clearTimeout(entry.timerId)
      })
      pendingInvalidations.clear()
      removeActiveChannel()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [activeUserId])

  return null
}

// Per-history-entry scroll memory. React Router v6 (non-data router) does not
// restore scroll, so we do it manually: forward navigations start at the top,
// back/forward (POP) restores the offset captured for that history entry.
const _scrollPositions = new Map()

function ScrollManager() {
  const location = useLocation()
  const navType = useNavigationType()

  useEffect(() => {
    const key = location.key || 'default'

    if (navType === 'POP') {
      const y = _scrollPositions.get(key) ?? 0
      // Double rAF so the route content (and windowed-list padding) has laid
      // out before we restore, otherwise the scroll clamps to a short page.
      requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, y)))
    } else {
      window.scrollTo(0, 0)
    }

    const onScroll = () => { _scrollPositions.set(key, window.scrollY) }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [location.key, navType])

  return null
}

function RuntimeRouteTracker() {
  const location = useLocation()

  useEffect(() => {
    const path = `${location.pathname}${location.search || ''}`
    recordRuntimeRoute(path)
  }, [location.pathname, location.search])

  return null
}

// Pure DOM queries — no component state dependency, so defined at module scope
// to avoid recreation on every VersionHeartbeat render.
function hasActiveTextEditing() {
  const activeEl = document.activeElement
  if (!activeEl || !(activeEl instanceof HTMLElement)) return false
  const tag = activeEl.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    activeEl.isContentEditable
  )
}

function hasOpenDialogSurface() {
  return Boolean(
    document.querySelector('[aria-modal="true"]') ||
    document.querySelector('.sheet-panel')
  )
}

// Case 162: Versioned Heartbeat Reload
// Ensures that PWA instances left open for long periods eventually refresh
// to the latest code version and schema.
function VersionHeartbeat() {
  const qc = useQueryClient()

  useEffect(() => {
    const HEARTBEAT_INTERVAL = 24 * 60 * 60 * 1000 // 24 hours

    async function hasWaitingServiceWorker() {
      try {
        if (!('serviceWorker' in navigator)) return false
        const reg = await navigator.serviceWorker.getRegistration()
        // A waiting worker means new code is ready; only then is a reload useful.
        return !!(reg && reg.waiting)
      } catch {
        return false
      }
    }

    const interval = setInterval(async () => {
      // Skip reload if a mutation is in-flight (user mid-save), text is being
      // edited, or a dialog/sheet is open.
      if (
        document.visibilityState !== 'visible' ||
        qc.isMutating() !== 0 ||
        hasActiveTextEditing() ||
        hasOpenDialogSurface()
      ) {
        return
      }
      // Only reload when there is actually a new SW waiting — avoids pointless
      // 24h reloads when the app is already on the latest version.
      if (await hasWaitingServiceWorker()) {
        window.location.reload()
      }
    }, HEARTBEAT_INTERVAL)
    return () => clearInterval(interval)
  }, [qc])
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
      // Use the active wallet user (may differ from auth user in shared-wallet mode)
      const targetUserId = getActiveWalletUserId() || user.id
      try {
        await Promise.all([
          queryClient.prefetchQuery({
            queryKey: ['transactionsRecent', 5, targetUserId],
            queryFn: async () => {
              const { data, error } = await supabase
                .from('transactions')
                .select(DASHBOARD_RECENT_COLUMNS)
                .eq('user_id', targetUserId)
                .order('date', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(5)

              if (error) throw error
              return data || []
            },
            staleTime: 15 * 1000,
          }),
          queryClient.prefetchQuery({
            queryKey: ['todayExpenses', todayISO, targetUserId],
            queryFn: async () => {
              const { data, error } = await supabase
                .from('transactions')
                .select('amount')
                .eq('user_id', targetUserId)
                .eq('type', 'expense')
                .eq('date', todayISO)

              if (error) throw error
              return (data || []).reduce((sum, row) => sum + Number(row.amount || 0), 0)
            },
            staleTime: 30 * 1000,
          }),
          queryClient.prefetchQuery({
            queryKey: ['month', year, month, targetUserId],
            queryFn: async () => {
              const { data: rows, error } = await supabase.rpc('get_month_summary', {
                p_user_ids: [targetUserId],
                p_year: year,
                p_month: month,
              })

              if (error) throw error
              return parseMonthSummaryRows(rows)
            },
            staleTime: 30 * 1000,
          }),
          queryClient.prefetchQuery({
            queryKey: ['balance', 2099, 12, targetUserId],
            queryFn: async () => {
              const { data: balance, error } = await supabase.rpc('get_running_balance', {
                p_user_ids: [targetUserId],
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

    // Yield enough time for initActiveWallet() to complete its async store
    // init before getActiveWalletUserId() is read. 32ms was too short on
    // slow devices; 150ms covers the async RLS check reliably.
    const timer = setTimeout(() => {
      if (!cancelled) void runPrefetch()
    }, 150)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [user?.id])

  return null
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

function AnimatedRoutes() {
  const location = useLocation()

  useEffect(() => {
    if (typeof document === 'undefined') return
    // Blur a focused bottom-nav item so it doesn't trap focus on the new page.
    if (document.activeElement instanceof HTMLElement &&
        document.activeElement.classList.contains('nav-float-item')) {
      document.activeElement.blur()
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

// ── App shell ─────────────────────────────────────────────────────────────

/** Keeps custom categories registered in the module-level store for all components */
function CustomCategoryLoader() {
  const { user } = useAuth()
  useUserCategories({ enabled: !!user })
  return null
}

/**
 * EagerChunkPreloader — fires all lazy route imports during browser idle time.
 * By the time the user taps any nav item, the JS chunk is already in the
 * module cache → zero Suspense skeleton flash on navigation.
 */
function EagerChunkPreloader() {
  useEffect(() => {
    const loaders = Object.values(ROUTE_PRELOADERS)
    let handle = null

    const run = () => {
      // Fire all imports sequentially with tiny gaps so we don't monopolise
      // the network on initial load. Each import() is a no-op if the chunk
      // is already cached.
      loaders.forEach((load, i) => {
        setTimeout(() => void load().catch(() => { }), i * 80)
      })
    }

    if (typeof requestIdleCallback !== 'undefined') {
      handle = requestIdleCallback(run, { timeout: 4000 })
    } else {
      // Safari fallback
      handle = setTimeout(run, 1500)
    }

    return () => {
      if (typeof requestIdleCallback !== 'undefined' && handle) {
        cancelIdleCallback(handle)
      } else {
        clearTimeout(handle)
      }
    }
  }, [])

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
      // Defer state update to ensure it happens outside the render cycle
      // of the component triggering the invalidation.
      setTimeout(() => {
        setHasErrors(errored.length > 0)
      }, 0)
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
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 700, damping: 65, mass: 1 }}
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

let _unused_swFlag = null // removed — flag moved to useRef inside ShellStatusBanners

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
  // Guards the one-time listener registration inside onRegisteredSW callback
  const swListenersAttachedRef = useRef(false)

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (registration) {
        setSwRegistration(registration)
        // No interval or visibilitychange here — both are managed by the
        // swRegistration useEffect below, which has proper cleanup.
        swListenersAttachedRef.current = true
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

    // Unified SW freshness manager — both the periodic check and the
    // visibility-based check live here so they are properly torn down
    // when swRegistration changes or the component unmounts.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void swRegistration.update()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    const intervalId = window.setInterval(() => {
      void swRegistration.update()
    }, 30 * 60 * 1000)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
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
  const bottomClass = navHidden ? 'bottom-4' : 'bottom-[calc(var(--ds-nav-height)+1rem)]'
  const showUpdatePrompt = needRefresh
  const showInstallPrompt = !!deferredInstallPrompt && !installDismissed

  async function handleAppUpdate() {
    setUpdating(true)
    try {
      await updateServiceWorker(true)
      // Fallback: If the SW controllerchange event fails to fire (common on desktop
      // browsers or when multiple tabs are open), forcefully reload the page.
      setTimeout(() => {
        window.location.reload()
      }, 1200)
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

function WalletSwitchGuard() {
  const activeWalletUserId = useActiveWallet()
  
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('bottomsheet:close-all'))
  }, [activeWalletUserId])
  
  return null
}

function AppShell() {
  // Opt in to modern Navigation API for Predictive Back swipe preview on Android 14+ / Pixel
  useEffect(() => {
    if (typeof window === 'undefined' || !('navigation' in window)) return

    const handleNavigate = (event) => {
      if (event.navigationType === 'traverse' && event.canIntercept) {
        event.intercept({
          async handler() {
            // Successfully intercepted physical back-swipe for custom single-page-app transitions.
          }
        })
      }
    }

    window.navigation.addEventListener('navigate', handleNavigate)
    return () => {
      window.navigation.removeEventListener('navigate', handleNavigate)
    }
  }, [])

  return (
    <div className="relative min-h-dvh flex flex-col bg-kosha-bg">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:rounded-pill focus:bg-ink focus:px-4 focus:py-2 focus:text-white focus:shadow-card"
      >
        Skip to content
      </a>
      <ScrollManager />
      <WalletSwitchGuard />
      <RuntimeRouteTracker />
      <CustomCategoryLoader />
      <EagerChunkPreloader />
      <WalletPrefetcher />
      <main id="main-content" role="main" tabIndex={-1} className="flex-1 outline-none">
        <AnimatedRoutes />
      </main>
      <BottomNav />
      <QueryErrorRecovery />
      <ShellStatusBanners />
    </div>
  )
}

export default function App() {
  const [mode, setMode] = useState(() => document.documentElement.classList.contains('dark') ? 'dark' : 'light')

  useEffect(() => {
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains('dark')
      setMode(isDark ? 'dark' : 'light')
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return (
    <ThemeProvider theme={getMuiTheme(mode)}>
      <CssBaseline />
      <MotionConfig reducedMotion="user">
        <BrowserRouter future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
          <AuthProvider>
          <QueryClientProvider client={queryClient}>
            <GlobalRealtimeSync />
            <DashboardWarmPrefetch />
            <VersionHeartbeat />
              <AppContent />
            </QueryClientProvider>
          </AuthProvider>
        </BrowserRouter>
      </MotionConfig>
    </ThemeProvider>
  )
}
