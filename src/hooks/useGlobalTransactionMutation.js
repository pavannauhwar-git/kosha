import { useCallback, useRef } from 'react'
import { useAppData } from './useAppDataStore'
import { invalidateCache } from './useTransactions'

/**
 * useGlobalTransactionMutation — centralized "Brain" hook for add-transaction mutations.
 * Manages the three-phase optimistic lifecycle: global broadcast → UUID swap → background sync.
 * Used by Dashboard and Transactions to ensure all hooks see optimistic state immediately.
 */
export function useGlobalTransactionMutation() {
  const {
    addOptimisticTxn,
    resolveOptimisticTxn,
    removeOptimisticTxn,
  } = useAppData()

  // Tracks the __optimistic__ ID for the current in-flight add mutation
  const pendingOptimisticId = useRef(null)

  /**
   * Phase 1 — Global Broadcast.
   * Call this from AddTransactionSheet.onSaved for new transactions.
   * No-op for edits (payload.id is set) — those use the addOptimisticEdit flow.
   */
  const onTransactionSaved = useCallback((payload) => {
    if (payload.id) return

    const optimisticId = addOptimisticTxn(payload)
    pendingOptimisticId.current = optimisticId

    return optimisticId
  }, [addOptimisticTxn])

  /**
   * Phase 2 — Cleanup.
   * Call this from AddTransactionSheet.onConfirmed once Supabase responds.
   * Removes the optimistic entry — the cache-invalidation refetch brings the real row.
   */
  const onTransactionConfirmed = useCallback(() => {
    if (pendingOptimisticId.current) {
      resolveOptimisticTxn(pendingOptimisticId.current)
      pendingOptimisticId.current = null
    }
  }, [resolveOptimisticTxn])

  /**
   * Rollback — call from AddTransactionSheet.onFailed.
   * Removes only the ghost row that failed; other in-flight optimistic transactions are preserved.
   */
  const onTransactionFailed = useCallback(() => {
    const failedId = pendingOptimisticId.current
    pendingOptimisticId.current = null
    if (failedId) {
      removeOptimisticTxn(failedId)
    }

    // Sync all caches back to server truth
    invalidateCache('txns:')
    invalidateCache('month:')
    invalidateCache('balance:')
    invalidateCache('year:')
  }, [removeOptimisticTxn])

  return {
    onTransactionSaved,
    onTransactionConfirmed,
    onTransactionFailed,
    pendingOptimisticId,
  }
}
