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

  const mutation = useMutation({
    mutationKey: key,
    networkMode: 'offlineFirst',
    mutationFn: async (args) => {
      // In Stage 2, writes are queued offline. Idempotency is enforced globally
      // across all RPCs, making it safe for React Query to pause and replay writes.
      return mutationFn(args)
    },
    ...options,
    meta: { context, ...(meta || {}) },
  })

  // Inject a stable ID into object-shaped variables before they reach React Query.
  // This ensures the ID is captured in the persisted offline variables and remains
  // stable during replays, fixing the idempotency loop.
  const wrapWithId = (originalMutate) => (variables, ...args) => {
    let payload = variables
    if (payload && typeof payload === 'object' && !Array.isArray(payload) && payload.id == null) {
      payload = { ...payload, id: crypto.randomUUID() }
    }
    return originalMutate(payload, ...args)
  }

  return {
    ...mutation,
    mutate: wrapWithId(mutation.mutate),
    mutateAsync: wrapWithId(mutation.mutateAsync),
  }
}
