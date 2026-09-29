import { useMutation } from '@tanstack/react-query'
import { MUTATION_RETRY } from '../lib/mutationRetry'
import { assertOnline } from '../lib/offlineError'

/**
 * Standard mutation hook for the app. Wraps React Query's useMutation and
 * threads a human-readable `context` into `meta` so the global
 * MutationCache.onError (see src/lib/queryClient.js) can report unexpected
 * failures to Sentry with a useful tag — no per-call-site error wiring needed.
 *
 * The mutationFn keeps doing whatever it already does (optimistic cache
 * updates, invalidation, audit logging). This hook only standardizes
 * invocation, pending state, and centralized error reporting.
 *
 * Usage:
 *   const { mutateAsync: saveExpense } = useAppMutation(addSplitExpenseMutation, { context: 'splitwise:addExpense' })
 *
 * @param {Function} mutationFn  async fn that performs the write (existing *Mutation fn)
 * @param {{ context?: string } & import('@tanstack/react-query').UseMutationOptions} [options]
 */
export function useAppMutation(mutationFn, { context, meta, mutationKey, ...options } = {}) {
  const defaultKey = context ? [context] : undefined
  const key = mutationKey || defaultKey

  const mutation = useMutation({
    mutationKey: key,
    // 'always': never pause. Offline is handled explicitly by assertOnline() so the
    // caller gets an error immediately instead of a mutation stuck in isPending.
    networkMode: 'always',
    retry: MUTATION_RETRY,
    mutationFn: async (args) => {
      // Writes are NOT queued offline. Offline saves fail fast with a clear message.
      assertOnline()
      return mutationFn(args)
    },
    ...options,
    meta: { context, ...(meta || {}) },
  })

  return mutation
}
