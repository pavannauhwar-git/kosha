import { useMutation } from '@tanstack/react-query'

const MUTATION_RETRY = (failureCount, error) => {
  if (failureCount >= 2) return false
  const status = error?.status || error?.code
  if (status === 401 || status === 403 || status === 404) return false
  if (String(error?.message || '').includes('Not signed in')) return false
  return true
}

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
    // Mirror the query-level retry policy: never retry auth/permission/not-found
    // failures — they will never succeed and would cause a replay storm when the
    // offline queue picks them back up on every reconnect.
    retry: MUTATION_RETRY,
    mutationFn: async (args) => {
      // In Stage 2, writes are queued offline. Idempotency for the RPCs that
      // need it is enforced inside their own mutation fns (which derive a
      // stable id and pass it as p_id) and re-affirmed server-side via
      // `coalesce(p_id, gen_random_uuid())`. This hook must NOT touch the
      // payload: many mutations use a top-level `id` to distinguish create
      // vs. update (e.g. saveTransactionMutation) or write it straight into
      // an UPDATE set (e.g. updateProfile), so injecting an id here corrupts
      // those writes.
      return mutationFn(args)
    },
    ...options,
    meta: { context, ...(meta || {}) },
  })

  return mutation
}
