import { BrowserRouter, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { MotionConfig } from 'framer-motion'
import { ThemeProvider, CssBaseline } from '@mui/material'
import { getMuiTheme } from './lib/muiTheme'
import { AuthProvider, useAuth } from './context/AuthContext'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { queryPersister } from './lib/queryPersister'
import { queryClient } from './lib/queryClient'
import { useUserCategories } from './hooks/useUserCategories'
import useKeyboardInset from './hooks/useKeyboardInset'
import { ToastProvider } from './context/ToastContext'

import { AnimatedRoutes, PageFallback } from './components/app/AppRoutes'
import { BottomNav } from './components/app/Navigation'
import { GlobalRealtimeSync } from './components/app/GlobalRealtimeSync'
import {
  ScrollManager,
  RuntimeRouteTracker,
  VersionHeartbeat,
  DashboardWarmPrefetch,
  EagerChunkPreloader,
  QueryErrorRecovery,
  ShellStatusBanners,
  WalletSwitchGuard,
} from './components/app/AppBehaviors'

/** Keeps custom categories registered in the module-level store for all components */
function CustomCategoryLoader() {
  const { user } = useAuth()
  useUserCategories({ enabled: !!user })
  return null
}

function WalletPrefetcher() {
  // Partner wallet data is prefetched on demand when the user switches wallets.
  return null
}

function AppContent() {
  const { loading: authLoading } = useAuth()
  const location = useLocation()
  if (authLoading) return <PageFallback pathname={location.pathname} />
  return <AppShell />
}

function AppShell() {
  useKeyboardInset()

  // Opt in to modern Navigation API for Predictive Back swipe preview on Android 14+ / Pixel
  useEffect(() => {
    if (typeof window === 'undefined' || !('navigation' in window)) return

    const handleNavigate = (event) => {
      if (event.navigationType === 'traverse' && event.canIntercept) {
        event.intercept({
          async handler() {}
        })
      }
    }

    window.navigation.addEventListener('navigate', handleNavigate)
    return () => {
      window.navigation.removeEventListener('navigate', handleNavigate)
    }
  }, [])

  return (
    <ToastProvider>
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
    </ToastProvider>
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
            <PersistQueryClientProvider
              client={queryClient}
              persistOptions={{
                persister: queryPersister,
                maxAge: 12 * 60 * 60 * 1000, // 12h
                buster: import.meta.env.VITE_APP_VERSION,
                dehydrateOptions: {
                  shouldDehydrateQuery: (query) => {
                    const key0 = Array.isArray(query.queryKey) ? query.queryKey[0] : null
                    if (key0 === 'kosha-active-wallet') return false
                    return query.state.status === 'success'
                  },
                },
              }}
              onSuccess={() => {
                queryClient.resumePausedMutations().catch(err => {
                  console.warn('[Kosha] Failed to resume paused mutations', err)
                })
              }}
            >
              <GlobalRealtimeSync />
              <DashboardWarmPrefetch />
              <VersionHeartbeat />
              <AppContent />
            </PersistQueryClientProvider>
          </AuthProvider>
        </BrowserRouter>
      </MotionConfig>
    </ThemeProvider>
  )
}
