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
      retry: 1,
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
