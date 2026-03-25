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
 *
 * FIX (transactions not updating): All families now use prefix-based
 * queryKey matching uniformly. Previously, ['transactions'] used a
 * predicate filter instead. In React Query v5, the Promise returned by
 * invalidateQueries({ predicate }) does not reliably resolve only after
 * all matching active queries finish refetching — so the transaction list
 * refetch was not awaited, causing the UI to close before fresh data
 * arrived. Prefix matching (queryKey: ['transactions']) correctly awaits
 * all active refetches before resolving, which is required for the
 * strict server-truth mutation chain.
 */
export async function invalidateQueryFamilies(queryKeys) {
  await Promise.all(
    queryKeys.map(queryKey =>
      queryClient.invalidateQueries({ queryKey, refetchType: 'active' })
    )
  )
}
