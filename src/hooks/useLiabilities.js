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

export async function invalidateLiabilityCache() {
  suppress('liabilities')
  // Fuzzy match all sub-keys for liabilities
  await queryClient.invalidateQueries({ queryKey: ['liabilities'], refetchType: 'active' })
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
        staleTime: 0,
        refetchOnMount: 'always',
        refetchOnWindowFocus: true,
      },
      {
        queryKey: LIABILITY_PAID_QUERY_KEY,
        queryFn:  () => fetchLiabilitiesByPaid(true),
        enabled:  includePaid,
        staleTime: 0,
        refetchOnMount: 'always',
        refetchOnWindowFocus: true,
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

  // 2. Instant Cache Injection for Lists (Kills UI lag)
  queryClient.getQueryCache().findAll({ queryKey: ['liabilities'] }).forEach(query => {
    queryClient.setQueryData(query.queryKey, old => {
      if (!Array.isArray(old)) return old;
      return [data, ...old]; // Unshift new bill into the list
    });
  });

  // 3. Fire-and-Forget Background Sync (NO AWAIT)
  if (invalidate) invalidateLiabilityCache()

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

  // Instantly remove the paid bill from the pending list UI
  queryClient.getQueryCache().findAll({ queryKey: ['liabilities'] }).forEach(query => {
    queryClient.setQueryData(query.queryKey, old => {
      if (!Array.isArray(old)) return old;
      return old.filter(l => l.id !== liability.id);
    });
  });

  // Fire-and-Forget Background Sync (NO AWAIT)
  if (invalidate) {
    invalidateLiabilityCache()
    invalidateTxnCache()
  }

  return result
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

  // Instantly remove from UI
  queryClient.getQueryCache().findAll({ queryKey: ['liabilities'] }).forEach(query => {
    queryClient.setQueryData(query.queryKey, old => {
      if (!Array.isArray(old)) return old;
      return old.filter(l => l.id !== id);
    });
  });

  // Fire-and-Forget Background Sync (NO AWAIT)
  if (invalidate) invalidateLiabilityCache()
}