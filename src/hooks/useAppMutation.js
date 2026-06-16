import { useMutation } from '@tanstack/react-query'

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
 *   const saveExpense = useAppMutation(addSplitExpenseMutation, { context: 'splitwise:addExpense' })
 *   saveExpense.mutate(args, { onSuccess, onError })
 *   saveExpense.isPending   // replaces a manual `saving` flag
 *
 * @param {Function} mutationFn  async fn that performs the write (existing *Mutation fn)
 * @param {{ context?: string } & import('@tanstack/react-query').UseMutationOptions} [options]
 */
export function useAppMutation(mutationFn, { context, meta, mutationKey, ...options } = {}) {
  const defaultKey = context ? [context] : undefined
  const key = mutationKey || defaultKey

  return useMutation({
    mutationKey: key,
    networkMode: 'offlineFirst',
    mutationFn: async (args) => {
      // In Stage 2, writes are queued offline. We no longer throw an error when offline,
      // letting React Query pause and queue the mutation automatically.
      return mutationFn(args)
    },
    ...options,
    meta: { context, ...(meta || {}) },
  })
}
