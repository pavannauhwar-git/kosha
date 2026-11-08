import { useEffect, useRef, useCallback, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { House, List, CalendarDots, ChartBar, Receipt, UsersThree } from '@phosphor-icons/react'
import { useAuth } from '../../context/AuthContext'
import { getActiveWalletUserId } from '../../lib/walletStore'
import { queryClient } from '../../lib/queryClient'
import { supabase } from '../../lib/supabase'
import { hapticTap } from '../../lib/haptics'
import { ROUTE_PRELOADERS } from './AppRoutes'
import { TRANSACTION_LIST_COLUMNS, TRANSACTION_INSIGHTS_COLUMNS, fetchMonthSummary, fetchYearSummary } from '../../hooks/useTransactions'
import { LIABILITY_PENDING_QUERY_KEY, LIABILITY_MONTH_QUERY_KEY, fetchLiabilitiesByPaid, fetchLiabilitiesForMonth } from '../../hooks/useLiabilities'
import { LOAN_ACTIVE_GIVEN_KEY, fetchLoans } from '../../hooks/useLoans'

export const NAV = [
  { path: '/', label: 'Home', Icon: House, match: ['/'] },
  { path: '/transactions', label: 'Activity', Icon: List, match: ['/transactions'] },
  { path: '/monthly', label: 'Monthly', Icon: CalendarDots, match: ['/monthly'] },
  { path: '/analytics', label: 'Insights', Icon: ChartBar, match: ['/analytics'] },
  { path: '/obligations', label: 'Obligations', Icon: Receipt, match: ['/obligations', '/bills', '/loans'] },
  { path: '/splitwise', label: 'Splitwise', Icon: UsersThree, match: ['/splitwise'] },
]

export const BOTTOM_NAV_HIDE_ON = ['/login', '/onboarding', '/join', '/splitwise/join', '/auth', '/about', '/report-bug', '/settings', '/guide', '/reconciliation']

export function useRouteIntentPrefetch() {
  useAuth() // subscribed so re-render triggers on session change
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
      void Promise.all([
        queryClient.prefetchQuery({
          queryKey: ['month', year, month, activeUserId],
          queryFn: () => fetchMonthSummary(year, month, activeUserId),
          staleTime: 30 * 1000,
        }),
        queryClient.prefetchQuery({
          queryKey: LIABILITY_MONTH_QUERY_KEY(year, month, activeUserId),
          queryFn: ({ signal }) => fetchLiabilitiesForMonth(year, month, activeUserId, signal),
          staleTime: 30 * 1000,
        }),
      ]).catch(() => { })
      return
    }

    if (path === '/analytics') {
      void queryClient.prefetchQuery({
        queryKey: ['year', year, activeUserId],
        queryFn: () => fetchYearSummary(year, activeUserId),
        staleTime: 30 * 1000,
      }).catch(() => { })
      return
    }

    if (path === '/obligations' || path === '/bills' || path === '/loans') {
      void Promise.all([
        queryClient.prefetchQuery({
          queryKey: LIABILITY_PENDING_QUERY_KEY(activeUserId),
          queryFn: ({ signal }) => fetchLiabilitiesByPaid(false, activeUserId, signal),
          staleTime: 30 * 1000,
        }),
        queryClient.prefetchQuery({
          queryKey: LOAN_ACTIVE_GIVEN_KEY(activeUserId),
          queryFn: ({ signal }) => fetchLoans('given', false, activeUserId, signal),
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

export function BottomNav() {
  const { loading } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const prefetchRoute = useRouteIntentPrefetch()

  const shouldHide = BOTTOM_NAV_HIDE_ON.some(p => location.pathname.startsWith(p))

  const isVisible = !loading && !shouldHide

  const active = NAV.findIndex((n) =>
    n.match.some((path) => (path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)))
  )

  const [prevActive, setPrevActive] = useState(active)

  useEffect(() => {
    if (active !== prevActive) {
      const timer = setTimeout(() => {
        setPrevActive(active)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [active, prevActive])

  return (
    <div
      className="nav-float-wrap"
      style={{
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? 'auto' : 'none',
        visibility: shouldHide ? 'hidden' : 'visible',
        transition: loading ? 'none' : 'opacity 180ms cubic-bezier(0.2, 0, 0, 1)',
      }}
    >
      <nav className="nav-float" aria-label="Main navigation">
        {NAV.map((item, i) => {
          const isActive = i === active
          return (
            <button
              key={item.path}
              className="nav-float-item"
              onClick={(_e) => {
                hapticTap()
                if (isActive) {
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                  return
                }
                navigate(item.path, { replace: true })
              }}
              onPointerUp={() => {
                hapticTap()
                if (isActive) {
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                  return
                }
                navigate(item.path, { replace: true })
              }}
              onMouseEnter={() => prefetchRoute(item.path)}
              onFocus={(e) => {
                if (!e.currentTarget.matches(':focus-visible')) return
                prefetchRoute(item.path)
              }}
              aria-current={isActive ? 'page' : undefined}
              aria-label={item.label}
            >
              <div className="nav-icon-wrap">
                {isActive && (
                  <motion.div
                    layoutId="nav-pill"
                    className={`nav-icon-bg ${active === prevActive ? 'nav-pill-settled' : ''}`}
                    initial={false}
                    transition={{
                      type: 'spring',
                      stiffness: 800,
                      damping: 40,
                      mass: 1,
                    }}
                  />
                )}
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
