import { useQueries, useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { queryClient } from '../lib/queryClient'
import { getAuthUserId } from '../lib/authStore'
import { suppress } from '../lib/mutationGuard'
import { traceQuery } from '../lib/queryTrace'
import { FINANCIAL_EVENT_ACTIONS, logFinancialEvent } from '../lib/auditLog'
import { invalidateCache as invalidateTransactionCache } from './useTransactions'

export const LIABILITY_INVALIDATION_KEYS = [['liabilities'], ['liabilitiesMonth']]

const LIABILITY_PENDING_QUERY_KEY = ['liabilities', 'pending']
const LIABILITY_PAID_QUERY_KEY    = ['liabilities', 'paid']
const LIABILITY_COLUMNS =
  'id, description, amount, due_date, is_recurring, recurrence, paid, linked_transaction_id'
const MONTH_LIABILITY_COLUMNS = 'id, amount, due_date, paid'

function runInBackground(promise, scope) {
  void promise.catch((error) => {
    console.warn(`[Kosha] ${scope} background refresh failed`, error)
  })
}

export async function invalidateLiabilityCache() {
  suppress('liabilities')
  await queryClient.invalidateQueries({ queryKey: ['liabilitiesMonth'], refetchType: 'active' })
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
        placeholderData: (previousData) => previousData,
      },
      {
        queryKey: LIABILITY_PAID_QUERY_KEY,
        queryFn:  () => fetchLiabilitiesByPaid(true),
        enabled:  enabled && includePaid,
        placeholderData: (previousData) => previousData,
      },
    ],
  })

  return {
    pending: pendingQuery.data  || [],
    paid:    includePaid ? (paidQuery.data || []) : [],
    loading: pendingQuery.isLoading || (includePaid && paidQuery.isLoading),
    pendingLoading: pendingQuery.isLoading,
    paidLoading: includePaid ? paidQuery.isLoading : false,
    error:   pendingQuery.error  || (includePaid && paidQuery.error) || null,
  }
}

function monthDateRange(year, month) {
  const safeYear = Number(year)
  const safeMonth = Number(month)
  if (!Number.isFinite(safeYear) || !Number.isFinite(safeMonth)) {
    return { startDate: null, endDate: null }
  }

  const startDate = `${safeYear}-${String(safeMonth).padStart(2, '0')}-01`
  const endDate = `${safeYear}-${String(safeMonth).padStart(2, '0')}-${new Date(safeYear, safeMonth, 0).getDate()}`
  return { startDate, endDate }
}

