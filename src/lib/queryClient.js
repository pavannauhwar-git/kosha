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
      // Realtime subscriptions + invalidateQueryFamilies keep data fresh after
      // mutations. Refetching on every tab mount wastes bandwidth and causes a
      // visible loading waterfall on tab switches. staleTime (5 min) and
      // refetchOnWindowFocus handle the rare cases where data could go stale.
      refetchOnMount: false,
      refetchOnWindowFocus: false,
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
