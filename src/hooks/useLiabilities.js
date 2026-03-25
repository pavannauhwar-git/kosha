import { useQueries } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryClient } from '../lib/queryClient'
import { getAuthUserId } from '../lib/authStore'
import { suppress } from '../lib/mutationGuard'
import { traceQuery } from '../lib/queryTrace'
import { FINANCIAL_EVENT_ACTIONS, logFinancialEvent } from '../lib/auditLog'
import { invalidateCache as invalidateTransactionCache } from './useTransactions'

export const LIABILITY_INVALIDATION_KEYS = [['liabilities']]

const LIABILITY_PENDING_QUERY_KEY = ['liabilities', 'pending']
const LIABILITY_PAID_QUERY_KEY    = ['liabilities', 'paid']
const LIABILITY_COLUMNS =
  'id, description, amount, due_date, is_recurring, recurrence, paid, linked_transaction_id'

function runInBackground(promise, scope) {
  void promise.catch((error) => {
    console.warn(`[Kosha] ${scope} background refresh failed`, error)
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

export function useLiabilities({ includePaid = true, enabled = true } = {}) {
  const [pendingQuery, paidQuery] = useQueries({
    queries: [
      {
        queryKey: LIABILITY_PENDING_QUERY_KEY,
        queryFn:  () => fetchLiabilitiesByPaid(false),
        enabled,
      },
      {
        queryKey: LIABILITY_PAID_QUERY_KEY,
        queryFn:  () => fetchLiabilitiesByPaid(true),
        enabled:  enabled && includePaid,
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

export async function addLiability(payload) {
  const userId = getAuthUserId()
  
  // 1. Strict Server Write
  const { data, error } = await supabase
    .from('liabilities')
    .insert([{ ...payload, user_id: userId }])
    .select(LIABILITY_COLUMNS)
    .single()

  if (error) throw error

  runInBackground(
    logFinancialEvent({
      userId,
      action: FINANCIAL_EVENT_ACTIONS.BILL_ADD,
      entityType: 'liability',
      entityId: data.id,
      metadata: {
        amount: data.amount,
        due_date: data.due_date,
        is_recurring: data.is_recurring,
        recurrence: data.recurrence,
      },
    }),
    'liabilities add audit'
  )

  return data
}

export async function markPaid(liability) {
  const userId = getAuthUserId()

  const { data: result, error: rpcError } = await supabase
    .rpc('mark_liability_paid', {
      p_liability_id: liability.id,
      p_user_id:      userId,
    })

  if (rpcError) throw rpcError

  runInBackground(
    logFinancialEvent({
      userId,
      action: FINANCIAL_EVENT_ACTIONS.BILL_MARK_PAID,
      entityType: 'liability',
      entityId: liability.id,
      metadata: {
        before: null,
        after: null,
        rpc_result: result || null,
      },
    }),
    'liabilities markPaid audit'
  )

  return result;
}

export async function deleteLiability(id) {
  const userId = getAuthUserId()
  
  const { error } = await supabase
    .from('liabilities')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) throw error

  runInBackground(
    logFinancialEvent({
      userId,
      action: FINANCIAL_EVENT_ACTIONS.BILL_DELETE,
      entityType: 'liability',
      entityId: id,
      metadata: {
        before: null,
      },
    }),
    'liabilities delete audit'
  )

  return true;
}

function sortLiabilitiesByDueDateAsc(rows) {
  return [...rows].sort((a, b) => String(a?.due_date || '').localeCompare(String(b?.due_date || '')))
}

function cloneCacheData(data) {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(data)
  }
  return JSON.parse(JSON.stringify(data))
}

function snapshotLiabilityCaches() {
  return [
    [LIABILITY_PENDING_QUERY_KEY, cloneCacheData(queryClient.getQueryData(LIABILITY_PENDING_QUERY_KEY) || [])],
    [LIABILITY_PAID_QUERY_KEY, cloneCacheData(queryClient.getQueryData(LIABILITY_PAID_QUERY_KEY) || [])],
  ]
}

function restoreLiabilitySnapshot(snapshot) {
  for (const [key, data] of snapshot) {
    queryClient.setQueryData(key, data)
  }
}

export function optimisticallyInsertPendingLiability(liability) {
  if (!liability?.id) return

  queryClient.setQueryData(LIABILITY_PENDING_QUERY_KEY, (prev = []) => {
    const deduped = prev.filter((row) => row?.id !== liability.id)
    return sortLiabilitiesByDueDateAsc([...deduped, { ...liability, paid: false }])
  })
}

export function optimisticallyMarkLiabilityPaid(liability) {
  if (!liability?.id) return

  queryClient.setQueryData(LIABILITY_PENDING_QUERY_KEY, (prev = []) =>
    prev.filter((row) => row?.id !== liability.id)
  )

  queryClient.setQueryData(LIABILITY_PAID_QUERY_KEY, (prev = []) => {
    const paidRow = { ...liability, paid: true, __optimistic: true }
    const deduped = prev.filter((row) => row?.id !== liability.id)
    return sortLiabilitiesByDueDateAsc([...deduped, paidRow])
  })
}

export function optimisticallyDeleteLiabilityFromCache(id) {
  if (!id) return

  queryClient.setQueryData(LIABILITY_PENDING_QUERY_KEY, (prev = []) =>
    prev.filter((row) => row?.id !== id)
  )
  queryClient.setQueryData(LIABILITY_PAID_QUERY_KEY, (prev = []) =>
    prev.filter((row) => row?.id !== id)
  )
}

export async function addLiabilityMutation(payload, __testOverrides = null) {
  const snapshot = snapshotLiabilityCaches()
  const optimisticId = `optimistic-liability-${Date.now()}`
  const nowIso = new Date().toISOString()

  optimisticallyInsertPendingLiability({
    ...payload,
    id: optimisticId,
    paid: false,
    created_at: nowIso,
    __optimistic: true,
  })

  try {
    const addFn = __testOverrides?.addLiability || addLiability
    const invalidateLiabilityFn = __testOverrides?.invalidateLiabilityCache || invalidateLiabilityCache

    const created = await addFn(payload)
    optimisticallyDeleteLiabilityFromCache(optimisticId)
    optimisticallyInsertPendingLiability(created)
    await invalidateLiabilityFn()
    return created
  } catch (error) {
    restoreLiabilitySnapshot(snapshot)
    throw error
  }
}

export async function markLiabilityPaidMutation(liability, __testOverrides = null) {
  const snapshot = snapshotLiabilityCaches()
  optimisticallyMarkLiabilityPaid(liability)

  try {
    const markPaidFn = __testOverrides?.markPaid || markPaid
    const invalidateLiabilityFn = __testOverrides?.invalidateLiabilityCache || invalidateLiabilityCache
    const invalidateTransactionFn = __testOverrides?.invalidateTransactionCache || invalidateTransactionCache

    const result = await markPaidFn(liability)
    await Promise.all([
      invalidateLiabilityFn(),
      invalidateTransactionFn(),
    ])
    return result
  } catch (error) {
    restoreLiabilitySnapshot(snapshot)
    throw error
  }
}

export async function deleteLiabilityMutation(id, __testOverrides = null) {
  const snapshot = snapshotLiabilityCaches()
  optimisticallyDeleteLiabilityFromCache(id)

  try {
    const deleteFn = __testOverrides?.deleteLiability || deleteLiability
    const invalidateLiabilityFn = __testOverrides?.invalidateLiabilityCache || invalidateLiabilityCache

    await deleteFn(id)
    await invalidateLiabilityFn()
    return true
  } catch (error) {
    restoreLiabilitySnapshot(snapshot)
    throw error
  }
}
