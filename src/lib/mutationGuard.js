/**
 * mutationGuard — suppresses realtime double-fetch after local mutations
 *
 * WHY THIS EXISTS (defect 3.2):
 * Every local mutation (add/update/delete transaction, mark bill paid) was
 * triggering TWO complete rounds of cache invalidation and network refetches:
 *
 *   Round 1: mutation calls invalidateCache() directly (~0ms after DB response)
 *   Round 2: Supabase broadcasts the DB change to the realtime channel
 *            (~300–500ms later) → GlobalRealtimeSync calls invalidateQueryFamilies()
 *
 * The second round refetched everything that the first round JUST finished
 * refetching. Pure wasted network.
 *
 * HOW IT WORKS:
 * Before firing invalidateCache(), a mutation calls suppress(tableKey).
 * This registers a suppression window for that table for SUPPRESS_TTL_MS.
 * GlobalRealtimeSync calls isSuppressed(tableKey) before invalidating.
 * If suppressed, the realtime invalidation is skipped entirely.
 *
 * The suppression window (1500ms) is long enough to cover:
 *   - The mutation's own invalidation completing (~800ms with 'active' refetchType)
 *   - The realtime broadcast latency (~300–500ms)
 * But short enough that a genuine remote change (from another device/tab)
 * firing 2+ seconds after a local mutation is NOT suppressed.
 */

import { getActiveWalletUserId } from './walletStore'

const SUPPRESS_TTL_MS = 2000

// Map of scopedKey → expiry timestamp
const _suppressed = new Map()

/**
 * Call this inside a mutation, BEFORE firing invalidateCache().
 * tableKey matches the table names used in REALTIME_INVALIDATION_POLICIES.
 *
 * @param {'transactions' | 'liabilities' | 'loans' | 'splitwise'} tableKey
 */
export function suppress(tableKey) {
  const userId = getActiveWalletUserId() || 'anon'
  _suppressed.set(`${tableKey}:${userId}`, Date.now() + SUPPRESS_TTL_MS)
}

/**
 * Called by GlobalRealtimeSync before each realtime-triggered invalidation.
 * Returns true if the invalidation should be skipped.
 *
 * @param {'transactions' | 'liabilities' | 'loans' | 'splitwise'} tableKey
 */
export function isSuppressed(tableKey) {
  const userId = getActiveWalletUserId() || 'anon'
  const scopedKey = `${tableKey}:${userId}`
  const expiry = _suppressed.get(scopedKey)
  if (!expiry) return false
  if (Date.now() < expiry) return true
  _suppressed.delete(scopedKey)   // clean up expired entry
  return false
}

// Map to track in-flight optimistic mutations by query key string
const _inFlight = new Set()

/**
 * Wraps an optimistic mutation function with safeguards:
 * 1. Cancels any in-flight fetches for the affected queryKey to prevent race conditions.
 * 2. Prevents double-taps by maintaining a single in-flight lock per queryKey.
 * 3. Provides a standard UUIDv4 for optimistic IDs (instead of Date.now()).
 * 
 * @param {Array} queryKey - The React Query key array to lock and cancel.
 * @param {Function} fn - The mutation callback, receives the tempId string.
 * @returns {Promise<any>}
 */
import { queryClient } from './queryClient'

export async function withOptimisticGuard(queryKey, fn) {
  const keyStr = JSON.stringify(queryKey)
  
  if (_inFlight.has(keyStr)) {
    return Promise.reject(new Error('OPTIMISTIC_BUSY'))
  }
  
  _inFlight.add(keyStr)
  try {
    // 1. Cancel in-flight queries to prevent them from overwriting optimistic data
    await queryClient.cancelQueries({ queryKey })
    
    // 2. Generate a stable, valid UUID for temp IDs
    const tempId = crypto.randomUUID()
    
    // 3. Execute the mutation logic
    return await fn(tempId)
  } finally {
    // 4. Always release the lock
    _inFlight.delete(keyStr)
  }
}