export function useLiabilitiesByMonth(year, month, options = {}) {
  const { enabled = true } = options
  const { startDate, endDate } = monthDateRange(year, month)

  const { data, isLoading, error } = useQuery({
    queryKey: ['liabilitiesMonth', year, month],
    enabled: enabled && !!startDate && !!endDate,
    queryFn: async () => traceQuery('liabilities:month', async () => {
      const userId = getAuthUserId()
      const { data: rows, error: queryError } = await supabase
        .from('liabilities')
        .select(MONTH_LIABILITY_COLUMNS)
        .eq('user_id', userId)
        .gte('due_date', startDate)
        .lte('due_date', endDate)
        .order('due_date', { ascending: true })

      if (queryError) throw queryError
      return rows || []
    }),
  })

  const rows = data || []
  return {
    rows,
    pending: rows.filter((row) => !row?.paid),
    paid: rows.filter((row) => !!row?.paid),
    loading: isLoading,
    error,
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

  const prev = queryClient.getQueryData(LIABILITY_PENDING_QUERY_KEY)
  if (!Array.isArray(prev)) return
  
  const deduped = prev.filter((row) => row?.id !== liability.id)
  queryClient.setQueryData(
    LIABILITY_PENDING_QUERY_KEY,
    sortLiabilitiesByDueDateAsc([...deduped, { ...liability, paid: false }])
  )
}

export function optimisticallyMarkLiabilityPaid(liability) {
  if (!liability?.id) return

  const pendingData = queryClient.getQueryData(LIABILITY_PENDING_QUERY_KEY)
  if (!Array.isArray(pendingData)) {
    queryClient.setQueryData(
      LIABILITY_PENDING_QUERY_KEY,
      pendingData.filter((row) => row?.id !== liability.id)
    )
  }

  const paidData = queryClient.getQueryData(LIABILITY_PAID_QUERY_KEY)
  if (Array.isArray(paidData)) {
    const paidRow = { ...liability, paid: true, __optimistic: true }
    const deduped = paidData.filter((row) => row?.id !== liability.id)
    queryClient.setQueryData(
      LIABILITY_PAID_QUERY_KEY,
      sortLiabilitiesByDueDateAsc([...deduped, paidRow])
    )
  }
}

export function optimisticallyDeleteLiabilityFromCache(id) {
  if (!id) return

  const pendingData = queryClient.getQueryData(LIABILITY_PENDING_QUERY_KEY)
  if (Array.isArray(pendingData)) {
    queryClient.setQueryData(
      LIABILITY_PENDING_QUERY_KEY,
      pendingData.filter((row) => row?.id !== id)
    )
  }

  const paidData = queryClient.getQueryData(LIABILITY_PAID_QUERY_KEY)
  if (Array.isArray(paidData)) {
    queryClient.setQueryData(
      LIABILITY_PAID_QUERY_KEY,
      paidData.filter((row) => row?.id !== id)
    )
  }
}

export async function addLiabilityMutation(payload, __testOverrides = null) {
  const snapshot = snapshotLiabilityCaches()
  suppress('liabilities')
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
    await queryClient.cancelQueries({ queryKey: ['liabilities'] })

    optimisticallyDeleteLiabilityFromCache(optimisticId)
    optimisticallyInsertPendingLiability(created)
    runInBackground(invalidateLiabilityFn(), 'liability add cache invalidation')
    return created
  } catch (error) {
    restoreLiabilitySnapshot(snapshot)
    throw error
  }
}

export async function markLiabilityPaidMutation(liability, __testOverrides = null) {
  const snapshot = snapshotLiabilityCaches()
  suppress('liabilities')
  suppress('transactions')
  optimisticallyMarkLiabilityPaid(liability)

  try {
    const markPaidFn = __testOverrides?.markPaid || markPaid
    const invalidateLiabilityFn = __testOverrides?.invalidateLiabilityCache || invalidateLiabilityCache
    const invalidateTransactionFn = __testOverrides?.invalidateTransactionCache || invalidateTransactionCache

    const result = await markPaidFn(liability)
    await queryClient.cancelQueries({ queryKey: ['liabilities'] })
    await queryClient.cancelQueries({ queryKey: ['transactions'] })
    await queryClient.cancelQueries({ queryKey: ['transactionsRecent'] })

    optimisticallyMarkLiabilityPaid(liability) // Re-apply to ensure cache is correct after cancellations

    runInBackground(
      Promise.all([
        invalidateLiabilityFn(),
        invalidateTransactionFn(),
      ]),
      'liability markPaid cache invalidation'
    )
    return result
  } catch (error) {
    restoreLiabilitySnapshot(snapshot)
    throw error
  }
}

export async function deleteLiabilityMutation(id, __testOverrides = null) {
  const snapshot = snapshotLiabilityCaches()
  suppress('liabilities')
  optimisticallyDeleteLiabilityFromCache(id)

  try {
    const deleteFn = __testOverrides?.deleteLiability || deleteLiability
    const invalidateLiabilityFn = __testOverrides?.invalidateLiabilityCache || invalidateLiabilityCache

    await deleteFn(id)
    await queryClient.cancelQueries({ queryKey: ['liabilities'] })

    optimisticallyDeleteLiabilityFromCache(id) // Re-apply to ensure cache is correct after cancellations

    runInBackground(invalidateLiabilityFn(), 'liability delete cache invalidation')
    return true
  } catch (error) {
    restoreLiabilitySnapshot(snapshot)
    throw error
  }
}
