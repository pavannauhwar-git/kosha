import { useEffect, useState, useRef, useCallback } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useAuth } from '../../context/AuthContext'
import { getActiveWalletUserId, useActiveWallet } from '../../lib/walletStore'
import { queryClient } from '../../lib/queryClient'
import { supabase } from '../../lib/supabase'
import { recordRuntimeRoute } from '../../lib/runtimeMonitor'
import { parseMonthSummaryRows } from '../../hooks/useTransactions'
import { ROUTE_PRELOADERS } from './AppRoutes'

export const DASHBOARD_RECENT_COLUMNS =
  'id, date, created_at, type, amount, description, category, investment_vehicle, is_repayment, payment_mode, notes, source_transaction_id, linked_split_expense_id, linked_split_settlement_id, linked_bill_id, linked_loan_id'

const _scrollPositions = new Map()

export function ScrollManager() {
  const location = useLocation()
  const navType = useNavigationType()

  useEffect(() => {
    const key = location.key || 'default'

    if (navType === 'POP') {
      const y = _scrollPositions.get(key) ?? 0
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

export function RuntimeRouteTracker() {
  const location = useLocation()

  useEffect(() => {
    const path = `${location.pathname}${location.search || ''}`
    recordRuntimeRoute(path)
  }, [location.pathname, location.search])

  return null
}

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

export function VersionHeartbeat() {
  const qc = useQueryClient()

  useEffect(() => {
    const HEARTBEAT_INTERVAL = 24 * 60 * 60 * 1000 // 24 hours

    async function hasWaitingServiceWorker() {
      try {
        if (!('serviceWorker' in navigator)) return false
        const reg = await navigator.serviceWorker.getRegistration()
        return !!(reg && reg.waiting)
      } catch {
        return false
      }
    }

    const interval = setInterval(async () => {
      if (
        document.visibilityState !== 'visible' ||
        qc.isMutating() !== 0 ||
        hasActiveTextEditing() ||
        hasOpenDialogSurface()
      ) {
        return
      }
      if (await hasWaitingServiceWorker()) {
        window.location.reload()
      }
    }, HEARTBEAT_INTERVAL)
    return () => clearInterval(interval)
  }, [qc])
  return null
}

export function DashboardWarmPrefetch() {
  const { user } = useAuth()

  useEffect(() => {
    if (!user?.id) return

    let cancelled = false
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const todayISO = `${year}-${String(month).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

    const runPrefetch = async () => {
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

export function EagerChunkPreloader() {
  useEffect(() => {
    const loaders = Object.values(ROUTE_PRELOADERS)
    let handle = null

    const run = () => {
      loaders.forEach((load, i) => {
        setTimeout(() => void load().catch(() => { }), i * 80)
      })
    }

    if (typeof requestIdleCallback !== 'undefined') {
      handle = requestIdleCallback(run, { timeout: 4000 })
    } else {
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

export function QueryErrorRecovery() {
  const qc = useQueryClient()
  const [hasErrors, setHasErrors] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const syncErrorState = () => {
      const errored = qc.getQueryCache().findAll({
        predicate: (q) => q.state.status === 'error' && q.getObserversCount() > 0,
      })
      setTimeout(() => {
        setHasErrors(errored.length > 0)
      }, 0)
    }

    syncErrorState()
    return qc.getQueryCache().subscribe(syncErrorState)
  }, [qc])

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
      className="fixed bottom-[calc(var(--nav-height)+1rem)] left-4 right-4 flex items-center gap-3 bg-ink text-white px-4 py-3 rounded-card shadow-card-lg max-w-[398px] mx-auto" style={{ zIndex: "var(--ds-z-toast)" }}
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

const BOTTOM_NAV_HIDE_ON = ['/login', '/onboarding', '/join', '/splitwise/join', '/auth', '/about', '/report-bug', '/settings', '/guide', '/reconciliation']

export function ShellStatusBanners() {
  const location = useLocation()
  const [isOffline, setIsOffline] = useState(() => {
    if (typeof navigator === 'undefined') return false
    return !navigator.onLine
  })
  const [, setUpdateDismissed] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [swRegistration, setSwRegistration] = useState(null)
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState(null)
  const [installDismissed, setInstallDismissed] = useState(false)
  const [installing, setInstalling] = useState(false)
  const [installMessage, setInstallMessage] = useState('')
  const installMessageTimerRef = useRef(null)
  const swListenersAttachedRef = useRef(false)

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl, registration) {
      if (registration) {
        setSwRegistration(registration)
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
    const handleOnline = () => {
      setIsOffline(false)
      queryClient.invalidateQueries()
    }
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
    <>
      {(isOffline || showUpdatePrompt || showInstallPrompt || installMessage) && (
        <div className={`pointer-events-none fixed left-4 right-4 mx-auto max-w-[398px] space-y-2 flex flex-col justify-end ${bottomClass}`} style={{ zIndex: "var(--ds-z-toast)" }}>
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
      )}
    </>
  )
}

export function WalletSwitchGuard() {
  const activeWalletUserId = useActiveWallet()

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('bottomsheet:close-all'))
  }, [activeWalletUserId])

  return null
}
