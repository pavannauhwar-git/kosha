import { useQueries } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryClient } from '../lib/queryClient'
import { getAuthUserId } from '../lib/authStore'
import { suppress } from '../lib/mutationGuard'
import { invalidateCache as invalidateTxnCache } from './useTransactions'
import { traceQuery } from '../lib/queryTrace'

export const LIABILITY_INVALIDATION_KEYS = [['liabilities']]

const LIABILITY_PENDING_QUERY_KEY = ['liabilities', 'pending']
const LIABILITY_PAID_QUERY_KEY    = ['liabilities', 'paid']
const LIABILITY_COLUMNS =
  'id, description, amount, due_date, is_recurring, recurrence, paid, linked_transaction_id'

const LIABILITY_FRESH_WINDOW_MS = 15 * 1000

export async function invalidateLiabilityCache() {
  suppress('liabilities')
  // Use 'all' so both the Dashboard due-bills strip and the Bills page
  // refresh immediately after a mutation. There are only two liability
  // queries ('pending' and 'paid'), so 'all' never causes over-fetching.
  await queryClient.invalidateQueries({ queryKey: ['liabilities'], refetchType: 'all' })
}

async function fetchLiabilitiesByPaid(paidValue) {
  return traceQuery(`liabilities:${paidValue ? 'paid' : 'pending'}`, async () => {
    const userId = getAuthUserId()
    const { data: rows, error } = await supabase
      .from('liabilities')
      .select(LIABILITY_COLUMNS)
      .eq('user_id', userId)
      .eq('paid', paidValue)
      .order('due_date', { ascending: true })

    if (error) throw error
    return rows || []
  })
}

export function useLiabilities({ includePaid = true } = {}) {
  const [pendingQuery, paidQuery] = useQueries({
    queries: [
      {
        queryKey: LIABILITY_PENDING_QUERY_KEY,
        queryFn:  () => fetchLiabilitiesByPaid(false),
        staleTime: LIABILITY_FRESH_WINDOW_MS,
      },
      {
        queryKey: LIABILITY_PAID_QUERY_KEY,
        queryFn:  () => fetchLiabilitiesByPaid(true),
        enabled:  includePaid,
        staleTime: LIABILITY_FRESH_WINDOW_MS,
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
  const userId = getAuthUserId()
  
  // 1. Strict Server Write
  const { data, error } = await supabase
    .from('liabilities')
    .insert([{ ...payload, user_id: userId }])
    .select(LIABILITY_COLUMNS)
    .single()

  if (error) throw error

  if (invalidate) {
    await invalidateLiabilityCache()
  }

  return data
}

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
    await Promise.all([
      invalidateLiabilityCache(),
      invalidateTxnCache(),
    ])
  }

  return result;
}

export async function deleteLiability(id, options = {}) {
  const { invalidate = true } = options
  const userId = getAuthUserId()
  
  const { error } = await supabase
    .from('liabilities')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error

  if (invalidate) {
    await invalidateLiabilityCache()
  }

  return true;
}
