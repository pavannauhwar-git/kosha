import { QueryClient, MutationCache, QueryCache } from '@tanstack/react-query'
import { captureError, isExpectedMutationError } from './errorReporting'
import { ERROR_KIND, classifyError } from './errorTaxonomy'
import { createDebouncedTask } from './debouncedTask'

export const PERSISTED_CACHE_MAX_AGE = 12 * 60 * 60 * 1000

// Search results hold the typed search text in their key: they leave memory
// quickly and are never written to the offline snapshot.
export const SEARCH_QUERY_GC_TIME = 5 * 60 * 1000

export function isSearchQueryKey(queryKey) {
  if (!Array.isArray(queryKey)) return false
  return queryKey.some((part) => (
    part && typeof part === 'object' && typeof part.search === 'string' && part.search.trim() !== ''
  ))
}


const queryCache = new QueryCache({
  onError: (error, query) => {
    // Auth failures are handled by AuthGuard redirect — don't spam Sentry.
    if (classifyError(error) === ERROR_KIND.PERMISSION) return
    // Only the key's name: later parts can hold search text.
    const queryKey = String(query.queryKey?.[0] ?? '').slice(0, 80)
    captureError(error, {
      context: `query:${queryKey}`,
      tags: {
        source: 'react-query',
        queryKey,
      },
    })
  },
})

const mutationCache = new MutationCache({
  // Single global reporting choke point for every useMutation in the app.
  // Expected errors (validation, auth/RLS, double-tap) are filtered out so the
  // Sentry dashboard stays signal-rich. Pass a human label via the mutation's
  // `meta.context` (see useAppMutation) for a readable Sentry `context` tag.
  onError: (error, _vars, _ctx, mutation) => {
    if (isExpectedMutationError(error)) return
    const context = mutation?.meta?.context || 'mutation'
    captureError(error, {
      context,
      tags: {
        source: 'mutation',
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
      // Matches the persisted snapshot's maxAge (App.jsx). A shorter gcTime
      // drops screens from memory, and so from the snapshot, while the app
      // sits in the background, and an offline cold start opens empty.
      gcTime: PERSISTED_CACHE_MAX_AGE,
      // FIX-007: refetchOnMount is disabled so tab switches never trigger a
      // refetch waterfall. Freshness is maintained by three mechanisms instead:
      //   1. refetchOnWindowFocus: true  — app returns from background → refresh
      //      (families covered by GlobalRealtimeSync opt out; it refreshes them)
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

let invalidationQueue = []

const scheduleFamilyInvalidation = createDebouncedTask(() => {
  const keysToInvalidate = [...new Set(invalidationQueue.map(k => JSON.stringify(k)))].map(k => JSON.parse(k))
  invalidationQueue = []
  return Promise.all(keysToInvalidate.map(queryKey => queryClient.invalidateQueries({ queryKey })))
}, 50)

export function invalidateQueryFamilies(queryKeys) {
  if (!Array.isArray(queryKeys)) return Promise.resolve()
  invalidationQueue.push(...queryKeys)
  return scheduleFamilyInvalidation()
}
