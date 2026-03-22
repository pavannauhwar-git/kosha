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

export function invalidateLiabilityCache() {
  // FIX (defect 3.2): suppress realtime double-fetch for liabilities table
  suppress('liabilities')
  return invalidateQueryFamilies(LIABILITY_INVALIDATION_KEYS)
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

export async function addLiability(payload, options = {}) {
  const { invalidate = true } = options

  try {
    const userId = getAuthUserId()
    const { data, error } = await supabase
      .from('liabilities')
      .insert([{ ...payload, user_id: userId }])
      .select(LIABILITY_COLUMNS)
      .single()

    if (error) throw error

    // Inject into pending cache in due-date order
    queryClient.setQueryData(LIABILITY_PENDING_QUERY_KEY, (old) => {
      if (!Array.isArray(old)) return old
      return [...old, data].sort(
        (a, b) => new Date(a.due_date) - new Date(b.due_date)
      )
    })

    if (invalidate) invalidateLiabilityCache()

    return data
  } catch (err) {
    console.error('[Kosha] addLiability failed', err)
    throw err
  }
}

export async function markPaid(liability, options = {}) {
  const { invalidate = true } = options

  try {
    const userId = getAuthUserId()

    // FIX (defect 3.3): Replaced 3 sequential non-atomic client-side DB calls
    // with a single atomic RPC. Previously:
    //   Call 1: INSERT transaction   (~200ms)
    //   Call 2: UPDATE liability     (~200ms)  — if this failed, orphaned txn existed
    //   Call 3: INSERT next recurrence (~200ms)
    //
    // Now: all 3 steps run inside a single Postgres transaction via the
    // mark_liability_paid RPC. Either all succeed or all roll back.
    // Network cost: 1 round trip (~150–200ms) vs 2–3 (~400–600ms).
    const { data: result, error: rpcError } = await supabase
      .rpc('mark_liability_paid', {
        p_liability_id: liability.id,
        p_user_id:      userId,
      })

    if (rpcError) throw rpcError

    // Optimistically move liability from pending to paid in cache
    queryClient.setQueryData(LIABILITY_PENDING_QUERY_KEY, (old) =>
      Array.isArray(old) ? old.filter(b => b.id !== liability.id) : old
    )
    queryClient.setQueryData(LIABILITY_PAID_QUERY_KEY, (old) => {
      if (!Array.isArray(old)) return old
      const paidLiability = {
        ...liability,
        paid:                  true,
        linked_transaction_id: result?.transaction_id || null,
      }
      return [paidLiability, ...old]
    })

    if (invalidate) {
      invalidateLiabilityCache()
      invalidateTxnCache()
    }
  } catch (err) {
    console.error('[Kosha] markPaid failed', err)
    throw err
  }
}

export async function deleteLiability(id, options = {}) {
  const { invalidate = true } = options

  try {
    const userId = getAuthUserId()
    const { error } = await supabase
      .from('liabilities')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw error

    const removeById = (old) =>
      Array.isArray(old) ? old.filter(b => b.id !== id) : old

    queryClient.setQueryData(LIABILITY_PENDING_QUERY_KEY, removeById)
    queryClient.setQueryData(LIABILITY_PAID_QUERY_KEY,    removeById)

    if (invalidate) invalidateLiabilityCache()
  } catch (err) {
    console.error('[Kosha] deleteLiability failed', err)
    throw err
  }
}
