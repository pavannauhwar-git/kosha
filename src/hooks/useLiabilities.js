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

function runInBackground(promise, scope) {
  void promise.catch((error) => {
    console.warn(`[Kosha] ${scope} background refresh failed`, error)
  })
}

async function cancelLiabilityFamilyQueries() {
  await Promise.all([
    queryClient.cancelQueries({ queryKey: LIABILITY_PENDING_QUERY_KEY }),
    queryClient.cancelQueries({ queryKey: LIABILITY_PAID_QUERY_KEY }),
  ])
}

function sortLiabilityDueAsc(a, b) {
  return String(a?.due_date || '').localeCompare(String(b?.due_date || ''))
}

function primeLiabilityCaches(newLiability) {
  if (!newLiability?.id) return
  if (newLiability.paid) {
    queryClient.setQueryData(LIABILITY_PAID_QUERY_KEY, (old) => {
      if (!Array.isArray(old)) return old
      return [newLiability, ...old.filter(row => row.id !== newLiability.id)].sort(sortLiabilityDueAsc)
    })
    return
  }

  queryClient.setQueryData(LIABILITY_PENDING_QUERY_KEY, (old) => {
    if (!Array.isArray(old)) return old
    return [newLiability, ...old.filter(row => row.id !== newLiability.id)].sort(sortLiabilityDueAsc)
  })
}

function findCachedLiabilityById(id) {
  const pending = queryClient.getQueryData(LIABILITY_PENDING_QUERY_KEY)
  if (Array.isArray(pending)) {
    const hit = pending.find(row => row?.id === id)
    if (hit) return hit
  }
  const paid = queryClient.getQueryData(LIABILITY_PAID_QUERY_KEY)
  if (Array.isArray(paid)) {
    const hit = paid.find(row => row?.id === id)
    if (hit) return hit
  }
  return null
}

function reconcileLiabilityCaches(previousLiability, nextLiability) {
  const targetId = nextLiability?.id || previousLiability?.id
  if (!targetId) return

  queryClient.setQueryData(LIABILITY_PENDING_QUERY_KEY, (old) => {
    if (!Array.isArray(old)) return old
    const withoutTarget = old.filter(row => row.id !== targetId)
    if (!nextLiability || nextLiability.paid) return withoutTarget
    return [nextLiability, ...withoutTarget].sort(sortLiabilityDueAsc)
  })

  queryClient.setQueryData(LIABILITY_PAID_QUERY_KEY, (old) => {
    if (!Array.isArray(old)) return old
    const withoutTarget = old.filter(row => row.id !== targetId)
    if (!nextLiability || !nextLiability.paid) return withoutTarget
    return [nextLiability, ...withoutTarget].sort(sortLiabilityDueAsc)
  })
}

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

  await cancelLiabilityFamilyQueries()

  // Render newly added bill in the list immediately.
  primeLiabilityCaches(data)

  if (invalidate) {
    // Keep server-truth sync, but don't block the form close on refetch.
    runInBackground(invalidateLiabilityCache(), 'liabilities add')
  }

  return data
}

export async function markPaid(liability, options = {}) {
  const { invalidate = true } = options
  const userId = getAuthUserId()
  const previousLiability = findCachedLiabilityById(liability.id) || liability

  const { data: result, error: rpcError } = await supabase
    .rpc('mark_liability_paid', {
      p_liability_id: liability.id,
      p_user_id:      userId,
    })

  if (rpcError) throw rpcError

  await cancelLiabilityFamilyQueries()

  const paidDueDate = result?.next_due_date || previousLiability?.due_date
  const nextLiability = {
    ...previousLiability,
    paid: true,
    due_date: paidDueDate,
    linked_transaction_id: result?.transaction_id || previousLiability?.linked_transaction_id || null,
  }
  reconcileLiabilityCaches(previousLiability, nextLiability)

  if (invalidate) {
    runInBackground(invalidateLiabilityCache(), 'liabilities markPaid')
    runInBackground(invalidateTxnCache(), 'transactions from markPaid')
  }

  return result;
}

export async function deleteLiability(id, options = {}) {
  const { invalidate = true } = options
  const userId = getAuthUserId()
  const previousLiability = findCachedLiabilityById(id)
  
  const { error } = await supabase
    .from('liabilities')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error

  await cancelLiabilityFamilyQueries()

  reconcileLiabilityCaches(previousLiability, null)

  if (invalidate) {
    runInBackground(invalidateLiabilityCache(), 'liabilities delete')
  }

  return true;
}
