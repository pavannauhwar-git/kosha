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
      // After mutation invalidation, inactive pages must refresh when revisited.
      // `true` refetches only stale queries on mount (not always), preserving
      // most of the SWR/perceived-performance behavior while fixing stale lists.
      refetchOnMount: true,
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
