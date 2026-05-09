import * as Sentry from '@sentry/react'

const DSN = import.meta.env.VITE_SENTRY_DSN

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.MODE,            // 'development' | 'production'
    release: import.meta.env.VITE_APP_VERSION,    // optional — set in vite.config.js define block
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,     // financial data — always mask
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 0,
    replaysOnErrorSampleRate: 1.0,   // capture replay on every error in prod
    replaysSessionSampleRate: 0.0,   // no session replays — privacy first
    beforeSend(event) {
      // Strip query params that could contain auth tokens
      if (event.request?.url) {
        try {
          const url = new URL(event.request.url)
          url.search = ''
          event.request.url = url.toString()
        } catch { /* no-op */ }
      }
      return event
    },
  })
}

export function captureError(error, { context = 'unknown', extra = {} } = {}) {
  if (!(error instanceof Error)) {
    error = new Error(String(error ?? 'Unknown error'))
  }

  if (DSN) {
    Sentry.withScope((scope) => {
      scope.setTag('context', context)
      scope.setExtras(extra)
      Sentry.captureException(error)
    })
    return
  }

  // Fallback — structured console output in dev
  console.error(`[Kosha] Error in ${context}:`, error.message, extra)
}

export function setErrorReportingUser(user) {
  if (!user?.id) return
  if (DSN) {
    Sentry.setUser({ id: user.id })
  }
}

export function clearErrorReportingUser() {
  if (DSN) {
    Sentry.setUser(null)
  }
}

