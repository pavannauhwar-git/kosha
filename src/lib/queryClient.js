import { QueryClient, MutationCache, QueryCache } from '@tanstack/react-query'
import { captureError } from './errorReporting'

const queryCache = new QueryCache({
  onError: (error, query) => {
    const status = error?.status || error?.code
    // Auth failures are handled by AuthGuard redirect — don't spam Sentry.
    if (status === 401 || status === 403) return
    captureError(error, {
      tags: {
        source: 'react-query',
        queryKey: JSON.stringify(query.queryKey).slice(0, 200),
      },
    })
  },
})

const mutationCache = new MutationCache({
  onError: (error, _vars, _ctx, mutation) => {
    captureError(error, {
      tags: {
        source: 'react-query-mutation',
        mutationKey: JSON.stringify(mutation.options.mutationKey || []).slice(0, 200),
      },
    })
  },
})

export const queryClient = new QueryClient({
  queryCache,
  mutationCache,
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      // FIX-007: refetchOnMount is disabled so tab switches never trigger a
      // refetch waterfall. Freshness is maintained by three mechanisms instead:
      //   1. refetchOnWindowFocus: true  — app returns from background → refresh
      //   2. refetchOnReconnect: 'always' — network drop + reconnect → refresh
      //   3. Realtime subscriptions + invalidateQueryFamilies — mutations → refresh
      //
      // If a specific query reports stale data, lower its per-query staleTime
      // (e.g. staleTime: 30_000) rather than reverting this flag globally.
      refetchOnMount: false,
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => {
        if (failureCount >= 2) return false
        const status = error?.status || error?.code
        if (status === 401 || status === 403 || status === 404) return false
        if (String(error?.message || '').includes('Not signed in')) return false
        return true
      },
      refetchOnReconnect: 'always',
    },
  },
})

export function invalidateQueryFamilies(queryKeys) {
  if (!Array.isArray(queryKeys)) return Promise.resolve()
  return Promise.all(
    queryKeys.map(queryKey =>
      queryClient.invalidateQueries({ queryKey })
    )
  )
}

// Map API routes to query prefixes for targeted Service Worker cache invalidation
const CACHE_INVALIDATION_MAP = {
  '/transactions': ['/transactions'],
  '/liabilities': ['/liabilities', '/transactions'], // Bills touch transactions
  '/loans': ['/loans', '/transactions'],             // Loans touch transactions
  '/splitwise': ['/splitwise'],
}

export async function evictSwCacheEntries(pathPrefix) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
    return
  }

  const pathsToEvict = CACHE_INVALIDATION_MAP[pathPrefix] || [pathPrefix]
  
  try {
    navigator.serviceWorker.controller.postMessage({
      type: 'EVICT_API_CACHE',
      paths: pathsToEvict
    })
  } catch (err) {
    console.warn('[Kosha] Failed to postMessage to service worker', err)
  }
}
