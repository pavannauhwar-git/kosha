import { useCallback, useRef } from 'react'
import { useAppData } from './useAppDataStore'
import { invalidateCache } from './useTransactions'

/**
 * useGlobalTransactionMutation — centralized "Brain" hook for add-transaction mutations.
 *
 * Implements the three-phase optimistic lifecycle:
 *
 *  Phase 1 — Global Broadcast  (onTransactionSaved)
 *    Generates a __optimistic__ ID and immediately pushes the new item into
 *    the global AppDataStore. Because useTransactions, useMonthSummary,
 *    useRunningBalance, and useYearSummary all read from the store, every
 *    mounted page reacts in real-time without any extra wiring.
 *
 *  Phase 2 — UUID Swap  (onTransactionConfirmed)
 *    Once Supabase returns the real database record the fake ID is replaced
 *    with the real UUID in both the caller's local list and the global store.
 *    This prevents handleDelete from crashing when it tries to call
 *    deleteTransaction() with a non-existent __optimistic__ ID.
 *
 *  Phase 3 — Background Sync  (onTransactionConfirmed / onTransactionFailed)
 *    All related cache keys (txns, month summary, balance, year analytics)
 *    are invalidated via invalidateCache(), which dispatches
 *    CACHE_INVALIDATION_EVENT. Every mounted hook hears the event and
 *    silently re-fetches in the background, ensuring eventual consistency.
 *
 * @param {object}   listOps                     Per-list operations from the caller's useTransactions instance
 * @param {Function} listOps.prependOptimistic   Instantly prepend item to this hook's local list
 * @param {Function} listOps.replaceOptimistic   Replace the temp-ID row with the confirmed server row
 */
export function useGlobalTransactionMutation({ prependOptimistic, replaceOptimistic } = {}) {
  const {
    addOptimisticTxn,
    resolveOptimisticTxn,
    clearOptimisticTxns,
  } = useAppData()

  // Tracks the __optimistic__ ID for the current in-flight add mutation
  const pendingOptimisticId = useRef(null)

  /**
   * Phase 1 — Global Broadcast.
   * Call this from AddTransactionSheet.onSaved for new transactions.
   * Edits (payload.id is set) are handled by the addOptimisticEdit flow — this
   * function is a no-op for them.
   */
  const onTransactionSaved = useCallback((payload) => {
    if (payload.id) return

    // Broadcast to ALL caches simultaneously via AppDataStore.
    // useTransactions, useMonthSummary, useRunningBalance, useYearSummary
    // all subscribe to optimisticTxns and react immediately.
    const optimisticId = addOptimisticTxn(payload)
    pendingOptimisticId.current = optimisticId

    // Also prepend to the caller's local in-memory list for instant render
    prependOptimistic?.(payload, optimisticId)

    return optimisticId
  }, [addOptimisticTxn, prependOptimistic])

  /**
   * Phase 2 — UUID Swap.
   * Call this from AddTransactionSheet.onConfirmed once Supabase responds.
   *
   * Swaps the fake __optimistic__ ID with the real UUID so subsequent
   * deletes/edits always reference a real database row and never crash.
   *
   * Phase 3 (Background Sync) is handled entirely by the CRUD functions
   * (addTransaction / updateTransaction) which call invalidateCache()
   * internally. No duplicate invalidation is needed here.
   */
  const onTransactionConfirmed = useCallback((serverTxn) => {
    if (pendingOptimisticId.current) {
      if (serverTxn) {
        // Swap in the caller's local list so the rendered row has the real ID
        replaceOptimistic?.(pendingOptimisticId.current, serverTxn)
        // Swap in the global store — resolves for ALL mounted hooks
        resolveOptimisticTxn(pendingOptimisticId.current, serverTxn)
      }
      pendingOptimisticId.current = null
    }
  }, [replaceOptimistic, resolveOptimisticTxn])

  /**
   * Rollback + Phase 3 — Background Sync.
   * Call this from AddTransactionSheet.onFailed to discard the ghost row.
   * Runs the sync sweep even on failure so the list converges back to server truth.
   */
  const onTransactionFailed = useCallback(() => {
    pendingOptimisticId.current = null
    clearOptimisticTxns()

    // Phase 3 — Sync even on failure to remove the ghost row from all caches
    invalidateCache('txns:')
    invalidateCache('month:')
    invalidateCache('balance:')
    invalidateCache('year:')
  }, [clearOptimisticTxns])

  return {
    onTransactionSaved,
    onTransactionConfirmed,
    onTransactionFailed,
    /** Exposed so callers can inspect the in-flight optimistic ID if needed */
    pendingOptimisticId,
  }
}
