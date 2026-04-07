import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      // After mutation invalidation, inactive pages must refresh when revisited.
      // `true` refetches only stale queries on mount (not always), preserving
      // most of the SWR/perceived-performance behavior while fixing stale lists.
      refetchOnMount: true,
      refetchOnWindowFocus: false,
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

export async function invalidateQueryFamilies(queryKeys) {
  await Promise.all(
    queryKeys.map(queryKey =>
      queryClient.invalidateQueries({ queryKey, refetchType: 'active' })
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
