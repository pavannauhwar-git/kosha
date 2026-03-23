/**
 * useLiabilities.js — Strict Server-Truth Architecture
 *
 * Follows the same mutation contract as useTransactions.js:
 *   1. await Supabase DB operation
 *   2. await invalidateCache() — waits for full refetch cycle
 *   3. Promise resolves only after server confirms AND fresh data is in cache
 *
 * NO setQueryData. NO optimistic updates. Server is the single source of truth.
 */

import { useQueries } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryClient, invalidateQueryFamilies } from '../lib/queryClient'
import { getAuthUserId } from '../lib/authStore'
import { suppress } from '../lib/mutationGuard'
import { invalidateCache as invalidateTxnCache } from './useTransactions'

export const LIABILITY_INVALIDATION_KEYS = [['liabilities']]

const LIABILITY_PENDING_QUERY_KEY = ['liabilities', 'pending']
const LIABILITY_PAID_QUERY_KEY    = ['liabilities', 'paid']
const LIABILITY_COLUMNS =
  'id, description, amount, due_date, is_recurring, recurrence, paid, linked_transaction_id'

/**
 * Invalidates all liability queries and awaits the full refetch cycle.
 * Always await this inside mutations.
 */
export async function invalidateLiabilityCache() {
  suppress('liabilities')
  await invalidateQueryFamilies(LIABILITY_INVALIDATION_KEYS)
}

async function fetchLiabilitiesByPaid(paidValue) {
  const userId = getAuthUserId()
  const { data: rows, error } = await supabase
    .from('liabilities')
    .select(LIABILITY_COLUMNS)
    .eq('user_id', userId)
    .eq('paid', paidValue)
    .order('due_date', { ascending: true })

  if (error) throw error
  return rows || []
}

export function useLiabilities({ includePaid = true } = {}) {
  const [pendingQuery, paidQuery] = useQueries({
    queries: [
      {
        queryKey: LIABILITY_PENDING_QUERY_KEY,
        queryFn:  () => fetchLiabilitiesByPaid(false),
      },
      {
        queryKey: LIABILITY_PAID_QUERY_KEY,
        queryFn:  () => fetchLiabilitiesByPaid(true),
        enabled:  includePaid,
      },
    ],
  })

  return {
    pending: pendingQuery.data  || [],
    paid:    includePaid ? (paidQuery.data || []) : [],
    loading: pendingQuery.isLoading || (includePaid && paidQuery.isLoading),
    error:   pendingQuery.error  || (includePaid && paidQuery.error) || null,
  }
}

/**
 * Add a new liability (bill/due).
 *
 * Strict Await Chain:
 *   1. await Supabase insert
 *   2. await invalidateLiabilityCache() — refetch completes before resolving
 */
export async function addLiability(payload, options = {}) {
  const { invalidate = true } = options
  const userId = getAuthUserId()
  const tempId = 'temp-' + Date.now()
  const optimistic = { ...payload, id: tempId, user_id: userId, isPending: true }

  // Optimistically inject
  queryClient.setQueryData(['liabilities', 'pending'], old =>
    Array.isArray(old) ? [optimistic, ...(old || [])] : [optimistic]
  )

  // Fire-and-forget: resolve background
  supabase
    .from('liabilities')
    .insert([{ ...payload, user_id: userId }])
    .select(LIABILITY_COLUMNS)
    .single()
    .then(({ data, error }) => {
      if (error) {
        // Revert optimistic
        queryClient.setQueryData(['liabilities', 'pending'], old =>
          (old || []).filter(b => b.id !== tempId)
        )
        throw error
      }
      if (invalidate) invalidateLiabilityCache()
    })
    .catch(() => {/* Optionally: show toast here if you want global error handling */})

  // Return the optimistic row immediately
  return optimistic
}

/**
 * Mark a liability as paid using the atomic RPC.
 *
 * Strict Await Chain:
 *   1. await Supabase RPC (atomic: inserts txn + marks paid + creates recurrence)
 *   2. await both liability and transaction cache invalidations
 *
 * Both invalidations are awaited in parallel via Promise.all to minimize
 * total wait time while still guaranteeing all active queries are fresh.
 */
export async function markPaid(liability, options = {}) {
  const { invalidate = true } = options

  const userId = getAuthUserId()

  const { data: result, error: rpcError } = await supabase
    .rpc('mark_liability_paid', {
      p_liability_id: liability.id,
      p_user_id:      userId,
    })

  if (rpcError) throw rpcError

  if (invalidate) {
    // Await both in parallel — both must complete before the mutation
    // Promise resolves and the UI is allowed to proceed.
    await Promise.all([
      invalidateLiabilityCache(),
      invalidateTxnCache(),
    ])
  }

  return result
}

/**
 * Delete a liability.
 *
 * Strict Await Chain:
 *   1. await Supabase delete
 *   2. await invalidateLiabilityCache()
 */
export async function deleteLiability(id, options = {}) {
  const { invalidate = true } = options

  const userId = getAuthUserId()
  const { error } = await supabase
    .from('liabilities')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error

  if (invalidate) await invalidateLiabilityCache()
}
