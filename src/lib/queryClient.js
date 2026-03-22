import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

/**
 * Invalidates query families for background refetch.
 *
 * FIX (defect 3.1): Changed refetchType from 'all' to 'active'.
 * 'all' was refetching BOTH active (currently rendered) AND inactive
 * (previously visited, now cached) queries on every mutation. Adding
 * a single expense was triggering refetches for every month and year
 * the user had visited this session, even months they navigated away
 * from 20 minutes ago.
 *
 * 'active' only refetches queries that are currently subscribed to by
 * a mounted component. Inactive cached entries remain stale and are
 * refreshed the next time the user navigates to them.
 */
export async function invalidateQueryFamilies(queryKeys) {
  await Promise.all(
    queryKeys.map(queryKey =>
      queryClient.invalidateQueries({ queryKey, refetchType: 'active' })
    )
  )
}
