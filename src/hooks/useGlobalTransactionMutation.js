import { useCallback, useRef } from 'react'
import { useAppData } from './useAppDataStore'
import { invalidateCache, mergeConfirmedTransactionIntoCache } from './useTransactions'

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
   * Phase 2 — Cleanup + Sync.
   * Call this from AddTransactionSheet.onConfirmed once Supabase responds.
   * Removes the optimistic entry FIRST, then invalidates so the refetch brings
   * the real row with the optimistic guard already down (no flash/revert).
   * The caller (AddTransactionSheet) passes the serverTxn so we can invalidate
   * the right month/year caches precisely.
   */
  const onTransactionConfirmed = useCallback((serverTxn) => {
    if (pendingOptimisticId.current) {
      resolveOptimisticTxn(pendingOptimisticId.current, serverTxn)
      pendingOptimisticId.current = null
    }
    // Patch local caches immediately with the confirmed row so refreshes
    // never temporarily lose the just-added transaction while backend reads catch up.
    mergeConfirmedTransactionIntoCache(serverTxn)
    // Invalidate AFTER the optimistic entry is removed so the refetch lands clean
    const date = serverTxn?.date ? new Date(serverTxn.date) : new Date()
    invalidateCache(`month:${date.getFullYear()}:${date.getMonth() + 1}`)
    invalidateCache(`balance:`)
    invalidateCache(`txns:`)
    invalidateCache(`year:${date.getFullYear()}`)
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
