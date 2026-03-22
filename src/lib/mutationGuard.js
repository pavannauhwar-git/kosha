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

const SUPPRESS_TTL_MS = 1500

// Map of tableKey → expiry timestamp
const _suppressed = new Map()

/**
 * Call this inside a mutation, BEFORE firing invalidateCache().
 * tableKey matches the table names used in REALTIME_INVALIDATION_POLICIES.
 *
 * @param {'transactions' | 'liabilities'} tableKey
 */
export function suppress(tableKey) {
  _suppressed.set(tableKey, Date.now() + SUPPRESS_TTL_MS)
}

/**
 * Called by GlobalRealtimeSync before each realtime-triggered invalidation.
 * Returns true if the invalidation should be skipped.
 *
 * @param {'transactions' | 'liabilities'} tableKey
 */
export function isSuppressed(tableKey) {
  const expiry = _suppressed.get(tableKey)
  if (!expiry) return false
  if (Date.now() < expiry) return true
  _suppressed.delete(tableKey)   // clean up expired entry
  return false
}
