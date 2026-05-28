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
      // React Query refetches automatically when data is stale (staleTime
      // exceeded). Mutations explicitly invalidate via invalidateQueryFamilies
      // which marks queries stale, so the next mount refetches naturally.
      // Setting `true` here would force a refetch on every mount even when
      // data is fresh — wasted network + extra re-renders on every tab visit.
      refetchOnMount: false,

      // Safety belt: keep window-focus refetch enabled. If a query was
      // somehow missed by an invalidation, returning to the tab from
      // another app forces a refetch. Combined with the existing
      // refetchOnReconnect, this keeps the data-freshness floor high
      // even though we no longer refetch on every mount.
      refetchOnWindowFocus: true,
      // Retry transient failures (network, 5xx) but not auth/client errors.
      retry: (failureCount, error) => {
        if (failureCount >= 2) return false
        const status = error?.status || error?.code
        // Don't retry auth errors or client errors
        if (status === 401 || status === 403 || status === 404) return false
        if (String(error?.message || '').includes('Not signed in')) return false
        return true
      },
      // When the device comes back online, refetch active queries
      // so the app recovers without a manual restart.
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

export async function evictSwCacheEntries(urlSubstring) {
  try {
    const cache = await caches.open('supabase-data')
    const keys = await cache.keys()
    await Promise.all(
      keys
        .filter(req => req.url.includes(urlSubstring))
        .map(req => cache.delete(req))
    )
  } catch { /* Cache API unavailable */ }
}
